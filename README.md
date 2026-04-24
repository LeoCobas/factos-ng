# FACTOS-NG

Aplicacion privada de facturacion electronica construida con Angular, Supabase y ARCA para operar con clientes reales.

No es un proyecto open source listo para reutilizar, exponer publicamente ni desplegar sin revision. La documentacion describe el estado actual del codigo y sus supuestos operativos.

## Estado actual

- Uso previsto: operacion personal o controlada.
- Estado funcional: autenticacion, configuracion del contribuyente, gestion de certificados ARCA, emision de facturas A/B/C, anulacion con nota de credito, consulta de constancia de inscripcion, generacion local de PDF e instalacion PWA.
- Estado tecnico: base alineada con Angular 21, guards sin navegacion imperativa, formularios reactivos tipados en flujos principales, responsabilidades mejor separadas entre componentes y servicios.
- Estado documental: este README y `docs/` reflejan el codigo vigente en `src/` y `supabase/`.

## Stack real

- Angular 21 con standalone components, signals para estado UI local y reactive forms tipados en los flujos principales
- Supabase:
  - Auth
  - Postgres con `contribuyentes` y `comprobantes`
  - Edge Functions `arca-proxy` y `padron-lookup`
- `@arcasdk/core@0.3.6` en las Edge Functions
- Tailwind CSS 4
- `pdfmake` para generar tickets PDF localmente
- PDF.js empaquetado localmente con worker servido desde `/assets/pdfjs`
- PWA con manifest, service worker Angular, iconos Factos y cache headers especificos para iconos instalables
- ESLint 9 + `angular-eslint`
- Vitest para componentes, servicios y reglas de negocio

## Estructura relevante

```text
src/
  app/
    core/
      config/
      guards/
      services/
      types/
      utils/
    features/
      auth/
      configuracion/
      facturar/
      listado/
      totales/
    layouts/
    shared/
  environments/
supabase/
  functions/
    arca-proxy/
    padron-lookup/
  schema.sql
docs/
  arquitectura.md
  backend-operational-contracts.md
  flujos-clave.md
  runtime-config.md
  sectores-a-documentar.md
```

## Modulos principales

- `auth`: login por email/password con Supabase Auth.
- `configuracion`: alta o edicion del contribuyente, monto maximo por factura, carga de certificados ARCA, consulta de constancia de inscripcion por CUIT, cambio de email/password y tema.
- `facturar`: emision de comprobantes con lookup opcional de CUIT cliente, resolucion automatica de `FACTURA A`, `B` o `C`, confirmacion si se supera el monto maximo, panel de resultado emitido y bloque de facturas recientes.
- `listado`: consulta comprobantes por fecha, visualizacion, descarga, compartido, impresion y anulacion con nota de credito.
- `totales`: resumen de importes y cantidades por periodo.
- `core/services/auth.service.ts`: fuente unica de verdad del estado de sesion e inicializacion de auth.
- `core/services/facturacion.service.ts`: operaciones activas de negocio, como emitir factura, crear nota de credito, lookup de cliente y cargar facturas recientes.
- `core/services/comprobantes.service.ts`: consultas de lectura para listados y metricas.
- `core/services/pdf.service.ts` y `core/services/factura-pdf.service.ts`: contrato tipado comun para generar, descargar, compartir e imprimir comprobantes.
- `core/services/pdfjs-loader.service.ts`: carga PDF.js desde dependencia local y fija el worker local comun para visor e impresion.
- `core/services/theme.service.ts`: persiste `light`, `dark` o `auto`, aplica clases globales y actualiza `meta[name="theme-color"]`.

## Refactors aplicados en esta etapa

- Auth y routing:
  - guards que devuelven `boolean | UrlTree`
  - espera explicita a la inicializacion del estado auth antes de resolver acceso
  - navegacion post-login y post-signout centralizada
- Formularios:
  - `login`, `configuracion` y `facturar` sobre formularios reactivos tipados
  - eliminacion de sincronizacion manual con DOM y observers en login
