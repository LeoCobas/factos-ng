# Factos Sao Paulo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Factos from Supabase `us-east-1` to `sa-east-1` while preserving all application data and retaining a tested rollback path.

**Architecture:** Keep the Virginia project unchanged while a parallel Sao Paulo project is restored and validated. Temporarily pause CC-App to free the second Free-plan slot, cut the frontend over only after backend validation, then pause Virginia and immediately resume CC-App.

**Tech Stack:** Supabase CLI 2.111, Supabase Management MCP, PostgreSQL 17, Angular 21, Netlify runtime configuration, ARCA SDK 2.0.

---

### Task 1: Capture the source baseline

**Files:**
- Create outside Git: `C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/manifest.json`
- Create outside Git: `C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/storage/`

- [ ] **Step 1: Record project state without secrets**

Capture project refs, regions, statuses, migration list, Edge Function versions,
secret names, extension list, Auth count, public table counts, bucket list and
Storage object counts. Do not print API secrets, certificates or private keys.

- [ ] **Step 2: Verify the source remains healthy**

Expected: Factos is `ACTIVE_HEALTHY` in `us-east-1`, CC-App is
`ACTIVE_HEALTHY` in `sa-east-1`, and the latest Factos comprobante is 93 or
higher.

- [ ] **Step 3: Download Storage objects**

Run once per non-empty bucket while linked to Factos, using the bucket names
recorded in the manifest:

```powershell
$manifest = Get-Content C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/manifest.json | ConvertFrom-Json
foreach ($bucket in $manifest.storage_buckets.name) {
  supabase storage cp --linked --recursive "ss:///$bucket" "C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/storage/$bucket"
}
```

Expected: downloaded object count and total bytes match the source manifest.

- [ ] **Step 4: Dump database roles, schema, data and migration history**

```powershell
supabase db dump --linked --role-only --file C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/roles.sql
supabase db dump --linked --file C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/schema.sql
supabase db dump --linked --data-only --use-copy --exclude storage.buckets_vectors --exclude storage.vector_indexes --file C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/data.sql
supabase db dump --linked --schema supabase_migrations --file C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/history-schema.sql
supabase db dump --linked --schema supabase_migrations --data-only --use-copy --file C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/history-data.sql
```

Expected: every command exits 0 and all five files are non-empty.

### Task 2: Free the project slot and create Sao Paulo

**Files:** None.

- [ ] **Step 1: Confirm the project cost**

Expected management API result: `$0 monthly` for the Free organization
`tgdbhmwbmtwwugckcaim`.

- [ ] **Step 2: Pause CC-App**

Pause project `bmusmkjknqmwddqzjrtl` only after Task 1 passes. Poll until the
project is paused and verify Factos remains healthy.

- [ ] **Step 3: Create the target project**

Create `Factos Sao Paulo` in organization `tgdbhmwbmtwwugckcaim`, region
`sa-east-1`, using the confirmed zero-cost operation. Poll until
`ACTIVE_HEALTHY` and record the new project ref in the local manifest.

- [ ] **Step 4: Verify rollback availability**

Expected: source Factos remains `ACTIVE_HEALTHY`; target Factos is
`ACTIVE_HEALTHY`; CC-App is paused and restorable.

### Task 3: Restore database and Auth

**Files:**
- Read: `supabase/migrations/*.sql`
- Read outside Git: `C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/data.sql`

- [ ] **Step 1: Link CLI to the target project**

```powershell
$manifest = Get-Content C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/manifest.json | ConvertFrom-Json
supabase link --project-ref $manifest.target_project_ref
```

Expected: link succeeds using a temporary CLI database role.

- [ ] **Step 2: Reset the empty target from repository migrations and source data**

```powershell
Copy-Item C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/data.sql supabase/.migration-data.sql
supabase db reset --linked --yes --sql-paths .migration-data.sql
Remove-Item -LiteralPath supabase/.migration-data.sql
```

Expected: migrations and data apply without partial commits.

- [ ] **Step 3: Restore or reconcile migration history**

Compare target migration history with the repository and source. Repair history
only after confirming the target schema signatures match the source.

- [ ] **Step 4: Compare data and Auth**

Compare every public table count, `auth.users`, `auth.identities`, latest
comprobante number and every `arca_emisiones` status. Any mismatch blocks the
cutover.

- [ ] **Step 5: Verify migrated login**

Use an existing homologation user to sign in against the target. Existing source
JWTs must fail; a fresh login must succeed without resetting the password.

### Task 4: Restore Storage, functions and secrets

**Files:**
- Read: `supabase/functions/**`
- Read: `supabase/config.toml`

