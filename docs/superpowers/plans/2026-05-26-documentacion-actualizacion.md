# Documentation Update (May 2026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the codebase documentation to reflect the recently added user registration & onboarding flows and the Mercado Pago batch invoicing integration.

**Architecture:** Integrate the documentation changes directly into the existing main documentation files (`README.md`, `docs/arquitectura.md`, `docs/flujos-clave.md`, `docs/backend-operational-contracts.md`, and `docs/sectores-a-documentar.md`) following Option A (Integrated Updates) to ensure a single, consistent source of truth.

**Tech Stack:** Markdown, Git.

---

### Task 1: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Edit README.md**
  Update `README.md` to:
  1. Add user registration, onboarding, and Mercado Pago batch invoicing to the "Estado actual" section.
  2. Add new directories (`generate-csr`, `mercadopago-sync`) to the "Estructura relevante" tree.
  3. Add new component and service descriptions under "Módulos principales".
  4. Document the TypeScript 5.9.x downgrade and package upgrades under "Refactors aplicados".

  Ensure that all paths are formatted as clickable GitHub markdown links.

  Edit target block in `README.md`:
  ```markdown
  - Estado funcional: autenticacion, registro y onboarding de usuarios, configuracion del contribuyente, gestion de certificados ARCA, emision de facturas A/B/C, integracion con Mercado Pago para facturacion en lote, anulacion con nota de credito, consulta de constancia de inscripcion, generacion local de PDF e instalacion PWA.
  ```

- [ ] **Step 2: Verify the markdown content**
  Ensure that no formatting is broken and there are no placeholders.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add README.md
  git commit -m "docs: update README with registration, onboarding and Mercado Pago features"
  ```

---

### Task 2: Update docs/arquitectura.md

**Files:**
- Modify: `docs/arquitectura.md`

- [ ] **Step 1: Edit docs/arquitectura.md**
  Add the registration flow steps to the overview, list the new components, services, and tables under "Capas", add sections for "Registro y Onboarding" and "Integración con Mercado Pago" under "Módulos del frontend", and document the new SQL table definitions under "Modelo de datos real".

- [ ] **Step 2: Verify the markdown content**
  Check that the updated architecture document contains all structural changes without placeholders.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add docs/arquitectura.md
  git commit -m "docs: update architecture documentation with new architecture layers and tables"
  ```

---

### Task 3: Update docs/flujos-clave.md

**Files:**
- Modify: `docs/flujos-clave.md`

- [ ] **Step 1: Edit docs/flujos-clave.md**
  Add detailed, step-by-step descriptions of:
  1. The User Registration & Onboarding Flow (Wizard, CSR generation, profile guard).
  2. The Mercado Pago Batch Invoicing Flow (import modal, search, sequential processing, date clamping, same-day charge merging, Realtime synchronization).

- [ ] **Step 2: Verify the markdown content**
  Ensure that all paths and terms are consistent with the codebase.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add docs/flujos-clave.md
  git commit -m "docs: add key flows for onboarding and Mercado Pago batch invoicing"
  ```

---

### Task 4: Update docs/backend-operational-contracts.md

**Files:**
- Modify: `docs/backend-operational-contracts.md`

- [ ] **Step 1: Edit docs/backend-operational-contracts.md**
  Add contracts for `/generate-csr` and `/mercadopago-sync` (actions `search` and `process-batch`), and document the fallback credentials behavior in `/padron-lookup`.

- [ ] **Step 2: Verify the markdown content**
  Verify the JSON structures match the actual Edge Functions payloads.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add docs/backend-operational-contracts.md
  git commit -m "docs: add backend operational contracts for generate-csr and mercadopago-sync"
  ```

---

### Task 5: Update docs/sectores-a-documentar.md

**Files:**
- Modify: `docs/sectores-a-documentar.md`

- [ ] **Step 1: Edit docs/sectores-a-documentar.md**
  Clean up resolved sections or update pending work status.

- [ ] **Step 2: Verify all markdown links**
  Run a check (or manually view files) to ensure all markdown links are correct.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add docs/sectores-a-documentar.md
  git commit -m "docs: update sectores-a-documentar list"
  ```
