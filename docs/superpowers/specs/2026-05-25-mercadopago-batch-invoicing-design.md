# Mercado Pago Batch Invoicing — Design Spec

Import approved payments from Mercado Pago and batch-emit invoices to "Consumidor Final" via ARCA, with real-time progress tracking.

## Context

Factos-ng is a single-page invoicing app. Users currently emit invoices one-at-a-time via the `/facturar` form. Many users receive dozens of Mercado Pago payments daily and need to issue corresponding invoices. This feature lets them import MP payments for a date range, select which to invoice, and process them in bulk.

## Decisions Made

| Decision | Choice |
|---|---|
| MP access token storage | New column `mp_access_token` in `contribuyentes` |
| Backend structure | New Edge Function `mercadopago-sync` (search + process-batch actions) |
| Batch processing strategy | Sequential resilient — one at a time, skip on failure, continue |
| Progress feedback | Supabase Realtime on `mp_batch_jobs` table |
| Data model | Separate `mp_conciliaciones` table (don't pollute `comprobantes`) |
| Comprobante type | Auto-resolved by emisor's condición IVA (FC C or FC B) |
| Invoice date | date_created from MP payment, clamped to ARCA fiscal window |
| UI placement | Button next to +CUIT on `/facturar`, opens modal |
| Error recovery | Show failed items with "Reintentar fallidas" button |

---

## Database Schema

### Table: `mp_conciliaciones`

Tracks every MP payment ID the system has seen, preventing duplicates across imports.

```sql
CREATE TABLE mp_conciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  mp_payment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('facturado', 'ignorado', 'fallido')),
  -- MP payment metadata (snapshot at import time)
  mp_date_created TIMESTAMPTZ NOT NULL,
  mp_transaction_amount NUMERIC NOT NULL,
  mp_description TEXT,
  mp_payer_name TEXT,
  -- Link to comprobante if facturado
  comprobante_id UUID REFERENCES comprobantes(id),
  -- Error detail if fallido
  error_message TEXT,
  -- Metadata
  batch_job_id UUID REFERENCES mp_batch_jobs(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (contribuyente_id, mp_payment_id)
);

CREATE INDEX idx_mp_conciliaciones_contribuyente
  ON mp_conciliaciones(contribuyente_id);
CREATE INDEX idx_mp_conciliaciones_status
  ON mp_conciliaciones(contribuyente_id, status);
CREATE INDEX idx_mp_conciliaciones_mp_date
  ON mp_conciliaciones(contribuyente_id, mp_date_created DESC);
```

### Table: `mp_batch_jobs`

One row per batch operation. Updated in real-time for frontend progress tracking via Supabase Realtime.

```sql
CREATE TABLE mp_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  successful_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  ignored_items INTEGER NOT NULL DEFAULT 0,
  -- Per-item results: [{ mp_payment_id, status, error?, comprobante_numero? }]
  results JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mp_batch_jobs_contribuyente
  ON mp_batch_jobs(contribuyente_id, created_at DESC);
```

### Column addition to `contribuyentes`

```sql
ALTER TABLE contribuyentes
  ADD COLUMN mp_access_token TEXT;
```

### RLS Policies

Both new tables follow the same pattern as `comprobantes`:

```sql
ALTER TABLE mp_conciliaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_batch_jobs ENABLE ROW LEVEL SECURITY;

-- mp_conciliaciones: own contribuyente only
CREATE POLICY "mp_conciliaciones_select_own" ON mp_conciliaciones FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_insert_own" ON mp_conciliaciones FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_update_own" ON mp_conciliaciones FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));

-- mp_batch_jobs: own contribuyente only
CREATE POLICY "mp_batch_jobs_select_own" ON mp_batch_jobs FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_insert_own" ON mp_batch_jobs FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_update_own" ON mp_batch_jobs FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
```

### Triggers

```sql
CREATE TRIGGER set_updated_at_mp_conciliaciones
  BEFORE UPDATE ON mp_conciliaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_mp_batch_jobs
  BEFORE UPDATE ON mp_batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Enable Realtime

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE mp_batch_jobs;
```

---

## Edge Function: `mercadopago-sync`

New Supabase Edge Function at `supabase/functions/mercadopago-sync/index.ts`.

### Action: `search`

**Request:** `GET /functions/v1/mercadopago-sync?action=search`
- Headers: `Authorization: Bearer <jwt>`, `apikey: <anon_key>`
- Query params: `begin_date` (ISO 8601 with offset), `end_date` (ISO 8601 with offset)

**Flow:**
1. Authenticate user via JWT
2. Fetch `mp_access_token` from `contribuyentes`
3. Call MP API: `GET https://api.mercadopago.com/v1/payments/search?status=approved&range=date_created&begin_date={begin_date}&end_date={end_date}&sort=date_created&criteria=asc`
4. Paginate if needed (MP returns max 30 per page by default; use `offset` param)
5. Query `mp_conciliaciones` for all `mp_payment_id` values belonging to this contribuyente
6. Filter out any payments whose ID already exists in `mp_conciliaciones`
7. Return filtered list

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "12345678",
        "date_created": "2026-05-20T14:30:00.000-03:00",
        "transaction_amount": 15000.00,
        "description": "Servicio de diseño",
        "payer": {
          "first_name": "Juan",
          "last_name": "Pérez"
        }
      }
    ],
    "total": 12,
    "filtered_out": 3
  }
}
```

### Action: `process-batch`

**Request:** `POST /functions/v1/mercadopago-sync?action=process-batch`
```json
{
  "facturar": ["12345678", "12345679", "12345680"],
  "ignorar": ["12345681", "12345682"],
  "payments_data": {
    "12345678": { "transaction_amount": 15000, "date_created": "2026-05-20T14:30:00-03:00", "description": "...", "payer_name": "..." },
    "12345679": { "...": "..." }
  }
}
```

> Note: `payments_data` is sent from the frontend so the backend doesn't need to re-fetch from MP API. This map contains the metadata for each payment needed for invoicing and record-keeping.

**Flow:**
1. Authenticate user, get contribuyente + ARCA credentials
2. Create `mp_batch_jobs` row with status='processing', total_items = facturar.length + ignorar.length
3. **Ignorar phase:** Bulk upsert into `mp_conciliaciones` with status='ignorado'. Update batch job: ignored_items, processed_items
4. **Facturar phase (sequential):** For each payment ID:
   a. Determine invoice date from `date_created`, clamped to ARCA fiscal window
   b. Resolve comprobante type via emisor condición IVA
   c. Get last voucher number (use cache pattern from arca-proxy)
   d. Call `arca.electronicBillingService.createVoucher(...)` — same logic as arca-proxy `handleCrearFactura`
   e. On success: insert `comprobantes` row, insert `mp_conciliaciones` with status='facturado' + comprobante_id
   f. On failure: insert `mp_conciliaciones` with status='fallido' + error_message
   g. Update `mp_batch_jobs`: increment processed_items, successful_items or failed_items, append to results JSONB
5. Final update: batch job status='completed' (or 'failed' if ALL failed)

**Date clamping logic:**
```
payment_date = parse(date_created)  // from MP
max_days_back = actividad === 'bienes' ? 5 : 10
earliest_allowed = today - max_days_back
last_emitted = query last emitted date for this comprobante type