- [ ] **Step 1: Upload Storage objects to matching buckets**

Create missing buckets with the same public/private and size settings, then run
for the exact bucket list from the manifest:

```powershell
$manifest = Get-Content C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/manifest.json | ConvertFrom-Json
foreach ($bucket in $manifest.storage_buckets.name) {
  supabase storage cp --linked --recursive "C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/storage/$bucket" "ss:///$bucket"
}
```

Expected: object counts and total bytes match the source.

- [ ] **Step 2: Deploy every repository Edge Function**

```powershell
$manifest = Get-Content C:/Users/leoco/.codex/migration-artifacts/factos-sao-paulo-2026-08-03/manifest.json | ConvertFrom-Json
supabase functions deploy --project-ref $manifest.target_project_ref
```

Expected: all functions are `ACTIVE`; deployed `arca-proxy` contains
`handleCrearFactura` and `scheduleEmissionTimingPersistence`.

- [ ] **Step 3: Restore custom secrets**

Platform-provided `SUPABASE_URL`, anon and service keys are automatic. Restore
`SYSTEM_ARCA_CERT`, `SYSTEM_ARCA_KEY`, `SYSTEM_ARCA_CUIT` and
`SYSTEM_ARCA_PRODUCTION` from the owner's original secure source. Never copy
secret values into Git or chat output.

- [ ] **Step 4: Verify backend contracts**

Run OPTIONS smoke tests, authenticated prefetch, padrón lookup, Mercado Pago
search and reconciliation. Any 5xx blocks the cutover.

### Task 5: Validate durable homologation emission

**Files:** None.

- [ ] **Step 1: Validate preparation and idempotency**

Call `prepare_arca_emission` with a new UUID, resend the same payload and verify
one attempt. Reuse the UUID with a different amount and verify rejection.

- [ ] **Step 2: Emit one homologation invoice**

Expected: authorized, persisted, cache updated and no retry or recovery.

- [ ] **Step 3: Audit the authorized invoice**

Call `getVoucherInfo` through reconciliation and verify number, date, document,
currency and total.

- [ ] **Step 4: Measure latency**

Emit three additional homologation invoices. Acceptance requires average server
time until persistence at least 300 ms below the 971 ms baseline.

### Task 6: Cut the frontend over

**Files:**
- Modify: `scripts/generate-runtime-config.mjs`
- Modify: `public/app-config.json`
- Modify: `ngsw-config.json`
- Modify: `docs/runtime-config.md`
- Test: `src/app/core/config/runtime-config.spec.ts`

- [ ] **Step 1: Write a failing configuration test**

Assert that generated defaults and PWA API patterns use the target ref recorded
in the migration manifest and contain no production reference to
`ifkfofyylfkxwtxvyewi`.

- [ ] **Step 2: Run the test and verify it fails**

```powershell
npm test -- --include src/app/core/config/**/*.spec.ts
```

Expected: failure because Virginia is still the default.

- [ ] **Step 3: Update runtime and PWA configuration**

Replace only the Supabase URL and public key. Keep the old values in the local
rollback manifest, not in a second production fallback path.

- [ ] **Step 4: Run verification**

```powershell
npm run test:facturar
npm run build
```

Expected: 32 or more facturar tests pass and production build exits 0.

- [ ] **Step 5: Deploy frontend and force PWA refresh**

Update hosting environment variables, deploy, then verify desktop and mobile
load the new `app-config.json` and establish sessions against Sao Paulo.

### Task 7: Finalize or roll back

**Files:**
- Update: `docs/superpowers/specs/2026-08-03-factos-sao-paulo-migration-design.md`

- [ ] **Step 1: Run post-cutover checks**

Verify login, recent invoices, Storage, padrón, one homologation emission and
latency from mobile and desktop.

- [ ] **Step 2: Choose final state from evidence**

If all acceptance checks pass, pause Factos Virginia. If any durable or fiscal
check fails, restore the old hosting configuration and audit both databases
against ARCA before any further emission.

- [ ] **Step 3: Resume CC-App**

Resume `bmusmkjknqmwddqzjrtl` and poll until `ACTIVE_HEALTHY`.

- [ ] **Step 4: Commit and push repository changes**

```powershell
git add scripts/generate-runtime-config.mjs public/app-config.json ngsw-config.json docs/runtime-config.md docs/superpowers/specs/2026-08-03-factos-sao-paulo-migration-design.md
git commit -m "perf: move Factos backend to Sao Paulo"
git push origin main
```

Expected: `main` matches `origin/main`; migration artifacts and secrets remain
untracked and outside the repository.
