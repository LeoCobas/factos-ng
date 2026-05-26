# Design Specification — User Registration and Onboarding Flow

This document outlines the design and implementation details to add user registration (`/register`) and a step-by-step onboarding wizard (`/onboarding`) to Factos-NG, utilizing Supabase Auth, a new CSR generation Edge Function, and fallback system credentials for CUIT autocompleting.

## Context & Goals

Currently, the application supports `/login` and assumes a taxpayer profile (contribuyente) with certificates already exists. To support new users:
1. **User Registration**: Add a `/register` screen using Supabase `signUp`. Show a friendly email verification pending screen.
2. **Onboarding Guard**: Implement functional guard checks so that any logged-in user without a completed profile (missing taxpayer data or `arca_cert`/`arca_key`) is redirected to `/onboarding`.
3. **Onboarding Wizard**: A 4-step wizard to set up billing:
   - **Step 1 (Fiscal Data)**: Let users input CUIT, Razón Social, etc. Retrieve data automatically using `/padron-lookup`. Since they do not have a certificate yet, modify the Edge Function to use system environment variables (`SYSTEM_ARCA_*`) as a fallback to complete the query.
   - **Step 2 (Generate Key & CSR)**: Create a new Edge Function `/generate-csr` using `node-forge` to generate an RSA 2048-bit private key and a PKCS#10 CSR. The frontend downloads the CSR for the user and holds the private key in component memory.
   - **Step 3 (ARCA Portal Instructions)**: Instruct the user on how to upload the CSR to ARCA and download their `.crt` certificate. Emphasize delegating both **Facturación Electrónica** (`wsfe`) and **Consulta de Constancia de Inscripción** (`padron`) services to the alias.
   - **Step 4 (Upload Certificate)**: The user uploads their `.crt` certificate, which gets saved to the database along with the private key (from Step 2) and the fiscal data (from Step 1) in a single transaction.

---

## Proposed Changes

### 1. Backend / Edge Functions

#### [NEW] [generate-csr/index.ts](file:///c:/PROYECTOS/factos-ng/supabase/functions/generate-csr/index.ts)
Create a new Supabase Edge Function to generate an RSA key pair and a Certificate Signing Request:
- **Contract**:
  - `POST /generate-csr`
  - Body: `{ cuit: string, razon_social: string }`
  - Headers: Requires valid `Authorization: Bearer <JWT>` (to authenticate the user).
  - Returns: `{ success: true, csr: string, private_key: string }`
- **Crypto Logic**:
  - Use `npm:node-forge@1.3.1` to generate a 2048-bit RSA key pair.
  - Set the subject fields for the CSR:
    - `C=AR`
    - `O=razon_social`
    - `CN=Factos-NG`
    - `serialNumber=CUIT cuit`
  - Sign the CSR using the generated private key.
  - Return PEM-formatted CSR and Private Key.

#### [MODIFY] [padron-lookup/index.ts](file:///c:/PROYECTOS/factos-ng/supabase/functions/padron-lookup/index.ts)
Modify the existing `padron-lookup` function to support a system fallback if the querying user has no profile or certificate configured yet:
- Read `SYSTEM_ARCA_CERT`, `SYSTEM_ARCA_KEY`, `SYSTEM_ARCA_CUIT`, and `SYSTEM_ARCA_PRODUCTION` from `Deno.env`.
- If the database lookup for the logged-in user's contribuyente returns `null` or lacks `arca_cert`/`arca_key`, fall back to these system credentials.
- Do not attempt to persist the WSAA ticket via `merge_arca_ticket_bucket` when operating in fallback mode (or gracefully handle/bypass it).

---

### 2. Frontend Routing & Guards

#### [MODIFY] [app.routes.ts](file:///c:/PROYECTOS/factos-ng/src/app/app.routes.ts)
- Register the `/register` route using `guestGuard`:
  ```typescript
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  }
  ```
- Register the `/onboarding` route inside the root route (or protected by `authGuard` directly):
  ```typescript
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard]
  }
  ```

