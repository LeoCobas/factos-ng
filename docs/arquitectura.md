# Arquitectura

## Resumen

FACTOS-NG es una SPA Angular 21 que usa Supabase como backend operativo y delega la integración con ARCA a Edge Functions.

El flujo base actual es:

1. el usuario se autentica con Supabase Auth
2. la app carga un único `contribuyente` por usuario
3. la UI puede consultar constancia de inscripción de un CUIT
4. la app clasifica la condición fiscal del cliente
5. resuelve automáticamente si corresponde `FACTURA A`, `B` o `C`
6. emite o anula comprobantes mediante `arca-proxy`
7. persiste el resultado autorizado en `comprobantes`
8. genera tickets PDF en el cliente con `pdfmake`

## Capas

### Frontend

- `src/app/app.routes.ts`: define `login` como ruta pública y el resto bajo `authGuard`.
- `src/app/layouts/main-layout.component.ts`: layout autenticado, navegación principal y carga inicial del contribuyente.
- `src/app/features/*`: pantallas funcionales.
- `src/app/core/services/*`: integración con Supabase, auth, facturación, PDFs y tema.
- `src/app/core/utils/*`: reglas fiscales, normalización de datos y manejo de tickets ARCA.
- `src/app/shared/components/ui/*`: componentes de UI y visor PDF.

### Backend operativo

- Supabase Auth para sesión y usuario.
- Supabase Postgres para:
  - `contribuyentes`
  - `comprobantes`
- Edge Functions:
  - `arca-proxy`: emisión, nota de crédito y consulta del último comprobante
  - `padron-lookup`: consulta de constancia de inscripción y clasificación fiscal básica

### Integración ARCA

Las funciones `supabase/functions/arca-proxy/index.ts` y `supabase/functions/padron-lookup/index.ts` usan `@arcasdk/core@0.3.6`.

La aplicación persiste los tickets ARCA en `contribuyentes.arca_ticket`, separados por bucket:

- `wsfe`
- `padron`

Esa separación está implementada en `src/app/core/utils/arca-ticket.util.ts`.

## Módulos del frontend

### Auth

- `auth.service.ts`: inicializa sesión, expone signals de usuario/sesión y resuelve `signIn`, `signOut`, `signUp`, `resetPassword`.
- `auth.guard.ts`: redirige a `login` si no hay usuario y evita entrar a `login` si ya hay sesión.
- `login.component.ts`: formulario de acceso por email y contraseña.

### Configuración

- `configuracion.component.ts` concentra:
  - datos fiscales del emisor
  - certificados ARCA
  - consulta de constancia por CUIT del emisor
  - apariencia
  - cambio de email y contraseña
- al guardar certificado o cambiar entorno `arca_production`, limpia `arca_ticket`
- `contribuyente.service.ts` asume un modelo 1:1 entre `auth.users` y `contribuyentes`

### Facturación

- `facturacion.service.ts` es el servicio central.
- `facturar-nuevo.component.ts` permite:
  - emitir sin cliente identificado
  - expandir un bloque de CUIT cliente
  - consultar constancia de inscripción del receptor
  - resolver el tipo de comprobante a emitir
- valida fecha según `actividad`:
  - `bienes`: hasta 5 días hacia atrás
  - `servicios`: hasta 10 días hacia atrás

### Reglas fiscales

- `constancia-inscripcion.util.ts` extrae:
  - `condicionIva`
  - `fiscalProfile`
  - `reliable`
  - `message`
- `factura-cliente.util.ts`:
  - normaliza condición IVA
  - resuelve tipo de documento del receptor
  - determina `CondicionIVAReceptorId`
  - decide `FACTURA A`, `B` o `C` según emisor, cliente y fallback configurado

### Gestión de comprobantes

- `listado.component.ts` lista comprobantes por fecha.
- soporta:
  - ver
  - compartir
  - descargar
  - imprimir
  - anular factura mediante nota de crédito

### Totales

- `totales.component.ts` calcula totales desde `comprobantes`.
- las notas de crédito se restan del total.

### PDFs

- `factura-pdf.service.ts` arma un ticket 80 mm con `pdfmake`.
- `pdf.service.ts` genera blobs y maneja compartir, descarga e impresión.
- `pdfjs-print.service.ts` y `pdf-viewer.component.ts` cargan PDF.js desde CDN.

## Modelo de datos real

### `contribuyentes`

Campos relevantes usados por frontend y Edge Functions:

- identidad fiscal: `cuit`, `razon_social`
- datos visibles en ticket: `nombre_fantasia`, `domicilio`, `condicion_iva`, `ingresos_brutos`, `inicio_actividades`
- defaults de emisión: `concepto`, `actividad`, `iva_porcentaje`, `punto_venta`, `tipo_comprobante_default`
- credenciales y estado ARCA: `arca_cert`, `arca_key`, `arca_production`, `arca_ticket`

### `comprobantes`

Tabla unificada para facturas y notas de crédito.

Además de los campos clásicos del comprobante, hoy almacena datos del receptor:

- `cliente_cuit`
- `cliente_doc_tipo`
- `cliente_doc_nro`
- `cliente_nombre`
- `cliente_domicilio`
- `cliente_condicion_iva`
- `comprobante_asociado_id`

## Observaciones de arquitectura

- La app depende de un único contribuyente por usuario.
- Los certificados ARCA se guardan en base de datos y no en secrets por función.
- El schema SQL versionado está alineado con `database.types.ts` y con los campos que persisten frontend y functions.
- `padron-lookup` ya no devuelve una condición fija: deriva estado fiscal desde constancia de inscripción.