effective_date = max(payment_date, earliest_allowed, last_emitted)
if effective_date > today: error — should not happen
```

Since we're processing sequentially and each invoice becomes the new "last emitted", the `last_emitted` constraint naturally satisfies itself after the first invoice.

**Important:** Sort `facturar` array by `date_created` ascending before processing, so older payments are invoiced first. This ensures chronological order matches ARCA's requirement that invoice dates be non-decreasing.

---

## Frontend Architecture

### New Files

```
src/app/features/facturar/
  mercadopago-import-modal.component.ts    # The modal component
src/app/core/services/
  mercadopago.service.ts                   # Service for MP API calls + Realtime
src/app/features/configuracion/
  configuracion-mercadopago-form.component.ts  # MP token config section
```

### Component: `MercadopagoImportModalComponent`

Standalone component, opened from `facturar-nuevo.component.ts`.

**Signals:**
- `isOpen: signal<boolean>`
- `payments: signal<MpPayment[]>` — filtered payments from search
- `selectedIds: signal<Set<string>>` — checked payment IDs (all selected by default)
- `loading: signal<boolean>` — search in progress
- `processing: signal<boolean>` — batch in progress
- `batchJob: signal<MpBatchJob | null>` — realtime progress
- `beginDate: signal<string>` — date input
- `endDate: signal<string>` — date input (default: today 23:59:59)
- `searchError: signal<string | null>`

**Template structure:**
1. Backdrop overlay (click to close, unless processing)
2. Modal card (max-w-4xl, max-h-90vh, scrollable body)
3. Header: "Importar desde Mercado Pago" + close button
4. Date range picker: two `<input type="datetime-local">` with default values
5. Search button → calls service
6. Results table with columns: ☑ | Fecha | Monto | Descripción | Pagador
7. Select all / deselect all toggle
8. Footer: count of selected + "Procesar Lote" button
9. Progress overlay (shown during processing): progress bar + counter + current status

**States:**
- **Empty:** just date picker + search button
- **Loaded:** table with results, checkboxes, process button
- **Processing:** progress bar with realtime updates, no interaction allowed
- **Completed:** summary card (N exitosas, M fallidas, K ignoradas) + "Reintentar fallidas" button if any failed + "Cerrar" button

### Service: `MercadopagoService`

```typescript
@Injectable({ providedIn: 'root' })
export class MercadopagoService {
  // Search MP payments
  async searchPayments(beginDate: string, endDate: string): Promise<MpSearchResult>

