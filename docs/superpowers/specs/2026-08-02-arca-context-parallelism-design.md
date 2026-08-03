# ARCA Context Parallelism Design

## Goal

Reduce the fixed latency before `createVoucher` without weakening authentication, changing voucher numbering, or adding database round trips to the successful emission path.

## Evidence

The first three durable homologation emissions completed in 2,821 ms, 2,340 ms, and 2,059 ms. The interval from inserting `arca_emisiones` through ARCA authorization and transactional persistence remained between 604 ms and 641 ms. Therefore, 1,418-2,217 ms occurred before the durable attempt was registered.

The current invoice context flow waits for `auth.getClaims()` before starting `get_arca_invoice_context`. The RPC independently validates the same bearer token through PostgREST and derives ownership from `auth.uid()`, so those requests do not depend on each other's result.

## Design

### Parallel context preparation

- Create the authenticated Supabase client and extract the bearer token synchronously.
- Start verified-claims authentication and `get_arca_invoice_context` concurrently.
- Await both with fail-closed semantics before constructing the ARCA SDK instance or using contributor data.
- Preserve explicit claims verification even though PostgREST also validates the JWT. Removing it is outside this iteration.

Both operations must succeed. A failed or invalid token, a failed RPC, or missing contributor configuration returns the existing error behavior and prevents any ARCA call.

### Durable timing instrumentation

- Add a nullable `request_timings jsonb` column to `arca_emisiones`.
- Extend `finalize_arca_emission` with an optional timings argument.
- Pass a snapshot of `RequestTimings` through the existing finalization RPC. This records completed stages without adding a network request.
- Store preparation metrics on rejected, uncertain, and conflict attempts through the existing status update when that update already occurs.
- Do not add a synchronous telemetry-only database write.

The stored snapshot may include `body_parse`, `auth`, `invoice_context_db`, `attempt_write`, `arca_create`, `arca_voucher_info`, and other measured stage durations. It must never contain certificates, tickets, tokens, payload documents, or customer data.

### Ordering constraints

The following operations remain sequential:

- Resolve a fresh last voucher before selecting a number when cache is absent.
- Register the durable attempt before calling `createVoucher`.
- Query `getVoucherInfo` before retrying an ambiguous or numbering failure.
- Persist authorization and update numbering cache transactionally.

No certificate, private key, ticket, or contributor context is cached in Edge process memory in this iteration.

## Failure Handling

- Parallel work uses `Promise.all`; either failure aborts the request.
- No ARCA SDK instance is exposed to the handler until authentication and context both succeed.
- Timing persistence is part of existing writes and cannot authorize or change an emission.
- Existing idempotency, recovery, conflict, and retry behavior remains unchanged.

## Verification

- Unit-test a shared parallel-context helper to prove both operations start before either resolves and that either rejection fails closed.
- Unit-test timing snapshots passed to finalization and status updates.
- Run Edge tests and type checks, `npm run test:facturar`, the full Angular suite, and `npm run build`.
- Deploy to homologation and emit three invoices with a fresh browser session.
- Compare persisted `auth`, `invoice_context_db`, pre-attempt, ARCA, durable, and total timings against invoices 70-72.

## Success Criteria

- No authorization, numbering, persistence, or reconciliation regression.
- All successful emissions contain a safe timing snapshot.
- Authentication and context loading overlap in production traces.
- Median Edge execution time improves without increasing errors or retries.