#### [MODIFY] [auth.guard.ts](file:///c:/PROYECTOS/factos-ng/src/app/core/guards/auth.guard.ts)
- Inject `ContribuyenteService` into `authGuard`.
- If the user is authenticated:
  - Wait for initialization, and load the contribuyente profile if not already done: `await contribuyenteService.cargarContribuyente()`.
  - Determine if the profile is completed: `const isCompleted = contribuyenteService.tieneContribuyente() && contribuyenteService.contribuyente()?.arca_cert && contribuyenteService.contribuyente()?.arca_key`.
  - If **not completed** and the current URL is **not** `/onboarding`, redirect to `/onboarding`.
  - If **completed** and the current URL **is** `/onboarding`, redirect to `/` (which forwards to `/facturar`).
  - Otherwise, return `true`.

---

### 3. Frontend Services

#### [MODIFY] [auth.service.ts](file:///c:/PROYECTOS/factos-ng/src/app/core/services/auth.service.ts)
- Ensure registration redirection works:
  - In `handleNavigationEvent(event: AuthChangeEvent)`, when a user registers, they might stay in a verification state. When they click the validation link, they will trigger a `SIGNED_IN` event. The guard will capture them and redirect them to `/onboarding`.

---

### 4. Frontend Components

#### [NEW] [register.component.ts](file:///c:/PROYECTOS/factos-ng/src/app/features/auth/register.component.ts)
Create a new standalone component styled identically to `LoginComponent`:
- Form inputs: `email`, `password`, `confirmPassword`.
- Validations: standard email validation, password minimum length (6 characters), password matching validator.
- Submission:
  - Call `AuthService.signUp(email, password)`.
  - On success, toggle a `registrationSuccess` signal to replace the form with a success message: "¡Registro exitoso! Enviamos un email de confirmación a tu casilla. Por favor verificalo para poder ingresar."
  - Provide a button to redirect back to `/login`.

#### [NEW] [onboarding.component.ts](file:///c:/PROYECTOS/factos-ng/src/app/features/onboarding/onboarding.component.ts)
Create a multi-step Wizard component:
- **State signals**:
  - `currentStep` (number, 1 to 4)
  - `fiscalForm` (FormGroup: cuit, razon_social, domicilio, condicion_iva, punto_venta, concepto, actividad, iva_porcentaje)
  - `privateKey` (string | null, temporary memory storage)
  - `csr` (string | null, temporary memory storage)
  - `certFile` (File | null)
  - `isLoading` (boolean)
  - `errorMessage` (string | null)
- **Step 1 (Datos Fiscales)**:
  - Form fields matching `configuracion-facturacion-form`.
  - "Buscar CUIT" button that calls the `/padron-lookup` Edge Function. Since they have no profile yet, this uses the fallback credentials on the backend. Auto-fills Razón Social, Domicilio, and Condición IVA.
- **Step 2 (Generar CSR)**:
  - Button to "Generar Clave y Solicitud (CSR)".
  - Invokes `/generate-csr` on the backend.
  - Stores `private_key` in component memory and triggers a download of the `csr` file (e.g. `factos-request.csr`).
- **Step 3 (Instrucciones ARCA)**:
  - Show the step-by-step instructions. Explain downloading the certificate and linking both `wsfe` (Facturación Electrónica) and `padron` (Consulta de Constancia de Inscripción).
- **Step 4 (Subir Certificado)**:
  - Drag-and-drop / file selector for the `.crt` / `.cer` certificate.
  - "Guardar y Empezar a Facturar" button:
    - Calls `ContribuyenteService.crearContribuyente()` sending all fiscal fields from Step 1, the `privateKey` from Step 2, and the uploaded `arca_cert` from Step 4.
    - On success, trigger `contribuyenteService.cargarContribuyente()` to update global signals, and navigate to `/`.

---

## Verification Plan

### Automated Tests
- Run `npm test` to verify no existing tests break.
- Add basic test suites for `RegisterComponent` and `OnboardingComponent` checking form validity and step transitions.

### Manual Verification
- **Sign Up Flow**: Go to `/register`, input valid fields, submit, verify that the email verification screen is displayed.
- **Guard Enforcement**: Log in with a user that has no profile, verify the app automatically redirects to `/onboarding` and blocks navigation to `/facturar` or `/listado`.
- **Onboarding Step 1 (Autocomplete)**: Input a valid CUIT (e.g., a test CUIT or a real one), click "Buscar", verify it autocompletes the name and address using system credentials.
- **Onboarding Step 2 (CSR)**: Click generate, verify a `.csr` file downloads.
- **Onboarding Step 4 (Complete)**: Upload a dummy/real certificate, submit, verify it saves both `arca_cert` and `arca_key` in the DB and successfully routes to `/facturar`.
