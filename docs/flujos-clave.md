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
  - `arca-proxy`

### Patrón de acceso

- la mayoría de las lecturas y escrituras se hacen con el cliente autenticado del navegador
- el `contribuyente` se busca por `user_id`
- los `comprobantes` se buscan por `contribuyente_id`
- las Edge Functions reciben `Authorization` y `apikey` explícitos desde frontend

## 3. Edge Functions

## `arca-proxy`

### Acciones expuestas

- `?action=crear-factura`
- `?action=crear-nota-credito`
- `?action=ultimo-comprobante`

### Flujo de factura

1. recibe `punto_venta`, `tipo_comprobante`, `monto`, `fecha`, `concepto_afip`, `iva_porcentaje`
2. recibe además datos del receptor:
   - `doc_tipo`
   - `doc_nro`
   - `condicion_iva_receptor_id`
3. valida usuario y carga el contribuyente por `user_id`
4. crea instancia `Arca` con `arca_cert`, `arca_key`, `cuit` y `arca_production`
5. lee o renueva ticket WSFE en el bucket `wsfe`
6. consulta el último comprobante
7. calcula importes neto/IVA cuando corresponde
8. arma payload WSFE
9. llama `createVoucher`
10. normaliza la respuesta y devuelve `CAE`, vencimiento y numeración

### Flujo de nota de crédito

1. recibe los datos del comprobante asociado
2. vuelve a informar documento y condición IVA del receptor
3. decide `NOTA DE CREDITO A`, `B` o `C`
4. consulta el último número disponible
5. arma `CbtesAsoc`
6. llama `createVoucher`
7. devuelve CAE y numeración

## `padron-lookup`

### Flujo

1. recibe `cuit`
2. valida usuario autenticado
3. busca el contribuyente del usuario
4. exige `arca_cert` y `arca_key`
5. crea instancia `Arca`
6. consulta `registerInscriptionProofService.getTaxpayersDetails([cuit])`
7. lee o renueva ticket en el bucket `padron`
8. procesa la constancia de inscripción
9. devuelve:
   - `razon_social`
   - `domicilio`
   - `condicion_iva`
   - `fiscal_profile`
   - `fiscal_status_message`
   - `fiscal_status_reliable`
   - `fiscal_status_source`

### Modo diagnóstico

Si recibe `debug: true`, devuelve además:

- entorno ARCA activo
- estado del ticket de padrón antes y después
- `serverStatus`
- diagnóstico de la llamada batch de constancia

## 4. Constancia de inscripción y clasificación fiscal

### Utilidad base

`src/app/core/utils/constancia-inscripcion.util.ts` clasifica la constancia en perfiles:

- `responsable-inscripto`
- `monotributo`
- `exento`
- `no-inscripto`
- `no-alcanzado`
- `sin-datos`
- `ambiguo`

### Reglas observadas

- si detecta monotributo activo, devuelve `Responsable Monotributo`
- si detecta IVA activo, devuelve `IVA Responsable Inscripto`
- si detecta estados `EX`, `NI` o equivalentes, devuelve `Exento`, `No Inscripto` o `No Alcanzado`
- si detecta señales incompatibles, marca el resultado como no confiable

## 5. Resolución del tipo de comprobante

### Utilidad

`src/app/core/utils/factura-cliente.util.ts` decide si emitir `FACTURA A`, `FACTURA B` o `FACTURA C`.

### Reglas principales

- si el emisor es monotributista o exento, siempre cae en `FACTURA C`
- si el emisor es responsable inscripto:
  - cliente con perfil `responsable-inscripto` => `FACTURA A`
  - cliente monotributo, exento, no inscripto, no alcanzado o consumidor final => `FACTURA B`
  - cliente ambiguo o sin datos suficientes => `FACTURA B` como fallback con revisión sugerida
- si no puede clasificar al emisor, usa el tipo configurado como fallback

## 6. Emisión de factura en la app

1. `facturar-nuevo.component.ts` captura monto y fecha.
2. opcionalmente expande el bloque de CUIT cliente.
3. si se consulta un CUIT, llama `FacturacionService.buscarClientePorCuit()`.
4. esa llamada usa `padron-lookup` y obtiene condición fiscal clasificada.
5. la UI resuelve el tipo de comprobante y muestra si requiere revisión.
6. `FacturacionService.emitirFactura()` valida contribuyente y fecha.
7. obtiene un access token fresco de Supabase.
8. llama `arca-proxy?action=crear-factura`.
9. si ARCA autoriza, inserta un registro en `comprobantes` con datos del receptor.
10. el resultado se muestra en UI y se habilita PDF local.

## 7. Anulación con nota de crédito

1. `listado.component.ts` pide confirmación.
2. llama `FacturacionService.crearNotaCredito(...)`.
3. el servicio consulta el comprobante original, incluyendo datos del receptor.
4. llama `arca-proxy?action=crear-nota-credito`.
5. inserta la nota de crédito en `comprobantes`.
6. actualiza la factura original a estado `anulada`.
7. refresca la vista del listado.

## 8. ARCA SDK API

### Desde `arca-proxy`

Uso verificado:

- `new Arca({...})`
- `arca.electronicBillingService.getLastVoucher(...)`
- `arca.electronicBillingService.createVoucher(...)`

### Desde `padron-lookup`

Uso verificado:

- `new Arca({...})`
- `arca.registerInscriptionProofService.getTaxpayersDetails(...)`
- `arca.registerInscriptionProofService.getServerStatus()`

## 9. Persistencia de tickets ARCA

La app usa `handleTicket: true` y persiste el ticket en `contribuyentes.arca_ticket`.

El almacenamiento está bucketizado:

- `wsfe` para facturación
- `padron` para constancia

Además, si cambian certificados o entorno ARCA desde configuración, la app limpia `arca_ticket`.

## 10. PDF

### Flujo principal actual

1. la app toma `contribuyente` + `comprobante`
2. `factura-pdf.service.ts` genera un PDF con `pdfmake`
3. `pdf.service.ts` lo expone como blob para ver, compartir, descargar o imprimir