- Configuracion:
  - extraccion de secciones dedicadas para facturacion, certificado y cuenta
  - payloads tipados para contribuyente, certificados y cuenta
- Facturacion y comprobantes:
  - `FacturarNuevoComponent` reordenado como contenedor del flujo
  - extraccion de `FacturaClienteLookupSectionComponent`
  - extraccion de `FacturasRecientesPanelComponent`
  - `ComprobantesService` como frontera de lectura para `listado` y `totales`
  - validacion de fecha contra la ultima autorizada del mismo tipo de comprobante y punto de venta
  - confirmacion temporizada cuando el monto supera `monto_maximo_factura`
- PDF:
  - nuevo contrato `PdfComprobanteData` / `PdfInfo`
  - eliminacion de `any` en el flujo principal de PDF
  - PDF.js deja de depender de CDN y usa modulo/worker locales
- UI/PWA:
  - preview del contribuyente en el header con acceso a configuracion y cierre de sesion
  - ajuste de contraste para tema claro y oscuro
  - iconos PWA `factos-icon-*`, favicon actualizado y cache headers en Netlify
- Calidad:
  - mas cobertura en guards, auth flow, login, configuracion, comprobantes y facturacion

## Flujos cubiertos

- Auth con Supabase y guards de ruta.
- Configuracion del emisor y certificados ARCA en `contribuyentes`.
- Consulta de constancia de inscripcion por CUIT usando `padron-lookup`.
- Clasificacion fiscal del cliente y resolucion del tipo de comprobante.
- Emision y anulacion via `arca-proxy`.
- Generacion de PDF local con `pdfmake`.
- Visualizacion e impresion con PDF.js local.
- Validacion de ventana fiscal y monotonia de fechas por tipo de comprobante.

## Como leer la documentacion

- [Arquitectura](./docs/arquitectura.md)
- [Flujos clave](./docs/flujos-clave.md)
- [Runtime config](./docs/runtime-config.md)
- [Contratos operativos de backend](./docs/backend-operational-contracts.md)
- [Sectores a documentar mejor](./docs/sectores-a-documentar.md)

## Observaciones e inconsistencias vigentes

- `supabase/config.toml` mantiene `verify_jwt = false`, aunque ambas funciones validan al usuario usando el token recibido por `Authorization`.
- `src/environments/environment*.ts` ya no contiene credenciales Supabase; solo define `runtimeConfigPath`.
- `public/app-config.json` se genera en scripts de npm y contiene la configuracion operativa del cliente.
- `src/app/features/listado/listado.component.ts` todavia tiene un bloque legacy comentado del acceso directo anterior a Supabase. El flujo runtime ya usa `ComprobantesService`, pero queda limpieza pendiente del archivo.

## Puesta en marcha local

### Requisitos

- Node.js `>=20.19.0`
- npm `>=10`

### Comandos

```bash
npm install
npm start
```

Build de produccion:

```bash
npm run build
```

Tests:

```bash
npm test
```

Modo watch para desarrollo:

```bash
npm run test:watch
```

Solo facturacion:

```bash
npm run test:facturar
```

Lint:

```bash
npm run lint
```

## Configuracion esperada

### Frontend

La app lee `runtimeConfigPath` desde `src/environments/environment.ts` y `src/environments/environment.prod.ts`.

La URL y la `anonKey` de Supabase se cargan en runtime desde `public/app-config.json`, generado por `scripts/generate-runtime-config.mjs` antes de `start`, `build`, `watch`, `test` y `netlify:build`.

### Supabase / Edge Functions

Segun el codigo, las Edge Functions necesitan al menos:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` para el acceso privilegiado de lectura en `padron-lookup`

Los certificados ARCA y el ticket WSAA no se leen desde secrets globales: se guardan en la fila del contribuyente.

## Alcance y limites

- La documentacion describe comportamiento real verificado en el repositorio.
- No afirma que el diseño sea seguro para terceros.
- No recomienda publicar este repositorio ni reutilizarlo sin revision tecnica y de seguridad especifica.
