# Arquitectura

## Resumen

FACTOS-NG es una SPA Angular que usa Supabase como backend operativo y delega la interacción con ARCA en Edge Functions.

El modelo real que surge del código es:

1. el usuario se autentica con Supabase Auth
2. la app carga un único `contribuyente` por usuario
3. la UI emite o anula comprobantes mediante `arca-proxy`
4. la app persiste el resultado autorizado en `comprobantes`
5. los tickets PDF se generan del lado cliente con `pdfmake`

## Capas

### Frontend

- `src/app/app.routes.ts`: define `login` como ruta pública y el resto bajo `authGuard`.
- `src/app/layouts/main-layout.component.ts`: layout autenticado, navegación principal y carga inicial del contribuyente.
- `src/app/features/*`: pantallas funcionales.
- `src/app/core/services/*`: integración con Supabase, auth, facturación, PDFs y tema.
- `src/app/shared/components/ui/*`: componentes de UI y visor PDF.

### Backend operativo

- Supabase Auth para sesión y usuario.
- Supabase Postgres para:
  - `contribuyentes`
  - `comprobantes`
- Edge Functions:
  - `arca-proxy`: emisión de factura, nota de crédito y consulta del último comprobante
  - `padron-lookup`: consulta de padrón ARCA a partir del certificado del contribuyente

### Integración ARCA

Las funciones `supabase/functions/arca-proxy/index.ts` y `supabase/functions/padron-lookup/index.ts` usan `@arcasdk/core@0.3.6`.

Supuesto: el SDK encapsula WSAA y WSFE, y la aplicación delega toda esa comunicación al runtime de Supabase.

## Módulos del frontend

### Auth

- `auth.service.ts`: inicializa sesión, expone signals de usuario/sesión y resuelve `signIn`, `signOut`, `signUp`, `resetPassword`.
- `auth.guard.ts`: redirige a `login` si no hay usuario y evita entrar a `login` si ya hay sesión.
- `login.component.ts`: formulario de acceso por email y contraseña.

### Configuración

- `configuracion.component.ts` concentra:
  - datos fiscales del emisor
  - certificados ARCA
  - lookup de padrón
  - apariencia
  - cambio de email y contraseña
- `contribuyente.service.ts` asume un modelo 1:1 entre `auth.users` y `contribuyentes`.

### Facturación

- `facturacion.service.ts` es el servicio central.
- `facturar-nuevo.component.ts` captura monto y fecha, llama a `emitirFactura()` y ofrece acciones sobre el PDF.
- valida fecha según `actividad`:
  - `bienes`: hasta 5 días hacia atrás
  - `servicios`: hasta 10 días hacia atrás

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

Por tipos y uso en la UI, esta tabla contiene al menos:

- identidad fiscal: `cuit`, `razon_social`
- datos visibles en ticket: `nombre_fantasia`, `domicilio`, `condicion_iva`, `ingresos_brutos`, `inicio_actividades`
- defaults de emisión: `concepto`, `actividad`, `iva_porcentaje`, `punto_venta`, `tipo_comprobante_default`
- credenciales operativas: `arca_cert`, `arca_key`, `arca_production`

### `comprobantes`

Usada como tabla unificada para:

- facturas
- notas de crédito

Campos relevantes:

- `tipo_comprobante`
- `numero_comprobante`
- `fecha`
- `total`
- `cae`
- `vencimiento_cae`
- `estado`
- `comprobante_asociado_id`

## Observaciones de arquitectura

- La app depende de un único contribuyente por usuario.
- Los certificados ARCA se guardan en base de datos y no en secrets por función.
- La generación de PDF es local; no hay servicio activo de PDF en backend verificado en este repo.
- El schema SQL versionado no representa completamente el modelo realmente usado por frontend y funciones.
