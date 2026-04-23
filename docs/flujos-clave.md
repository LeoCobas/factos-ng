# Flujos clave

## 1. Auth

### Flujo real

1. `login.component.ts` arma un formulario reactivo tipado y llama `AuthService.signIn(email, password)`.
2. `auth.service.ts` usa `supabase.auth.signInWithPassword`.
3. el servicio actualiza el estado reactivo de sesion.
4. los guards esperan a que auth termine de inicializar antes de decidir acceso.
5. si el usuario esta autenticado, la navegacion a rutas protegidas se resuelve sin redirecciones duplicadas.
6. `main-layout.component.ts` carga el contribuyente al iniciar.
7. si hay contribuyente, el header muestra un preview temporal con razon social, CUIT, acceso a configuracion y logout.

### Detalles

- La sesion se persiste con un storage custom en `supabase.service.ts`.
- Hay reintentos cortos al recuperar sesion para evitar fallas iniciales del cliente.
- La app usa un `storageKey` propio: `factos-ng-supabase-auth`.
- El logout se dispara desde `AuthService.signOut()` y la navegacion post-auth queda centralizada fuera de los componentes de pantalla.

## 2. Supabase

### Uso desde el frontend

- Auth:
  - login
  - logout
  - refresh de sesion
  - update de email/password
- DB:
  - `contribuyentes`
  - `comprobantes`
- Functions:
  - `padron-lookup`
  - `arca-proxy`

### Patron de acceso

- la mayoria de las lecturas y escrituras se hacen con el cliente autenticado del navegador
- el `contribuyente` se busca por `user_id`
- los `comprobantes` se buscan por `contribuyente_id`
- las Edge Functions reciben `Authorization` y `apikey` explicitos desde frontend
- la `anonKey` ya no vive en `environment*.ts`: el cliente la carga desde `public/app-config.json`
- `public/app-config.json` se genera por script antes de `start`, `build`, `watch`, `test` y `netlify:build`.

## 3. Edge Functions

## `arca-proxy`

### Acciones expuestas

- `?action=crear-factura`
- `?action=crear-nota-credito`
- `?action=ultimo-comprobante`

### Flujo de factura

1. recibe `punto_venta`, `tipo_comprobante`, `monto`, `fecha`, `concepto_afip`, `iva_porcentaje`
2. recibe ademas datos del receptor:
   - `doc_tipo`
   - `doc_nro`
   - `condicion_iva_receptor_id`
3. valida usuario y carga el contribuyente por `user_id`
4. crea instancia `Arca` con `arca_cert`, `arca_key`, `cuit` y `arca_production`
5. lee o renueva ticket WSFE en el bucket `wsfe`
6. consulta el ultimo comprobante
7. calcula importes neto/IVA cuando corresponde
8. arma payload WSFE
9. llama `createVoucher`
10. normaliza la respuesta y devuelve `CAE`, vencimiento y numeracion

### Flujo de nota de credito

1. recibe los datos del comprobante asociado
2. vuelve a informar documento y condicion IVA del receptor
3. decide `NOTA DE CREDITO A`, `B` o `C`
4. consulta el ultimo numero disponible
5. arma `CbtesAsoc`
6. llama `createVoucher`
7. devuelve CAE y numeracion

## `padron-lookup`

### Flujo

1. recibe `cuit`
2. valida usuario autenticado
3. busca el contribuyente del usuario
4. exige `arca_cert` y `arca_key`
5. crea instancia `Arca`
6. consulta `registerInscriptionProofService.getTaxpayersDetails([cuit])`
7. lee o renueva ticket en el bucket `padron`
8. procesa la constancia de inscripcion
9. devuelve:
   - `razon_social`
   - `domicilio`
   - `condicion_iva`
   - `fiscal_profile`
   - `fiscal_status_message`
   - `fiscal_status_reliable`
   - `fiscal_status_source`

## 4. Constancia de inscripcion y clasificacion fiscal

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

## 5. Resolucion del tipo de comprobante

### Utilidad

`src/app/core/utils/factura-cliente.util.ts` decide si emitir `FACTURA A`, `FACTURA B` o `FACTURA C`.

### Reglas principales

- si el emisor es monotributista o exento, siempre cae en `FACTURA C`
- si el emisor es responsable inscripto:
  - cliente con perfil `responsable-inscripto` => `FACTURA A`
  - cliente monotributo, exento, no inscripto, no alcanzado o consumidor final => `FACTURA B`
  - cliente ambiguo o sin datos suficientes => `FACTURA B` como fallback con revision sugerida
- si no puede clasificar al emisor, usa el tipo configurado como fallback

