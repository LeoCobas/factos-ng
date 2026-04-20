# Arquitectura

## Resumen

FACTOS-NG es una SPA Angular 21 que usa Supabase como backend operativo y delega la integracion con ARCA a Edge Functions.

El flujo base actual es:

1. el usuario se autentica con Supabase Auth
2. la app inicializa el estado de sesion antes de resolver guards
3. la app carga un unico `contribuyente` por usuario
4. la UI puede consultar constancia de inscripcion de un CUIT
5. la app clasifica la condicion fiscal del cliente
6. resuelve automaticamente si corresponde `FACTURA A`, `B` o `C`
7. emite o anula comprobantes mediante `arca-proxy`
8. persiste el resultado autorizado en `comprobantes`
9. genera tickets PDF en el cliente con `pdfmake`

## Capas

### Frontend

- `src/app/app.routes.ts`: define `login` como ruta publica y el resto bajo guards basados en `UrlTree`.
- `src/app/layouts/main-layout.component.ts`: layout autenticado, navegacion principal y carga inicial del contribuyente.
- `src/app/features/*`: pantallas funcionales.
- `src/app/core/services/*`: integracion con Supabase, auth, facturacion, comprobantes, PDFs y tema.
- `src/app/core/types/*`: contratos compartidos para formularios, comprobantes y PDF.
- `src/app/core/utils/*`: reglas fiscales, normalizacion de datos y manejo de tickets ARCA.
- `src/app/shared/components/ui/*`: componentes de UI y visor PDF.

### Backend operativo

- Supabase Auth para sesion y usuario.
- Supabase Postgres para:
  - `contribuyentes`
  - `comprobantes`
- Edge Functions:
  - `arca-proxy`: emision, nota de credito y consulta del ultimo comprobante
  - `padron-lookup`: consulta de constancia de inscripcion y clasificacion fiscal basica

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

### Configuracion

- `configuracion.component.ts` queda como contenedor de tabs, mensajes globales y coordinacion.
- secciones extraidas:
  - facturacion
  - certificado
  - cuenta
- la estrategia de formularios esta unificada bajo reactive forms tipados.
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
- `pdfjs-print.service.ts` y `pdf-viewer.component.ts` cargan PDF.js desde CDN.

## Modelo de datos real

### `contribuyentes`

Campos relevantes usados por frontend y Edge Functions:

- identidad fiscal: `cuit`, `razon_social`
- datos visibles en ticket: `nombre_fantasia`, `domicilio`, `condicion_iva`, `ingresos_brutos`, `inicio_actividades`
- defaults de emision: `concepto`, `actividad`, `iva_porcentaje`, `punto_venta`, `tipo_comprobante_default`
- credenciales y estado ARCA: `arca_cert`, `arca_key`, `arca_production`, `arca_ticket`

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

## Observaciones de arquitectura

- La app depende de un unico contribuyente por usuario.
- Los certificados ARCA se guardan en base de datos y no en secrets por funcion.
- El schema SQL versionado esta alineado con `database.types.ts` y con los campos que persisten frontend y functions.
- `padron-lookup` ya no devuelve una condicion fija: deriva estado fiscal desde constancia de inscripcion.
- Queda una deuda de limpieza puntual en `listado.component.ts`, donde el flujo nuevo ya esta activo pero aun sobrevive codigo legacy comentado del acceso previo directo a Supabase.
