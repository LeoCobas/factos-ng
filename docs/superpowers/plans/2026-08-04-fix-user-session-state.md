# User Session State Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent contributor identity and invoice views from surviving a logout followed by login as another user.

**Architecture:** Keep Supabase session persistence unchanged, but scope `ContribuyenteService` state to the authenticated user ID. Auth events invalidate contributor state synchronously, and contributor loads use a generation token so an old in-flight response cannot repopulate cleared state.

**Tech Stack:** Angular 21 signals and dependency injection, Supabase JS Auth, Vitest/TestBed.

---

### Task 1: Reproduce user-scoped cache failure

**Files:**
- Create: `src/app/core/services/contribuyente.service.spec.ts`

- [x] Write a service test that loads user A, changes `supabase.auth.getUser()` to user B, calls `cargarContribuyente()` again, and expects user B's contributor.
- [x] Run only this spec and confirm it fails because `inicializado` skips the second identity lookup.

### Task 2: Invalidate state on auth identity changes

**Files:**
- Modify: `src/app/core/services/auth.service.spec.ts`
- Modify: `src/app/core/services/auth.service.ts`

- [x] Add failing tests proving `SIGNED_OUT` and a `SIGNED_IN` with a different user invalidate contributor state, while token refresh for the same user does not.
- [x] Inject `ContribuyenteService` into `AuthService` and invalidate before publishing the new auth state.
- [x] Run the focused auth tests until green.

### Task 3: Make contributor loads identity-safe

**Files:**
- Modify: `src/app/core/services/contribuyente.service.ts`
- Modify: `src/app/core/services/contribuyente.service.spec.ts`

- [x] Track the user ID that owns the initialized cache rather than treating `inicializado` as global.
- [x] Add a public lifecycle method that clears contributor/loading/error/initialized state and advances a request generation.
- [x] Add a failing race test where user A's request resolves after invalidation and verify it cannot overwrite user B's state.
- [x] Implement generation checks and run the focused contributor tests until green.

### Task 4: Verify all affected flows

**Files:**
- Test: `src/app/core/services/auth.service.spec.ts`
- Test: `src/app/core/services/contribuyente.service.spec.ts`
- Test: `src/app/core/guards/auth.guard.spec.ts`
- Test: `src/app/layouts/main-layout.component.spec.ts`

- [x] Run focused auth, contributor, guard, and layout tests.
- [x] Run the complete test suite.
- [x] Run lint and production build. (Global lint retains unrelated pre-existing findings; changed files are clean.)
- [x] Review the final diff to confirm no unrelated user changes were modified.