## 6. Emision de factura en la app

1. `facturar-nuevo.component.ts` captura monto y fecha en un formulario tipado.
2. el contenedor mantiene limites de fecha, submit, reset post-emision y carga de recientes.
3. `factura-cliente-lookup-section.component.ts` renderiza el bloque de CUIT cliente y su estado derivado.
4. si se consulta un CUIT, llama `FacturacionService.buscarClientePorCuit()`.
5. esa llamada usa `padron-lookup` y obtiene condicion fiscal clasificada.
6. la UI resuelve el tipo de comprobante y muestra si requiere revision.
7. si el monto supera `monto_maximo_factura`, muestra confirmacion con cuenta regresiva; con `0` no hay limite.
8. `FacturacionService.emitirFactura()` valida contribuyente y fecha fiscal.
9. consulta la ultima fecha emitida para el tipo resuelto y punto de venta; si la nueva fecha es anterior, corta antes de ARCA.
10. obtiene un access token fresco de Supabase.
11. llama `arca-proxy?action=crear-factura`.
12. si ARCA autoriza, inserta un registro en `comprobantes` con datos del receptor.
13. el resultado se muestra en UI y se habilita PDF local usando el contrato `PdfComprobanteData`.

## 7. Facturas recientes

1. `facturar-nuevo.component.ts` pide recientes a `FacturacionService`.
2. `facturas-recientes-panel.component.ts` renderiza skeleton, vacio o lista.
3. el panel es presentacional y no consulta servicios por si mismo.

## 8. Anulacion con nota de credito

1. `listado.component.ts` pide confirmacion.
2. llama `FacturacionService.crearNotaCredito(...)`.
3. el servicio consulta el comprobante original, incluyendo datos del receptor.
4. deriva el tipo de nota de credito segun la factura asociada.
5. valida que la fecha de la nota no sea anterior a la ultima autorizada del mismo tipo y punto de venta.
6. llama `arca-proxy?action=crear-nota-credito`.
7. inserta la nota de credito en `comprobantes`.
8. actualiza la factura original a estado `anulada`.
9. limpia cache de la fecha afectada y refresca la vista del listado.

## 9. Lectura de comprobantes y metricas

1. `ComprobantesService` concentra las consultas de lectura para UI.
2. `listado.component.ts` pide comprobantes tipados por fecha y ultima fecha disponible.
3. `totales.component.ts` consume series tipadas para armar metricas y acumulados.
4. las notas de credito asociadas se resuelven en el dominio de lectura y no en consultas ad hoc en cada componente.
5. `listado.component.ts` mantiene cache por contribuyente/fecha y la invalida despues de anular.

## 10. ARCA SDK API

### Desde `arca-proxy`

Uso verificado:

- `new Arca({...})`
- `arca.electronicBillingService.getLastVoucher(...)`
- `arca.electronicBillingService.createVoucher(...)`

### Desde `padron-lookup`

Uso verificado:

- `new Arca({...})`
- `arca.registerInscriptionProofService.getTaxpayersDetails(...)`

## 11. Persistencia de tickets ARCA

La app usa `handleTicket: true` y persiste el ticket en `contribuyentes.arca_ticket`.

El almacenamiento esta bucketizado:

- `wsfe` para facturacion
- `padron` para constancia

Ademas, si cambian certificados o entorno ARCA desde configuracion, la app limpia `arca_ticket`.

## 12. PDF

### Flujo principal actual

1. la app toma `contribuyente` + `comprobante`
2. adapta los datos al contrato `PdfComprobanteData`
3. `factura-pdf.service.ts` genera un PDF con `pdfmake`
4. `pdf.service.ts` lo expone como blob para ver, compartir, descargar o imprimir
5. `listado` y `facturar` reutilizan el mismo contrato tipado para evitar casts y objetos ad hoc
6. `pdf-viewer.component.ts` y `pdfjs-print.service.ts` usan PDF.js empaquetado localmente, sin CDN publica

## 13. Tema, PWA e instalacion

1. `theme.service.ts` lee `theme` desde `localStorage` y acepta `light`, `dark` o `auto`.
2. en modo `auto`, escucha `prefers-color-scheme` y recalcula el tema activo.
3. aplica `light-theme` o `dark-theme` sobre `documentElement`.
4. actualiza `meta[name="theme-color"]` para que la PWA y el navegador reflejen el tema.
5. `main-layout.component.ts` usa `/logo.png` o `/logob.png` segun el tema activo.
6. `public/manifest.webmanifest` usa iconos `icons/factos-icon-*.png`.
7. `netlify.toml` fija headers para evitar que una app instalada retenga iconos anteriores.
