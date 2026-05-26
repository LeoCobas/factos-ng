# Arquitectura

## Resumen

FACTOS-NG es una SPA Angular 21 que usa Supabase como backend operativo y delega la integracion con ARCA a Edge Functions.

El flujo base actual es:

1. el usuario se registra (`/register`) o se autentica (`/login`) con Supabase Auth
2. la app inicializa el estado de sesion antes de resolver guards
3. si el usuario no tiene perfil de `contribuyente` o le faltan certificados ARCA, el guard lo fuerza al asistente de `/onboarding`
4. en el onboarding, el usuario valida sus datos fiscales, genera un par de claves y CSR (mediante la Edge Function `generate-csr`), y sube su certificado `.crt` obtenido en ARCA
5. una vez configurado el `contribuyente`, se habilita la emisión individual de facturas, o la importación en lote de cobros de Mercado Pago
6. para emitir, se puede consultar la constancia de inscripción de un CUIT cliente (usando `padron-lookup` con fallback si es necesario)
7. la app clasifica la condición fiscal del cliente y resuelve si corresponde `FACTURA A`, `B` o `C`
8. valida ventana fiscal (bienes/servicios), monto máximo configurado y monotonía de fecha por tipo/punto de venta
9. emite comprobantes individuales via `arca-proxy` o lotes completos via `mercadopago-sync`
10. persiste el resultado autorizado en `comprobantes` (y opcionalmente vincula el cobro en `mp_conciliaciones`)
11. genera tickets PDF en el cliente con `pdfmake`
12. visualiza e imprime PDFs con PDF.js local

## Capas

### Frontend

- `src/app/app.routes.ts`: define `/login` y `/register` como rutas públicas y el resto bajo guards basados en `UrlTree`. Redirige a `/onboarding` si no tiene perfil.
- `src/app/layouts/main-layout.component.ts`: layout autenticado, navegacion principal y carga inicial del contribuyente.
- `src/app/features/*`: pantallas funcionales (incluyendo `/auth/register` y `/onboarding`).
- `src/app/core/services/*`: servicios principales. Agrega `MercadopagoService` para búsquedas, retries y sincronización por Realtime.
- `src/app/core/config/*`: carga de configuracion runtime del cliente.
- `src/app/core/types/*`: contratos compartidos para formularios, comprobantes, PDF y Mercado Pago.
- `src/app/core/utils/*`: reglas fiscales, normalizacion de datos y manejo de tickets ARCA.
- `src/app/shared/components/ui/*`: componentes de UI y visor PDF.

### Backend operativo

- Supabase Auth para sesion y usuario (soporta autoregistro).
- Supabase Postgres para persistencia de datos:
  - `contribuyentes` (almacena el `mp_access_token` del emisor)
  - `comprobantes`
  - `mp_conciliaciones` (registra el mapeo de cobros MP y su estado de facturación)
  - `mp_batch_jobs` (lotes de facturación y progreso reactivo)
- Edge Functions:
  - `arca-proxy`: emision, nota de credito y consulta del ultimo comprobante
  - `padron-lookup`: consulta de constancia de inscripcion con fallback a credenciales de sistema si el contribuyente no tiene certificados
  - `generate-csr`: generación de claves RSA de 2048-bit y archivo CSR en Deno
  - `mercadopago-sync`: búsqueda en la API de Mercado Pago y facturación secuencial resiliente del lote
- Runtime config cliente:
  - `public/app-config.json` con URL y `anonKey` Supabase
  - generado por `scripts/generate-runtime-config.mjs` antes de los comandos npm principales

### Integracion ARCA

Las funciones `supabase/functions/arca-proxy/index.ts` y `supabase/functions/padron-lookup/index.ts` usan `@arcasdk/core@0.3.6`.

La aplicacion persiste los tickets ARCA en `contribuyentes.arca_ticket`, separados por bucket:

- `wsfe`
- `padron`

Esa separacion esta implementada en `src/app/core/utils/arca-ticket.util.ts`.

## Modulos del frontend

### Auth