  // Process batch (facturar + ignorar)
  async processBatch(payload: MpBatchPayload): Promise<{ batchJobId: string }>

  // Subscribe to batch job progress via Supabase Realtime
  subscribeToBatchJob(jobId: string, callback: (job: MpBatchJob) => void): RealtimeChannel

  // Retry failed items from a previous batch
  async retryFailed(batchJobId: string): Promise<{ batchJobId: string }>

  // Get default begin_date (last processed MP date - 2 days)
  async getDefaultBeginDate(contribuyenteId: string): Promise<string>
}
```

### Configuración: MP Token Section

Add a new accordion/section in `configuracion.component.ts` for Mercado Pago:
- Single input field for Access Token (password type, with show/hide toggle)
- Save button
- Status indicator: "Conectado" / "No configurado"
- Link to MP developer docs for obtaining the token

### Integration with `facturar-nuevo.component.ts`

Minimal changes:
- Import `MercadopagoImportModalComponent`
- Add button in template next to +CUIT toggle
- Signal `mpModalOpen: signal<boolean>`
- After modal closes with success, refresh recent invoices list

---

## Data Flow Diagram

```
User clicks "Importar desde Mercado Pago"
    │
    ▼
Modal opens → date picker (defaults: last_mp_date-2d to today)
    │
    ▼ User clicks "Buscar"
    │
Frontend → GET mercadopago-sync?action=search&begin_date=...&end_date=...
    │
    ▼
Edge Function:
  1. Fetch MP API /v1/payments/search
  2. Query mp_conciliaciones for existing IDs
  3. Filter out already-processed
  4. Return filtered payments
    │
    ▼
Modal shows table → user checks/unchecks → clicks "Procesar Lote"
    │
    ▼
Frontend → POST mercadopago-sync?action=process-batch
           { facturar: [...], ignorar: [...], payments_data: {...} }
    │
    ▼
Edge Function:
  1. Create mp_batch_jobs row (status=processing)
  2. Bulk upsert ignorar → mp_conciliaciones (status=ignorado)
  3. Sequential loop over facturar (sorted by date ASC):
     a. Clamp date to fiscal window
     b. Resolve comprobante type
     c. Get/cache last voucher number
     d. createVoucher via arca-sdk
     e. Insert comprobantes + mp_conciliaciones
     f. Update mp_batch_jobs (processed_items++, results append)
        ← Supabase Realtime notifies frontend
  4. Final: mp_batch_jobs status=completed
    │
    ▼
Frontend (via Realtime subscription):
  - Updates progress bar in real-time
  - Shows summary when completed
  - Offers "Reintentar fallidas" if any failed
```

---

## Error Handling

| Scenario | Handling |
|---|---|
| MP access token missing | Modal shows "Configurá tu token de Mercado Pago en Configuración" with link |
| MP API returns error | Show error message, let user retry search |
| MP API rate limit | Show friendly message, suggest waiting |
| ARCA maintenance during batch | Mark individual item as 'fallido', continue with next |
| ARCA auth error during batch | Mark item as 'fallido' with message, continue (may fail all remaining) |
| Network error during batch | Mark as 'fallido', continue |
| Edge Function timeout (>60s) | Batch job stays in 'processing'. Frontend detects stale job (no update in 30s) and shows warning. User can check `mp_conciliaciones` to see what completed |
| Duplicate payment ID | UNIQUE constraint on `(contribuyente_id, mp_payment_id)` prevents duplicates. Search action filters these out before showing |
| Invoice date outside fiscal window | Clamp to nearest valid date automatically |

---

## Scope Boundaries

**In scope:**
- MP payment search + display
- Batch invoice emission to Consumidor Final
- Ignore/skip workflow
- Real-time progress
- Retry failed items
- MP token configuration

**Out of scope (future):**
- MP OAuth flow (user pastes token manually for now)
- Invoicing to identified clients (always Consumidor Final)
- MP refund handling
- Automatic/scheduled imports
- MP webhook integration
- Splitting a single payment into multiple invoices
