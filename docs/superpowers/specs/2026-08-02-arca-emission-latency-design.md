# ARCA Emission Latency Design

## Goal

Reduce the fixed latency before `createVoucher` without changing voucher numbering, ARCA retry behavior, or authorization guarantees.

## Design

- Validate Supabase access tokens with `auth.getClaims(token)`. The production project exposes an ES256 JWKS, so verification can use the cached public key instead of `/auth/v1/user`.
- Add an authenticated SQL RPC that returns the contributor ARCA context and the fresh last-voucher cache row in one database request.
- Keep `getLastVoucher` and the single numbering retry as fallbacks when the combined context has no fresh cache.
- Cache the latest local invoice date in memory for 15 minutes and advance it after successful persistence. The database remains the fallback after expiration.
- Add a short `sessionStorage` prefetch lease so separate Angular service instances in the same tab cannot issue concurrent prefetches. This stores only timing metadata, never voucher numbering.

## Security

- The RPC derives ownership from `auth.uid()` and accepts no user or contributor ID.
- It runs as security invoker and remains subject to existing RLS policies.
- Certificate and key data are returned only to the authenticated Edge Function through the existing user JWT.

## Failure Handling

- Invalid JWT claims fail as an invalid session.
- Missing contributor configuration preserves the existing errors.
- Missing or expired cache falls back to ARCA.
- Date-cache and prefetch-lease failures degrade to the current database/network behavior.

## Verification

- Unit tests cover local date caching, expiry, advancement after emission, and cross-instance prefetch dedupe.
- SQL shape and permissions are verified after migration.
- Edge type checking, facturation tests, and the production Angular build must pass before deployment.
