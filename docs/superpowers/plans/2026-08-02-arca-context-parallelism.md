# ARCA Context Parallelism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlap JWT verification with invoice-context loading and persist safe per-stage timings without adding a successful-path round trip.

**Architecture:** A small shared helper starts authentication and context promises in the same turn and fails closed through `Promise.all`. The existing durable finalization RPC receives the current `RequestTimings` snapshot and stores it on `arca_emisiones`; existing failure-state writes receive the same snapshot.

**Tech Stack:** Supabase Edge Functions, Deno, TypeScript, PostgreSQL/PLpgSQL, Supabase JS, Angular/Vitest.

---

### Task 1: Parallel Context Helper

**Files:**
- Create: `supabase/functions/_shared/parallel-context.ts`
- Create: `supabase/functions/_shared/parallel-context.test.ts`

- [ ] **Step 1: Write the failing concurrency tests**

```ts
import { verifyAndLoadContext } from './parallel-context.ts';

Deno.test('verifyAndLoadContext starts auth and context before either resolves', async () => {
  const started: string[] = [];
  let resolveAuth!: (value: string) => void;
  let resolveContext!: (value: { id: string }) => void;

  const result = verifyAndLoadContext(
    () => new Promise((resolve) => {
      started.push('auth');
      resolveAuth = resolve;
    }),
    () => new Promise((resolve) => {
      started.push('context');
      resolveContext = resolve;
    }),
  );

  await Promise.resolve();
  assertEquals(started, ['auth', 'context']);
  resolveContext({ id: 'context-1' });
  resolveAuth('user-1');
  assertEquals(await result, { userId: 'user-1', context: { id: 'context-1' } });
});

Deno.test('verifyAndLoadContext rejects when either operation fails', async () => {
  await assertRejects(() =>
    verifyAndLoadContext(
      async () => {
        throw new Error('Sesion invalida');
      },
      async () => ({ id: 'context-1' }),
    )
  );
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx -y deno@2.5.6 test --node-modules-dir=auto supabase/functions/_shared/parallel-context.test.ts
```

Expected: FAIL because `parallel-context.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export async function verifyAndLoadContext<T>(
  verifyUser: () => PromiseLike<string>,
  loadContext: () => PromiseLike<T>,
): Promise<{ userId: string; context: T }> {
  const authPromise = Promise.resolve().then(verifyUser);
  const contextPromise = Promise.resolve().then(loadContext);
  const [userId, context] = await Promise.all([authPromise, contextPromise]);
  return { userId, context };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run the command from Step 2. Expected: all helper tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add supabase/functions/_shared/parallel-context.ts supabase/functions/_shared/parallel-context.test.ts
git commit -m "perf(arca): parallelize verified context loading"
```

### Task 2: Durable Timing Schema

**Files:**
- Create: `supabase/migrations/20260803010000_add_arca_emission_timings.sql`
- Modify: `supabase/schema.sql`
- Modify: `src/app/core/types/database.types.ts`

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260803010000_add_arca_emission_timings.sql`. Add `request_timings jsonb` to `arca_emisiones`. Drop the six-argument `finalize_arca_emission` overload and recreate it with:

```sql
p_request_timings jsonb default null
```

The existing emission update inside the function must include:

```sql
request_timings = coalesce(p_request_timings, request_timings)
```

Revoke public execution and grant the exact seven-argument signature to `authenticated`.

- [ ] **Step 2: Update checked-in schema and generated TypeScript shape**

Add `request_timings: Json | null` to `arca_emisiones.Row`, and optional `request_timings?: Json | null` to Insert/Update. Update the RPC argument shape with optional `p_request_timings?: Json | null`.

- [ ] **Step 3: Validate SQL and diff**

Run:

```powershell
git diff --check
npx supabase db lint --local
```

Expected: no new SQL errors. If the local Supabase stack is unavailable, validate by applying the migration to homologation only after Edge tests pass.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations supabase/schema.sql src/app/core/types/database.types.ts
git commit -m "feat(arca): persist emission stage timings"
```

### Task 3: Integrate Parallel Preparation and Timing Snapshots

