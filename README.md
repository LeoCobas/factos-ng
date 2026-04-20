# FACTOS-NG

Aplicación privada de facturación electrónica construida con Angular, Supabase y ARCA para operar con clientes reales.

No es un proyecto open source listo para reutilizar, exponer públicamente ni desplegar sin revisión. La documentación describe el estado actual del código y sus supuestos operativos.

## Estado actual

- Uso previsto: operación personal o controlada.
- Estado funcional: autenticación, configuración del contribuyente, gestión de certificados ARCA, emisión de facturas A/B/C, anulación con nota de crédito, consulta de constancia de inscripción y generación local de PDF.
- Estado documental: este README y `docs/` reflejan el código vigente en `src/` y `supabase/`.

## Stack real

- Angular 21 con standalone components, signals y reactive forms
- Supabase:
  - Auth
  - Postgres con `contribuyentes` y `comprobantes`
  - Edge Functions `arca-proxy` y `padron-lookup`
- `@arcasdk/core@0.3.6` en las Edge Functions
- Tailwind CSS 4
- `pdfmake` para generar tickets PDF localmente
- PDF.js cargado desde CDN para visualización e impresión
- ESLint 9 + `angular-eslint`
- Vitest para utilidades y reglas de negocio

## Estructura relevante

```text
src/
  app/
    core/
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
  flujos-clave.md
  sectores-a-documentar.md
```

## Módulos principales

- `auth`: login por email/password con Supabase Auth.
- `configuracion`: alta o edición del contribuyente, carga de certificados ARCA, consulta de constancia de inscripción por CUIT, cambio de email/password y tema.
- `facturar`: emisión de comprobantes con búsqueda opcional de CUIT cliente y resolución automática de `FACTURA A`, `B` o `C`.
- `listado`: consulta comprobantes por fecha, visualización, descarga, compartido, impresión y anulación con nota de crédito.
- `totales`: resumen de importes y cantidades por período.
- `core/services/facturacion.service.ts`: orquesta lookup fiscal del cliente, emisión, nota de crédito y persistencia.
- `core/utils/constancia-inscripcion.util.ts`: clasifica la condición fiscal devuelta por la constancia.
- `core/utils/factura-cliente.util.ts`: normaliza condición IVA, documento del receptor y reglas de selección A/B/C.
- `core/utils/arca-ticket.util.ts`: separa el caché de tickets ARCA en buckets `wsfe` y `padron`.

## Flujos cubiertos

- Auth con Supabase y guards de ruta.
- Configuración del emisor y certificados ARCA en `contribuyentes`.
- Consulta de constancia de inscripción por CUIT usando `padron-lookup`.
- Clasificación fiscal del cliente y resolución del tipo de comprobante.
- Emisión y anulación vía `arca-proxy`.
- Generación de PDF local con `pdfmake`.

## Cómo leer la documentación

- [Arquitectura](./docs/arquitectura.md)
- [Flujos clave](./docs/flujos-clave.md)
- [Sectores a documentar mejor](./docs/sectores-a-documentar.md)

## Observaciones e inconsistencias vigentes

- `supabase/config.toml` mantiene `verify_jwt = false`, aunque ambas funciones validan al usuario usando el token recibido por `Authorization`.
- `src/environments/environment*.ts` contiene credenciales embebidas del proyecto actual.
- PDF.js se carga desde CDN; ese comportamiento depende de conectividad hacia `jsdelivr` o `unpkg`.

## Puesta en marcha local

### Requisitos

- Node.js `>=20.19.0`
- npm `>=10`

### Comandos

```bash
npm install
npm start
```

Build de producción:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

## Configuración esperada

### Frontend

La app lee Supabase desde `src/environments/environment.ts` y `src/environments/environment.prod.ts`.

Supuesto: hoy esos archivos se usan tal como están y no hay un mecanismo alternativo versionado en Angular para entornos locales.

### Supabase / Edge Functions

Según el código, las Edge Functions necesitan al menos:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` para el acceso privilegiado de lectura en `padron-lookup`

Los certificados ARCA y el ticket WSAA no se leen desde secrets globales: se guardan en la fila del contribuyente.

## Alcance y límites

- La documentación describe comportamiento real verificado en el repositorio.
- No afirma que el diseño sea seguro para terceros.
- No recomienda publicar este repositorio ni reutilizarlo sin revisión técnica y de seguridad específica.
