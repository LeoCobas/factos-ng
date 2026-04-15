# FACTOS-NG

Aplicación privada de facturación electrónica construida con Angular y Supabase para operar con clientes reales.

No es un proyecto open source listo para reutilizar, exponer públicamente ni desplegar sin revisión. La documentación de este repositorio describe el estado actual del código, no una solución endurecida para terceros.

## Estado del proyecto

- Uso previsto: operación personal / controlada.
- Estado funcional: autenticación, configuración del contribuyente, emisión de comprobantes, anulación con nota de crédito, consulta de padrón ARCA y generación local de PDF.
- Estado operativo: hay inconsistencias entre código, schema y documentación previa; este README y `docs/` reflejan únicamente lo verificado en el repositorio.

## Stack real

- Angular 20 con standalone components, signals y reactive forms
- Supabase:
  - Auth
  - tablas `contribuyentes` y `comprobantes`
  - Edge Functions `arca-proxy` y `padron-lookup`
- `@arcasdk/core` en las Edge Functions
- `pdfmake` para generar tickets PDF en el cliente
- PDF.js cargado desde CDN para vista e impresión

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
- `configuracion`: alta/edición del contribuyente, carga de certificados ARCA, lookup de padrón, cambio de email/password y tema.
- `facturar`: emite facturas y muestra las últimas tres emitidas.
- `listado`: consulta comprobantes por fecha, permite ver/descargar/compartir/imprimir y anular facturas.
- `totales`: resume importes y cantidades por período.
- `core/services/facturacion.service.ts`: orquesta emisión y nota de crédito contra `arca-proxy` y persistencia en Supabase.
- `core/services/pdf.service.ts` + `factura-pdf.service.ts`: generan el ticket PDF localmente.

## Cómo leer la documentación

- [Arquitectura](./docs/arquitectura.md)
- [Flujos clave](./docs/flujos-clave.md)
- [Sectores a documentar mejor](./docs/sectores-a-documentar.md)

## Inconsistencias detectadas

- `src/environments/environment*.ts` todavía conserva una sección `tusFacturas`, pero el flujo actual usa ARCA vía `arca-proxy`.
- `supabase/schema.sql` define `wsaa_tickets`, pero las Edge Functions actuales guardan el ticket en `contribuyentes.arca_ticket`.
- `supabase/schema.sql` no refleja varios campos tipados y usados por la app (`nombre_fantasia`, `domicilio`, `condicion_iva`, `arca_cert`, `arca_key`, `arca_production`, entre otros).
- `supabase/config.toml` tiene `verify_jwt = false`, aunque las funciones igualmente dependen del header `Authorization` y del usuario autenticado para resolver el contribuyente.

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

## Configuración esperada

### Frontend

La app lee la configuración de Supabase desde `src/environments/environment.ts` y `src/environments/environment.prod.ts`.

Supuesto: hoy esos archivos se usan tal como están en el repo. No hay un mecanismo separado de `environment.local.ts` implementado en la configuración de Angular.

### Supabase / Edge Functions

Según el código, las Edge Functions necesitan al menos:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` para el camino de lectura privilegiada en `padron-lookup`

Además, los certificados ARCA no se leen desde secrets globales en las funciones actuales: se guardan en la fila del contribuyente y se recuperan desde la tabla `contribuyentes`.

## Alcance y límites

- La documentación describe el comportamiento actual del código.
- No asume que el diseño sea seguro para terceros.
- No recomienda publicar este repositorio ni reutilizarlo sin una revisión técnica y de seguridad específica.
