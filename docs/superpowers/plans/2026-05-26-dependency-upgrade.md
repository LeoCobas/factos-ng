# Dependency Upgrade & Security Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve package security vulnerabilities and upgrade outdated npm dependencies (including Angular libraries, Supabase, Tailwind, etc.) while verifying project builds and unit tests pass.

**Architecture:** We will first apply automatic security hotfixes using npm audit. Then, we will systematically update core dependencies (such as Angular compiler/core, TailwindCSS, and Supabase) to latest versions. Finally, we will build and run tests to ensure no regressions were introduced.

**Tech Stack:** npm, Angular, TailwindCSS, Vitest, Supabase JS client.

---

### Task 1: Security Vulnerability Patching

**Files:**
- Modify: [package-lock.json](file:///c:/PROYECTOS/factos-ng/package-lock.json)

- [ ] **Step 1: Execute automatic security audit fix**

Run: `npm audit fix`
Expected: Automatically resolves moderate and high severity vulnerabilities by adjusting dependency trees in `package-lock.json`.

- [ ] **Step 2: Run verification audit**

Run: `npm audit`
Expected: Report shows 0 vulnerabilities, or only ones that require manual/major changes.

- [ ] **Step 3: Commit lockfile changes**

Run: `git add package-lock.json` and `git commit -m "chore: apply npm audit fix to resolve vulnerabilities"`

---

### Task 2: Dependency Upgrades

**Files:**
- Modify: [package.json](file:///c:/PROYECTOS/factos-ng/package.json)
- Modify: [package-lock.json](file:///c:/PROYECTOS/factos-ng/package-lock.json)

- [ ] **Step 1: Update direct dependencies to wanted ranges**

Run: `npm update`
Expected: Updates dependencies within compatible range defined in `package.json`.

- [ ] **Step 2: Install latest versions of key dependencies**

Run:
```bash
npm install @supabase/supabase-js@latest pdfjs-dist@latest pdfmake@latest
```
Expected: Upgrades Supabase JS, PDFjs-dist, and pdfmake to latest versions.

- [ ] **Step 3: Install latest versions of key devDependencies**

Run:
```bash
npm install -D supabase@latest tailwindcss@latest @angular-eslint/builder@latest @angular-eslint/eslint-plugin@latest @angular-eslint/eslint-plugin-template@latest @angular-eslint/schematics@latest @angular-eslint/template-parser@latest typescript@latest jsdom@latest vitest@latest
```
Expected: Upgrades Supabase CLI, TailwindCSS, ESLint, TypeScript, JSDOM, and Vitest.

- [ ] **Step 4: Commit dependency updates**

Run: `git add package.json package-lock.json` and `git commit -m "chore: upgrade dependencies to latest versions"`

---

### Task 3: Build & Verification

**Files:**
- Test: All tests

- [ ] **Step 1: Verify local application build**

Run: `npm run build`
Expected: App builds successfully without compiler or TypeScript errors.

- [ ] **Step 2: Run unit test suite**

Run: `npm run test`
Expected: All Vitest unit tests pass successfully.
