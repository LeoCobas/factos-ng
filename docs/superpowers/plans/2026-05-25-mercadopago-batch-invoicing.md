# Mercado Pago Batch Invoicing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users import approved payments from Mercado Pago and batch-emit invoices to "Consumidor Final" with real-time progress via Supabase Realtime.

**Architecture:** New Edge Function `mercadopago-sync` (Deno) with two actions (search, process-batch). Frontend: Angular modal component in the `facturar` feature. Progress tracked via `mp_batch_jobs` table + Supabase Realtime subscription. Three new DB tables: `mp_batch_jobs`, `mp_conciliaciones`, plus a column `mp_access_token` on `contribuyentes`.

**Tech Stack:** Angular 21, Tailwind CSS, Supabase Edge Functions (Deno), Supabase Realtime, arca-sdk, Mercado Pago REST API.

**Spec:** `docs/superpowers/specs/2026-05-25-mercadopago-batch-invoicing-design.md`

---

## File Map

### Database
- **Create:** `supabase/migrations/20260525030000_add_mercadopago_tables.sql` — migration for `mp_batch_jobs`, `mp_conciliaciones`, `mp_access_token` column, RLS, triggers, Realtime

### Backend (Edge Function)
- **Create:** `supabase/functions/mercadopago-sync/index.ts` — Edge Function with `search` and `process-batch` actions

### Frontend — Core
- **Create:** `src/app/core/services/mercadopago.service.ts` — service for MP API calls + Realtime subscriptions
- **Create:** `src/app/core/types/mercadopago.types.ts` — TypeScript types for MP payments, batch jobs, conciliaciones
- **Modify:** `src/app/core/types/database.types.ts` — add `mp_access_token` to Contribuyente types, add new table types

### Frontend — Feature
- **Create:** `src/app/features/facturar/mercadopago-import-modal.component.ts` — the import modal component
- **Modify:** `src/app/features/facturar/facturar-nuevo.component.ts` — add MP import button + modal integration
- **Create:** `src/app/features/configuracion/configuracion-mercadopago-form.component.ts` — MP token config section
- **Modify:** `src/app/features/configuracion/configuracion.component.ts` — add MP tab
- **Modify:** `src/app/features/configuracion/configuracion.types.ts` — add TabId 'mercadopago'

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260525030000_add_mercadopago_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ============================================================
-- Mercado Pago integration: tables, RLS, triggers, Realtime
-- ============================================================

-- 1. Add MP access token to contribuyentes
ALTER TABLE contribuyentes
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT;

-- 2. Batch jobs table (Realtime-enabled for progress tracking)
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
  results JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mp_batch_jobs_contribuyente
  ON mp_batch_jobs(contribuyente_id, created_at DESC);

-- 3. Conciliaciones table (tracks processed MP payment IDs)
CREATE TABLE mp_conciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribuyente_id UUID NOT NULL REFERENCES contribuyentes(id) ON DELETE CASCADE,
  mp_payment_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('facturado', 'ignorado', 'fallido')),
  mp_date_created TIMESTAMPTZ NOT NULL,
  mp_transaction_amount NUMERIC NOT NULL,
  mp_description TEXT,
  mp_payer_name TEXT,
  comprobante_id UUID REFERENCES comprobantes(id),
  error_message TEXT,
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

-- 4. RLS policies
ALTER TABLE mp_batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mp_conciliaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mp_batch_jobs_select_own" ON mp_batch_jobs FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_insert_own" ON mp_batch_jobs FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_batch_jobs_update_own" ON mp_batch_jobs FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));

