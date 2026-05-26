# Design Specification — Documentation Update (May 2026)

This document outlines the changes to be made to the project's documentation files to reflect the implementation of the user registration & onboarding flows and the Mercado Pago batch invoicing integration.

## Context & Goals

Factos-NG has recently received major updates:
1. **User Registration and Onboarding**: Screens `/register` and `/onboarding`, a profile guard, a new `generate-csr` Edge Function, and fallback system credentials in `padron-lookup`.
2. **Mercado Pago Batch Invoicing**: Access token storage, import modal on `/facturar`, new database tables (`mp_conciliaciones`, `mp_batch_jobs`), and a `mercadopago-sync` Edge Function supporting sequential invoicing with date clamping and real-time monitoring via Supabase Realtime.
3. **Dependency Upgrades**: Upgrading dependencies like `supabase-js` to v2.106 and configuring TypeScript to v5.9.x for Angular CLI compatibility.

To ensure the codebase remains maintainable, all living documentation files (`README.md`, `docs/arquitectura.md`, `docs/flujos-clave.md`, `docs/backend-operational-contracts.md`, and `docs/sectores-a-documentar.md`) must be updated to match the new features and architectural changes.

---

## Proposed Changes

### [README.md](file:///c:/PROYECTOS/factos-ng/README.md)
- Update **Estado actual** to explicitly list user registration, onboarding, and Mercado Pago batch invoicing.
- Add the new Edge Functions and components in **Estructura relevante**.
- Add summaries of the two new modules in **Módulos principales**.
- Document the dependency upgrades in **Refactors aplicados en esta etapa**.

### [docs/arquitectura.md](file:///c:/PROYECTOS/factos-ng/docs/arquitectura.md)
- Expand the high-level application flow under **Resumen** to include registration, onboarding, and batch invoicing.
- Add the new components, services, and tables under **Capas**.
- Create a new subsection under **Módulos del frontend** for "Registro y Onboarding" and another for "Integración con Mercado Pago".
- Detail the schemas and security models for `mp_conciliaciones` and `mp_batch_jobs` under **Modelo de datos real**.

### [docs/flujos-clave.md](file:///c:/PROYECTOS/factos-ng/docs/flujos-clave.md)
- Document the step-by-step logic of the **Registro y Onboarding** flow.
- Document the step-by-step logic of the **Mercado Pago Batch Invoicing** flow (including date clamping, chronological sorting, sequential ARCA invoice generation, and realtime feedback).

### [docs/backend-operational-contracts.md](file:///c:/PROYECTOS/factos-ng/docs/backend-operational-contracts.md)
- Add detailed API contracts for `POST /generate-csr`.
- Document the `SYSTEM_ARCA_*` fallback mechanism in `padron-lookup`.
- Add API contracts for `GET /mercadopago-sync?action=search` and `POST /mercadopago-sync?action=process-batch`.

### [docs/sectores-a-documentar.md](file:///c:/PROYECTOS/factos-ng/docs/sectores-a-documentar.md)
- Mark previously pending sectors that have now been documented as resolved, or update their statuses.

---

## Verification Plan

### Manual Verification
- Review the updated markdown files locally.
- Verify that links between markdown files are clickable and resolve correctly.