**Files:**
- Modify: `supabase/functions/arca-proxy/index.ts`
- Create: `supabase/functions/_shared/arca-emission-timing.ts`
- Create: `supabase/functions/_shared/arca-emission-timing.test.ts`
- Test: `supabase/functions/_shared/parallel-context.test.ts`

- [ ] **Step 1: Add a failing timing-safety test**

Write `arca-emission-timing.test.ts` against a not-yet-existing `getEmissionTimingSnapshot`. The test supplies a `toJSON()` result containing valid stage numbers plus invalid string/object values and expects only finite numeric values:

```ts
assertEquals(
  getEmissionTimingSnapshot({
    toJSON: () => ({
      auth: 100,
      invoice_context_db: 200,
      total: 350,
      token: 'secret',
      payload: { doc_nro: 1 },
    } as unknown as Record<string, number>),
  }),
  { auth: 100, invoice_context_db: 200, total: 350 },
);
```

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
npx -y deno@2.5.6 test --node-modules-dir=auto supabase/functions/_shared/parallel-context.test.ts supabase/functions/_shared/http-observability.test.ts
```

Expected: FAIL because `arca-emission-timing.ts` does not exist.

- [ ] **Step 3: Implement the safe snapshot helper**

```ts
export function getEmissionTimingSnapshot(
  timings?: { toJSON(): Record<string, number> },
): Record<string, number> | null {
  if (!timings) return null;
  return Object.fromEntries(
    Object.entries(timings.toJSON()).filter(
      ([, value]) => typeof value === 'number' && Number.isFinite(value),
    ),
  );
}
```

- [ ] **Step 4: Parallelize invoice context**

Refactor `getUserArcaInvoiceContext` to:

```ts
const authHeader = requireBearerHeader(params.req);
const supabaseUser = getSupabaseClient(authHeader);
const token = authHeader.slice('Bearer '.length).trim();

const { context: contextResult } = await verifyAndLoadContext(
  () => measureStage(params.timings, 'auth', () => getVerifiedUserId(supabaseUser.auth, token)),
  () => measureStage(params.timings, 'invoice_context_db', loadContext),
);
```

Validate the RPC error only after both operations complete. Construct `Arca` only from the validated result. Keep `getAuthenticatedUser` unchanged for other endpoints.

- [ ] **Step 5: Persist snapshots through existing writes**

Pass `getEmissionTimingSnapshot(timings)` as `p_request_timings` in `finalizeAuthorizedEmission`. Add the same sanitized `request_timings` value to values written by `updateEmissionStatus` whenever an existing failure/status write occurs. Do not create telemetry-only writes.

- [ ] **Step 6: Run focused tests and Edge type checks**

```powershell
npx -y deno@2.5.6 test --node-modules-dir=auto supabase/functions/_shared/*.test.ts
npx -y deno@2.5.6 check --node-modules-dir=auto supabase/functions/arca-proxy/index.ts
```

Expected: all tests and type checks PASS.

- [ ] **Step 7: Commit**

```powershell
git add supabase/functions src/app/core/utils/arca-edge-helpers.spec.ts
git commit -m "perf(arca): overlap authentication and invoice context"
```

### Task 4: Full Verification and Homologation Deployment

**Files:**
- No additional source files expected.

- [ ] **Step 1: Run repository verification**

```powershell
npm run test:facturar
npm test -- --watch=false
npm run build
git diff --check
```

Expected: 32 facturation tests, the full suite, and production build all pass.

- [ ] **Step 2: Apply the migration**

Apply the new migration to Supabase project `ifkfofyylfkxwtxvyewi` and verify `arca_emisiones.request_timings` and the seven-argument RPC signature exist.

- [ ] **Step 3: Deploy `arca-proxy`**

```powershell
npx supabase functions deploy arca-proxy --project-ref ifkfofyylfkxwtxvyewi
```

Expected: deployment succeeds and the new version is ACTIVE.

- [ ] **Step 4: Smoke test without fiscal emission**

Call a validation-only request and confirm HTTP 400 with a `Server-Timing` header. Confirm no `arca_emisiones` row was created.

- [ ] **Step 5: Publish and measure**

After integration to `main`, emit three homologation invoices. Query their `request_timings`, durable interval, and Edge execution times and compare them with invoices 70-72.
