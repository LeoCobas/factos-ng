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

## 14. Registro y Onboarding

### Flujo real de Registro

1. El usuario accede a `/register`.
2. Completa el formulario reactivo tipado (`email`, `password`, `confirmPassword`).
3. El componente llama a `AuthService.signUp(email, password)`.
4. Si la creación del usuario es exitosa en Supabase Auth, se muestra una pantalla de confirmación informando que debe validar su correo electrónico.
5. Una vez que el usuario hace clic en el enlace del correo de confirmación, Supabase dispara un evento `SIGNED_IN`.
6. Al ingresar a la aplicación, los guards detectan que la sesión está iniciada pero el perfil de contribuyente no está completo (faltan datos fiscales o los certificados `arca_cert` y `arca_key`).
7. El `authGuard` bloquea el acceso a las pantallas principales y redirige automáticamente al usuario a `/onboarding`.

### Flujo real del Asistente de Onboarding

1. El usuario es recibido en `/onboarding` y pasa por un asistente de 4 pasos controlado mediante señales de estado en `OnboardingComponent`:
2. **Paso 1: Datos Fiscales**
   - El usuario ingresa su CUIT.
   - Presiona "Buscar CUIT". El componente llama a `/padron-lookup`.
   - Dado que el usuario no tiene certificados configurados todavía, la Edge Function detecta la ausencia de credenciales en la base de datos y utiliza las variables de entorno del sistema (`SYSTEM_ARCA_CERT`, `SYSTEM_ARCA_KEY`, etc.) como fallback para consultar el Padrón de AFIP/ARCA.
   - Se recuperan y autocompletan la Razón Social, Domicilio y Condición IVA.
3. **Paso 2: Generar Clave y CSR**
   - El usuario presiona "Generar Clave y Solicitud (CSR)".
   - La aplicación llama al endpoint `/generate-csr` de Supabase Edge Functions.
   - La función genera de forma asíncrona un par de claves RSA de 2048 bits usando `node-forge`.
   - Devuelve la clave privada y la solicitud de firma de certificado (CSR) PEM al frontend.
   - El frontend descarga automáticamente el archivo `.csr` (por ejemplo, `factos-request.csr`) al equipo local del usuario y mantiene la clave privada en memoria del componente.
4. **Paso 3: Instrucciones ARCA**
   - Se muestra una guía visual explicativa que orienta al usuario sobre cómo ingresar a la web de AFIP/ARCA, subir el CSR para obtener su certificado `.crt`, y delegar el servicio de Facturación Electrónica (`wsfe`) y Consulta de Constancia de Inscripción (`padron`) a la nueva relación.
5. **Paso 4: Subir Certificado**
   - El usuario selecciona y sube su archivo de certificado `.crt`.
   - Presiona "Guardar y Empezar a Facturar".
   - Se invoca `ContribuyenteService.crearContribuyente()` enviando en un único payload transaccional:
     - Datos fiscales (Paso 1).
     - La clave privada temporal que estaba en la memoria del componente (Paso 2).
     - El contenido del certificado `.crt` subido (Paso 4).
   - Supabase guarda el registro. La aplicación ejecuta `cargarContribuyente()` para actualizar las señales reactivas del estado global y redirige al usuario a la página de inicio `/`.

## 15. Facturación en lote de Mercado Pago

### Configuración del token

1. En la pantalla de Configuración, pestaña "Mercado Pago", el usuario ingresa su Access Token de Mercado Pago (generado desde el panel de desarrolladores de MP).
2. Al guardar, este se persiste de forma segura en la columna `mp_access_token` de la tabla `contribuyentes`.

### Flujo de importación y facturación en lote

1. Desde `/facturar`, el usuario hace clic en el botón de Mercado Pago al lado del buscador de CUIT.
2. Se abre el componente `MercadopagoImportModalComponent`.
3. Al inicializarse, el modal calcula un rango de fechas por defecto:
   - Fecha de fin: el día actual a las 23:59:59.
   - Fecha de inicio: si hay facturas de Mercado Pago previas en `mp_conciliaciones`, se toma la fecha de la última conciliación menos 2 días (`getDefaultBeginDate`). Si no hay historial, por defecto se toman 7 días hacia atrás.
4. El usuario puede modificar el rango y hacer clic en "Buscar Pagos".
5. Se invoca a la Edge Function `mercadopago-sync?action=search&begin_date=...&end_date=...`.
6. La función:
   - Recupera el `mp_access_token` del contribuyente.
   - Consulta la API de Mercado Pago (`/v1/payments/search`) buscando cobros con estado `approved`.
   - Consulta `mp_conciliaciones` para identificar cuáles de esos cobros ya fueron procesados (`facturado`, `ignorado` o `fallido`) por este contribuyente.
   - Filtra y descarta los cobros ya existentes, devolviendo únicamente los pendientes de facturar.
7. El frontend renderiza la lista de pagos con sus datos básicos (Fecha, Monto, Descripción, Pagador). Todos quedan seleccionados de forma predeterminada.
8. El usuario cuenta con la opción "Combinar cobros del mismo día". Si la activa, los cobros del mismo día calendario se agruparán en una sola factura "Consumidor Final" (sumando sus montos).
9. Al presionar "Procesar Lote", el frontend envía una petición `POST` a `/mercadopago-sync?action=process-batch` con la lista de IDs a facturar y la lista a ignorar.
10. La Edge Function inicia el procesamiento:
    - Crea un registro en `mp_batch_jobs` con estado `processing` y la cantidad total de elementos.
    - Los pagos marcados para omitir se insertan directamente en `mp_conciliaciones` con estado `ignorado`.
    - Ordena los cobros a facturar cronológicamente en forma ascendente (para garantizar que las fechas enviadas a ARCA sean monótonas crecientes).
    - Inicia un bucle secuencial resiliente para facturar uno por uno:
      - Determina la fecha de la factura en base al cobro de MP, aplicándole un clamping para asegurar que caiga dentro de la ventana fiscal de ARCA (bienes 5 días, servicios 10 días hacia atrás) y que no sea anterior a la última factura emitida por el contribuyente.
      - Solicita el CAE a ARCA SDK (`createVoucher`) emitiendo una factura a Consumidor Final (tipo B o C según la condición fiscal del emisor).
      - En caso de éxito, registra la factura en `comprobantes` e inserta la conciliación en `mp_conciliaciones` con estado `facturado` y el enlace al comprobante.
      - En caso de fallo, inserta la conciliación con estado `fallido` y el mensaje de error de ARCA.
      - Actualiza el registro de `mp_batch_jobs` en base a los contadores de progreso actualizados y añade el resultado detallado al campo JSONB `results`.
11. Durante todo este proceso, el frontend está suscrito via Supabase Realtime a los cambios en la tabla `mp_batch_jobs` para el ID del lote en curso. Actualiza en tiempo real la barra de progreso, los contadores de éxitos/errores y el listado de resultados.
12. Al finalizar, si quedaron cobros con estado `fallido`, el modal permite al usuario revisarlos y presionar el botón "Reintentar fallidas" para volver a iniciar un lote únicamente con esos elementos.

