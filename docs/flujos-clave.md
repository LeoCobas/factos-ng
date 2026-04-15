# Flujos clave

## 1. Auth

### Flujo real

1. `login.component.ts` llama `AuthService.signIn(email, password)`.
2. `auth.service.ts` usa `supabase.auth.signInWithPassword`.
3. al autenticar, navega a `/`.
4. `authGuard` protege el layout principal.
5. `main-layout.component.ts` carga el contribuyente al iniciar.

### Detalles

- La sesión se persiste con un storage custom en `supabase.service.ts`.
- Hay reintentos cortos al recuperar sesión para evitar fallas iniciales del cliente.
- La app usa un `storageKey` propio: `factos-ng-supabase-auth`.

## 2. Supabase

### Uso desde el frontend

- Auth:
  - login
  - logout
  - refresh de sesión
  - update de email/password
- DB:
  - `contribuyentes`
  - `comprobantes`
- Functions:
  - `padron-lookup`

### Patrón de acceso

- la mayoría de las lecturas y escrituras se hacen con el cliente autenticado del navegador
- el `contribuyente` se busca por `user_id`
- los `comprobantes` se buscan por `contribuyente_id`

### Supuesto operativo

La app presupone RLS coherente con el usuario autenticado y el `schema.sql` del repo refleja el modelo efectivo usado por frontend y Edge Functions.

## 3. Edge Functions

## `arca-proxy`

### Acciones expuestas

- `?action=crear-factura`
- `?action=crear-nota-credito`
- `?action=ultimo-comprobante`

### Flujo de factura

1. recibe `punto_venta`, `tipo_comprobante`, `monto`, `fecha`, `concepto_afip`, `iva_porcentaje`
2. obtiene el contribuyente usando el JWT recibido por header
3. crea instancia `Arca` con `arca_cert`, `arca_key`, `cuit` y `arca_production`
4. consulta el último comprobante
5. calcula importes neto/IVA cuando corresponde
6. arma payload WSFE
7. llama `createVoucher`
8. normaliza la respuesta y devuelve `CAE`, vencimiento y numeración

### Flujo de nota de crédito

1. recibe datos del comprobante asociado
2. decide `NOTA DE CREDITO B` o `C`
3. consulta el último número disponible
4. arma `CbtesAsoc`
5. llama `createVoucher`
6. devuelve CAE y numeración

## `padron-lookup`

### Flujo

1. recibe `cuit`
2. valida usuario autenticado
3. busca el contribuyente del usuario
4. exige `arca_cert` y `arca_key`
5. crea instancia `Arca`
6. consulta padrón
7. devuelve `razon_social`, `domicilio` y un `condicion_iva` fijo

### Observación

`condicion_iva` hoy no parece surgir del padrón: la función devuelve `'Responsable Monotributo'` de forma fija.

## 4. ARCA SDK API

## Desde `arca-proxy`

Uso verificado:

- `new Arca({...})`
- `arca.electronicBillingService.getLastVoucher(...)`
- `arca.electronicBillingService.createVoucher(...)`

## Desde `padron-lookup`

Uso verificado:

- `arca.registerScopeThirteenService.getTaxpayerDetails(...)`

## Persistencia del ticket

Supuesto según el código actual:

- el SDK usa `handleTicket: true`
- la implementación de `AuthRepository` guarda el ticket en `contribuyentes.arca_ticket`

El ticket se guarda en la misma fila de `contribuyentes`, no en una tabla separada.

## 5. Emisión de factura en la app

1. `facturar-nuevo.component.ts` captura monto y fecha.
2. `facturacion.service.ts` valida contribuyente y fecha.
3. obtiene un access token fresco de Supabase.
4. llama `arca-proxy?action=crear-factura`.
5. si ARCA autoriza, inserta un registro en `comprobantes`.
6. el resultado se muestra en UI y se habilita PDF local.

## 6. Anulación con nota de crédito

1. `listado.component.ts` pide confirmación.
2. llama `facturacion.service.crearNotaCredito(...)`.
3. el servicio consulta el comprobante original.
4. llama `arca-proxy?action=crear-nota-credito`.
5. inserta la nota de crédito en `comprobantes`.
6. actualiza la factura original a estado `anulada`.
7. refresca la vista del listado.

## 7. PDF

### Flujo principal actual

1. la app toma `contribuyente` + `comprobante`
2. `factura-pdf.service.ts` genera un PDF con `pdfmake`
3. `pdf.service.ts` lo expone como blob para ver, compartir, descargar o imprimir