- `auth.service.ts`: fuente unica de verdad del estado auth.
- expone estado reactivo de usuario, sesion, loading e inicializacion.
- separa inicializacion de sesion de los efectos de navegacion derivados de auth.
- `auth.guard.ts` y guard de invitado: devuelven `UrlTree` en vez de navegar imperativamente.
- el guard protegido espera a que la inicializacion auth termine antes de decidir acceso o redireccion.
- `login.component.ts`: formulario de acceso con reactive forms tipados, sin acceso manual al DOM.
- `register.component.ts`: formulario de autoregistro con confirmación de contraseñas y pantalla de validación de correo pendiente.

### Onboarding

- `onboarding.component.ts`: asistente multi-paso (Wizard) para usuarios recién registrados sin contribuyente configurado:
  - **Paso 1 (Datos Fiscales)**: Ingreso de CUIT con lookup autocompletado desde `/padron-lookup` (vía credenciales del sistema).
  - **Paso 2 (Generar CSR)**: Generación de par de claves en Deno y descarga del archivo `.csr` para ARCA.
  - **Paso 3 (Instrucciones)**: Guía visual para delegar servicios en el portal de AFIP/ARCA.
  - **Paso 4 (Subir Certificado)**: Subida de archivo `.crt` que persiste todos los datos fiscales, la clave privada generada y el certificado en una única transacción.

### Integración Mercado Pago

- `configuracion-mercadopago-form.component.ts`: formulario para guardar el `mp_access_token` del usuario de forma encriptada/segura en su contribuyente.
- `mercadopago-import-modal.component.ts`: modal responsivo (pantalla completa en mobile) para importar cobros en un rango de fechas. Permite seleccionar cobros, combinar cobros del mismo día, e iniciar el lote de facturación mostrando progreso reactivo mediante una barra y contadores enlazados a Supabase Realtime.

### Configuracion

- `configuracion.component.ts` queda como contenedor de tabs, mensajes globales y coordinacion.
- secciones extraidas:
  - facturacion
  - certificado
  - cuenta
- la estrategia de formularios esta unificada bajo reactive forms tipados.
- la seccion de facturacion permite configurar `monto_maximo_factura`; `0` equivale a sin limite.
- al guardar certificado o cambiar entorno `arca_production`, limpia `arca_ticket`.
- `contribuyente.service.ts` asume un modelo 1:1 entre `auth.users` y `contribuyentes`.

### Facturacion

- `facturacion.service.ts` concentra operaciones activas de negocio:
  - emitir factura
  - crear nota de credito
  - lookup fiscal del cliente
  - cargar facturas recientes
- `facturar-nuevo.component.ts` es ahora el contenedor del flujo de emision y dueño del formulario principal.
- componentes extraidos:
  - `factura-cliente-lookup-section.component.ts`
  - `facturas-recientes-panel.component.ts`
  - `factura-emitida-panel.component.ts` como bloque de resultado emitido
- valida fecha segun `actividad`:
  - `bienes`: hasta 5 dias hacia atras
  - `servicios`: hasta 10 dias hacia atras
- consulta la ultima fecha emitida para el tipo resuelto y punto de venta para impedir comprobantes con fecha anterior a la ultima autorizada.
- si el monto supera `monto_maximo_factura`, muestra una confirmacion modal con cuenta regresiva antes de emitir.

### Reglas fiscales

- `constancia-inscripcion.util.ts` extrae:
  - `condicionIva`
  - `fiscalProfile`
  - `reliable`
  - `message`
- `factura-cliente.util.ts`:
  - normaliza condicion IVA
  - resuelve tipo de documento del receptor
  - determina `CondicionIVAReceptorId`
  - decide `FACTURA A`, `B` o `C` segun emisor, cliente y fallback configurado

### Gestion de comprobantes

- `comprobantes.service.ts` concentra consultas de lectura usadas por UI:
  - comprobantes por fecha
  - ultima fecha con comprobantes
  - notas de credito asociadas
  - series para metricas
- `listado.component.ts` consume view models tipados desde `ComprobantesService`.
- `totales.component.ts` consume series tipadas desde `ComprobantesService`.
- `FacturacionService` ya no es la frontera principal para lecturas de listado y metricas.

### Totales

- `totales.component.ts` calcula totales desde view models provistos por `ComprobantesService`.
- las notas de credito se restan del total.

### PDFs

- `src/app/core/types/pdf.types.ts` define:
  - `PdfComprobanteData`
  - `PdfInfo<T>`