CREATE POLICY "mp_conciliaciones_select_own" ON mp_conciliaciones FOR SELECT
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_insert_own" ON mp_conciliaciones FOR INSERT
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));
CREATE POLICY "mp_conciliaciones_update_own" ON mp_conciliaciones FOR UPDATE
  USING (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (contribuyente_id IN (SELECT id FROM contribuyentes WHERE user_id = (SELECT auth.uid())));

-- 5. Triggers (reuse existing update_updated_at_column)
CREATE TRIGGER set_updated_at_mp_batch_jobs
  BEFORE UPDATE ON mp_batch_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at_mp_conciliaciones
  BEFORE UPDATE ON mp_conciliaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Enable Realtime for batch jobs progress
ALTER PUBLICATION supabase_realtime ADD TABLE mp_batch_jobs;
```

- [ ] **Step 2: Apply migration**

Run: `npx supabase db push` (or `npx supabase migration up` depending on environment)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260525030000_add_mercadopago_tables.sql
git commit -m "feat(db): add Mercado Pago tables (mp_batch_jobs, mp_conciliaciones, mp_access_token)"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/app/core/types/mercadopago.types.ts`
- Modify: `src/app/core/types/database.types.ts`

- [ ] **Step 1: Create MP types file**

Create `src/app/core/types/mercadopago.types.ts`:

```typescript
/** A single payment from the MP /v1/payments/search API, filtered to the fields we use. */
export interface MpPayment {
  id: string;
  date_created: string; // ISO 8601 with offset
  transaction_amount: number;
  description: string | null;
  payer: {
    first_name: string | null;
    last_name: string | null;
  };
}

/** Response from mercadopago-sync?action=search */
export interface MpSearchResult {
  success: boolean;
  data?: {
    payments: MpPayment[];
    total: number;
    filtered_out: number;
  };
  error?: string;
}

/** Payload for mercadopago-sync?action=process-batch */
export interface MpBatchPayload {
  facturar: string[];
  ignorar: string[];
  payments_data: Record<string, MpPaymentData>;
}

/** Per-payment metadata sent to the backend */
export interface MpPaymentData {
  transaction_amount: number;
  date_created: string;
  description: string | null;
  payer_name: string | null;
}

/** Per-item result within mp_batch_jobs.results JSONB */
export interface MpBatchItemResult {
  mp_payment_id: string;
  status: 'facturado' | 'ignorado' | 'fallido';
  error?: string;
  comprobante_numero?: string;
}

/** Row shape of mp_batch_jobs table */
export interface MpBatchJob {
  id: string;
  contribuyente_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  ignored_items: number;
  results: MpBatchItemResult[];
  created_at: string;
  updated_at: string;
}

/** Response from mercadopago-sync?action=process-batch */
export interface MpProcessBatchResponse {
  success: boolean;
  data?: {
    batch_job_id: string;
  };
  error?: string;
}
```

- [ ] **Step 2: Update database types**

Add `mp_access_token` to the Contribuyente Row, Insert, and Update types in `src/app/core/types/database.types.ts`:

In the `contribuyentes.Row` interface, add after `arca_ticket`:
```typescript
          mp_access_token: string | null;
```

In `contribuyentes.Insert`, add after `arca_ticket`:
```typescript
          mp_access_token?: string | null;
```

In `contribuyentes.Update`, add after `arca_ticket`:
```typescript
          mp_access_token?: string | null;
```

- [ ] **Step 3: Commit**

```bash
git add src/app/core/types/mercadopago.types.ts src/app/core/types/database.types.ts
git commit -m "feat(types): add Mercado Pago types and mp_access_token to Contribuyente"
```

---

### Task 3: MercadoPago Service

**Files:**
- Create: `src/app/core/services/mercadopago.service.ts`

- [ ] **Step 1: Create the service**

Create `src/app/core/services/mercadopago.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { getRuntimeConfig } from '../config/runtime-config';
import { supabase, getSupabaseClient } from './supabase.service';
import { ContribuyenteService } from './contribuyente.service';
import { getFriendlyNetworkErrorMessage } from '../utils/network-error.util';
import type {
  MpSearchResult,
  MpBatchPayload,
  MpProcessBatchResponse,
  MpBatchJob,
} from '../types/mercadopago.types';
import type { RealtimeChannel } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class MercadopagoService {
  private readonly contribuyenteService = inject(ContribuyenteService);

  /** Check if the user has an MP access token configured. */
  hasMpToken(): boolean {
    return !!this.contribuyenteService.contribuyente()?.mp_access_token;
  }

  /** Search approved MP payments for a date range, excluding already-processed ones. */
  async searchPayments(beginDate: string, endDate: string): Promise<MpSearchResult> {
    try {
      const accessToken = await this.getFreshAccessToken();
      const params = new URLSearchParams({
        begin_date: beginDate,
        end_date: endDate,
      });

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/mercadopago-sync?action=search&${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: getRuntimeConfig().supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const data: MpSearchResult = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al buscar pagos de Mercado Pago');
      }

      return data;
    } catch (error) {
      throw new Error(
        getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error al buscar pagos de Mercado Pago',
        ),
      );
    }
  }

  /** Submit a batch for processing (facturar + ignorar). Returns the batch job ID. */
  async processBatch(payload: MpBatchPayload): Promise<string> {
    try {
      const accessToken = await this.getFreshAccessToken();

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/mercadopago-sync?action=process-batch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: getRuntimeConfig().supabase.anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const data: MpProcessBatchResponse = await response.json();

      if (!response.ok || !data.success || !data.data?.batch_job_id) {
        throw new Error(data.error || 'Error al procesar el lote');
      }

      return data.data.batch_job_id;
    } catch (error) {
      throw new Error(
        getFriendlyNetworkErrorMessage(
          error,
          error instanceof Error ? error.message : 'Error al procesar el lote',
        ),
      );
    }
  }

  /**
   * Subscribe to real-time updates on a batch job.
   * The callback fires on every UPDATE to the row.
   * Returns the RealtimeChannel so the caller can unsubscribe.
   */
  subscribeToBatchJob(
    jobId: string,
    callback: (job: MpBatchJob) => void,
  ): RealtimeChannel {
    const channel = getSupabaseClient()
      .channel(`mp-batch-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mp_batch_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          callback(payload.new as MpBatchJob);
        },
      )
      .subscribe();

    return channel;
  }

  /** Unsubscribe from a Realtime channel. */
  unsubscribe(channel: RealtimeChannel): void {
    getSupabaseClient().removeChannel(channel);
  }

  /**
   * Get the default begin_date for the search.
   * = last processed MP date - 2 days, or 30 days ago if none.
   */
  async getDefaultBeginDate(): Promise<string> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      return this.daysAgo(30);
    }

    const { data, error } = await supabase
      .from('mp_conciliaciones')
      .select('mp_date_created')
      .eq('contribuyente_id', contribuyente.id)
      .order('mp_date_created', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data?.mp_date_created) {
      return this.daysAgo(30);
    }

    // Subtract 2 days from the last processed date
    const lastDate = new Date(data.mp_date_created);
    lastDate.setDate(lastDate.getDate() - 2);
    return this.formatDatetimeLocalAR(lastDate);
  }

  /** Get today at 23:59:59 in Argentina timezone as ISO string. */
  getDefaultEndDate(): string {
    const now = new Date();
    // Set to end of today
    now.setHours(23, 59, 59, 0);
    return this.formatDatetimeLocalAR(now);
  }

  /** Format a Date for the datetime-local input (YYYY-MM-DDTHH:mm). */
  private formatDatetimeLocalAR(date: Date): string {
    // Format in Argentina timezone
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  }

  /** Format a datetime-local value to ISO 8601 with Argentina offset. */
  formatToISOWithOffset(datetimeLocal: string): string {
    // datetime-local gives us "YYYY-MM-DDTHH:mm"
    // We add Argentina offset -03:00
    return `${datetimeLocal}:00.000-03:00`;
  }

  private daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return this.formatDatetimeLocalAR(date);
  }

  private async getFreshAccessToken(): Promise<string> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No hay sesión activa');
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
    const shouldRefresh = expiresAtMs !== null && expiresAtMs - Date.now() < 60_000;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        throw new Error('No se pudo refrescar la sesión');
      }
      const refreshedToken = data.session?.access_token;
      if (refreshedToken) {
        return refreshedToken;
      }
    }

    if (!session.access_token) {
      throw new Error('No se pudo obtener un token de sesión válido');
    }

    return session.access_token;
  }

  private get supabaseUrl(): string {
    return getRuntimeConfig().supabase.url;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/core/services/mercadopago.service.ts
git commit -m "feat(service): add MercadopagoService for MP search, batch processing, and Realtime"
```

---

### Task 4: Edge Function — mercadopago-sync

**Files:**
- Create: `supabase/functions/mercadopago-sync/index.ts`

- [ ] **Step 1: Create the Edge Function**

Create `supabase/functions/mercadopago-sync/index.ts`. This is a large file — it handles authentication, MP API calls, ARCA invoicing, and batch job progress updates. The file follows the same patterns as `supabase/functions/arca-proxy/index.ts`.

The function must:
1. `action=search`: Authenticate user → get `mp_access_token` from contribuyentes → call MP API `/v1/payments/search` → paginate → filter out existing `mp_conciliaciones` → return
2. `action=process-batch`: Authenticate user → create `mp_batch_jobs` row → bulk upsert ignorar → sequential facturar with ARCA → update progress after each item → final status update

Key implementation details:
- Reuse ARCA ticket management from `arca-proxy` (import shared utils)
- Use `Arca` from `npm:@arcasdk/core@0.3.6` for invoice creation
- Sort `facturar` items by `date_created` ascending before processing
- Clamp invoice dates to ARCA fiscal window
- Use service_role key for `mp_batch_jobs` updates (to bypass RLS during processing, since the Edge Function authenticates as the user for data reads but needs to update the batch job table reliably)

- [ ] **Step 2: Implement the full Edge Function**

The implementation follows the same structure as `arca-proxy/index.ts`:
- CORS headers
- `getAuthenticatedUser()` pattern
- Supabase client with auth header
- Action routing via URL params

See the spec for exact API contracts and flow details.

- [ ] **Step 3: Deploy and test**

Run: `npx supabase functions deploy mercadopago-sync`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/mercadopago-sync/index.ts
git commit -m "feat(edge-fn): add mercadopago-sync Edge Function (search + process-batch)"
```

---

### Task 5: Configuración — MP Token Section

**Files:**
- Create: `src/app/features/configuracion/configuracion-mercadopago-form.component.ts`
- Modify: `src/app/features/configuracion/configuracion.types.ts`
- Modify: `src/app/features/configuracion/configuracion.component.ts`

- [ ] **Step 1: Update TabId type**

In `src/app/features/configuracion/configuracion.types.ts`, change line 3:

From:
```typescript
export type TabId = 'facturacion' | 'certificado' | 'cuenta';
```
To:
```typescript
export type TabId = 'facturacion' | 'certificado' | 'mercadopago' | 'cuenta';
```

- [ ] **Step 2: Create the MP config form component**

Create `src/app/features/configuracion/configuracion-mercadopago-form.component.ts`:

A standalone component with:
- Input: `token` (current saved token, masked), `guardando` signal, `mensaje` signal
- Output: `guardar` event with the new token value
- Template: password-type input with show/hide toggle, save button, help link to MP dev docs
- Follows the same visual pattern as `configuracion-certificado-form.component.ts`

- [ ] **Step 3: Add MP tab to configuracion.component.ts**

Add a new tab button in the template (between certificado and cuenta tabs) with an MP icon (credit card or wallet SVG).

Add the tab content section:
```html
@if (tabActiva() === 'mercadopago') {
  <app-configuracion-mercadopago-form
    [tieneToken]="tieneMpToken()"
    [guardando]="guardandoMercadoPago()"
    [mensaje]="mensaje()"
    (guardar)="guardarMpToken($event)"
  />
}
```

Add the corresponding signals and method:
- `tieneMpToken = computed(() => !!this.contribuyenteService.contribuyente()?.mp_access_token)`
- `guardandoMercadoPago = computed(() => this.guardando() && this.tabActiva() === 'mercadopago')`
- `async guardarMpToken(token: string)` — calls `contribuyenteService.actualizarContribuyente({ mp_access_token: token })`

- [ ] **Step 4: Commit**

```bash
git add src/app/features/configuracion/
git commit -m "feat(config): add Mercado Pago access token configuration tab"
```

---

### Task 6: Import Modal Component

**Files:**
- Create: `src/app/features/facturar/mercadopago-import-modal.component.ts`

- [ ] **Step 1: Create the modal component**

Create `src/app/features/facturar/mercadopago-import-modal.component.ts`:

A standalone component with inline template using Tailwind CSS. Structure:

**Inputs:** `isOpen` (model signal for two-way binding)
**Outputs:** `batchCompleted` (emits when a batch finishes successfully)

**Signals:**
- `payments: signal<MpPayment[]>` — search results
- `selectedIds: signal<Set<string>>` — checked payment IDs
- `loading: signal<boolean>` — search in progress
- `processing: signal<boolean>` — batch in progress
- `batchJob: signal<MpBatchJob | null>` — realtime progress data
- `beginDate: signal<string>` — date input value
- `endDate: signal<string>` — date input value
- `searchError: signal<string | null>`
- `batchError: signal<string | null>`
- `showSummary: signal<boolean>` — show result summary

**Computed:**
- `allSelected` — whether all items are checked
- `selectedCount` — number of checked items
- `progressPercent` — batchJob processed_items / total_items * 100

**Template sections:**
1. Backdrop (click to close if not processing)
2. Modal card with header + close X
3. **Search state:** date range pickers + "Buscar" button
4. **Results state:** scrollable table (Fecha, Monto, Descripción, Pagador, checkbox), select all toggle, "Procesar Lote (N)" button
5. **Processing state:** progress bar, "Procesando 3/15..." text, animated spinner
6. **Summary state:** success/failure counts, item list with status icons, "Reintentar fallidas" button if any failed, "Cerrar" button

**Methods:**
- `buscarPagos()` — calls `mercadopagoService.searchPayments()`, sets `payments`, pre-selects all
- `toggleSelectAll()` — select/deselect all
- `togglePayment(id)` — toggle single payment
- `procesarLote()` — builds payload, calls `mercadopagoService.processBatch()`, subscribes to Realtime
- `reintentarFallidas()` — re-processes only failed items from last batch
- `cerrar()` — cleanup + close

**Lifecycle:**
- On open: auto-load default dates, auto-search if token exists
- On destroy: unsubscribe from Realtime channel

- [ ] **Step 2: Commit**

```bash
git add src/app/features/facturar/mercadopago-import-modal.component.ts
git commit -m "feat(modal): add MercadoPago import modal with search, batch, and Realtime progress"
```

---

### Task 7: Integrate Modal into Facturar

**Files:**
- Modify: `src/app/features/facturar/facturar-nuevo.component.ts`

- [ ] **Step 1: Add modal integration**

In `facturar-nuevo.component.ts`:

1. Add import: `MercadopagoImportModalComponent`
2. Add to `imports` array in `@Component`
3. Add signal: `mpModalOpen = signal(false)`
4. Add method: `onMpBatchCompleted()` that calls `this.cargarFacturasRecientes()`

5. Add button in template — in the `<div class="flex items-start justify-end">` section (line ~80), before the +CUIT button:

```html
<button
  type="button"
  (click)="mpModalOpen.set(true)"
  class="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/35 px-2.5 py-1.5 text-[0.72rem] font-semibold tracking-[0.08em] text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted/55 hover:text-foreground sm:px-3 sm:text-xs"
>
  <span>MP</span>
</button>
```

6. Add modal at the end of the template (before the closing `</div>`):

```html
<app-mercadopago-import-modal
  [(isOpen)]="mpModalOpen"
  (batchCompleted)="onMpBatchCompleted()"
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/features/facturar/facturar-nuevo.component.ts
git commit -m "feat(facturar): add Mercado Pago import button and modal integration"
```

---

### Task 8: End-to-End Verification

- [ ] **Step 1: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No lint errors in new/modified files.

- [ ] **Step 3: Manual verification checklist**

1. Open Configuración → MP tab → paste a token → save → verify it persists on reload
2. Open Facturar → click "MP" button → modal opens
3. Set date range → click "Buscar" → verify payments table loads
4. Check/uncheck items → click "Procesar Lote" → verify progress bar updates in real-time
5. Verify facturado items appear in Listado
6. Verify ignored items don't create comprobantes
7. Verify retry button works for failed items
8. Verify the modal can be closed during search but not during processing
9. Verify dates default correctly (last processed - 2 days)

- [ ] **Step 4: Final commit with all changes**

```bash
git add -A
git commit -m "feat: Mercado Pago batch invoicing integration complete"
```