- `factura-pdf.service.ts` arma un ticket 80 mm con `pdfmake` desde un contrato tipado.
- `pdf.service.ts` genera blobs y maneja compartir, descarga e impresion usando ese mismo contrato.
- `pdfjs-print.service.ts` y `pdf-viewer.component.ts` cargan PDF.js desde dependencia local del bundle.
- `pdfjs-loader.service.ts` fija `GlobalWorkerOptions.workerSrc` en `/assets/pdfjs/pdf.worker.min.mjs`.

### Tema y PWA

- `theme.service.ts` persiste `light`, `dark` o `auto` en `localStorage`.
- El tema activo aplica clases globales `light-theme` / `dark-theme` y actualiza `meta[name="theme-color"]`.
- `main-layout.component.ts` cambia el logo segun el tema y muestra un preview temporal del contribuyente con acceso a configuracion y logout.
- La build copia el worker de PDF.js desde `node_modules/pdfjs-dist/build` a `/assets/pdfjs`.
- La app usa service worker Angular en produccion y manifest PWA con iconos `factos-icon-*`.
- Netlify agrega headers de cache para los iconos PWA instalables.

## Modelo de datos real

### `contribuyentes`

Campos relevantes usados por frontend y Edge Functions:

- identidad fiscal: `cuit`, `razon_social`
- datos visibles en ticket: `nombre_fantasia`, `domicilio`, `condicion_iva`, `ingresos_brutos`, `inicio_actividades`
- defaults de emision: `concepto`, `actividad`, `iva_porcentaje`, `punto_venta`
- guardrail local de emision: `monto_maximo_factura`
- credenciales y estado ARCA: `arca_cert`, `arca_key`, `arca_production`, `arca_ticket`
- credenciales Mercado Pago: `mp_access_token`
- configuracion cliente Supabase: `public/app-config.json`

### `comprobantes`

Tabla unificada para facturas y notas de credito.

Ademas de los campos clasicos del comprobante, hoy almacena datos del receptor:

- `cliente_cuit`
- `cliente_doc_tipo`
- `cliente_doc_nro`
- `cliente_nombre`
- `cliente_domicilio`
- `cliente_condicion_iva`
- `comprobante_asociado_id`

### `mp_conciliaciones`

Evita la duplicación de facturas al asociar cobros de Mercado Pago con los comprobantes emitidos.

- `contribuyente_id`: referencia al contribuyente emisor.
- `mp_payment_id`: identificador único del cobro en Mercado Pago (clave única junto a `contribuyente_id`).
- `status`: estado de la conciliación (`facturado`, `ignorado`, `fallido`).
- `mp_date_created`, `mp_transaction_amount`, `mp_description`, `mp_payer_name`: snapshot del cobro en el momento de la importación.
- `comprobante_id`: referencia opcional al comprobante generado en la tabla `comprobantes`.
- `error_message`: descripción del error en caso de que falle la facturación de ese cobro.
- `batch_job_id`: referencia al lote que procesó este cobro.

### `mp_batch_jobs`

Controla las ejecuciones en lote e informa al frontend del progreso.

- `contribuyente_id`: referencia al emisor.
- `status`: estado actual del lote (`pending`, `processing`, `completed`, `failed`).
- `total_items`, `processed_items`, `successful_items`, `failed_items`, `ignored_items`: contadores cuantitativos del progreso.
- `results`: JSONB con el detalle por cobro procesado (incluyendo ID de pago, estado, error o número de comprobante).

## Observaciones de arquitectura

- La app depende de un unico contribuyente por usuario.
- Los certificados ARCA se guardan en base de datos y no en secrets por funcion.
- El schema SQL versionado esta alineado con `database.types.ts` y con los campos que persisten frontend y functions.
- `padron-lookup` ya no devuelve una condicion fija: deriva estado fiscal desde constancia de inscripcion.
- La monotonia de fechas por tipo de comprobante se valida en frontend/servicio antes de llamar a ARCA; no reemplaza controles de ARCA.
- El limite `monto_maximo_factura` es una confirmacion operativa local, no una restriccion fiscal ni una constraint que bloquee comprobantes en backend.
- Queda una deuda de limpieza puntual en `listado.component.ts`, donde el flujo nuevo ya esta activo pero aun sobrevive codigo legacy comentado del acceso previo directo a Supabase.
