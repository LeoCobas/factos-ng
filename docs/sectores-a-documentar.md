# Sectores a documentar mejor

## Prioridad alta

- errores AFIP/ARCA frecuentes
  - ya existe un contrato operativo base en `docs/backend-operational-contracts.md`
  - queda sumar ejemplos reales de rechazos y mensajes recomendados para soporte

- `supabase/functions/padron-lookup/index.ts`
  - el contrato base ya esta documentado
  - queda profundizar ejemplos de constancias ambiguas y criterios de `fiscal_status_reliable`

- `src/app/core/services/facturacion.service.ts`
  - hoy concentra las operaciones transaccionales mas criticas
  - conviene documentar contratos de entrada/salida para:
    - lookup de cliente
    - emitir factura
    - crear nota de credito
    - cargar facturas recientes
    - validacion de ultima fecha por tipo/punto de venta

- `src/app/core/services/comprobantes.service.ts`
  - es la nueva frontera de lectura para `listado` y `totales`
  - conviene dejar documentado:
    - que queries resuelve
    - que view models tipados expone
    - que decisiones de mapeo quedan en el servicio y no en los componentes

- `src/app/core/types/pdf.types.ts`
  - conviene documentar el contrato comun de PDF y sus adaptadores esperados
  - eso evita volver a introducir objetos "parecidos a factura" sin tipo

## Prioridad media

- `src/app/features/facturar/facturar-nuevo.component.ts`
  - ahora es un contenedor mas claro, pero sigue siendo el coordinador del flujo
  - conviene documentar:
    - limites de fecha
    - minimo dinamico por ultima fecha autorizada del tipo resuelto
    - confirmacion por `monto_maximo_factura`
    - reset post-emision
    - recarga de recientes
    - sincronizacion del CUIT ingresado

- `src/app/features/facturar/factura-cliente-lookup-section.component.ts`
  - merece una nota corta de responsabilidades
  - especialmente que no consulta servicios ni crea formularios propios

- `src/app/features/configuracion/configuracion.component.ts`
  - aunque ya esta dividido por secciones, conviene documentar:
    - tabs y ownership del contenedor
    - payloads de guardado
    - cuando se limpia `arca_ticket`
    - como se guarda `monto_maximo_factura` y por que `0` significa sin limite

- `src/app/features/listado/listado.component.ts`
  - ya consume `ComprobantesService`, pero aun conserva algo de ruido legacy
  - conviene documentar:
    - cache por fecha
    - relacion factura / nota de credito
    - adaptacion de comprobantes al contrato PDF

- `src/app/features/totales/totales.component.ts`
  - ahora depende del dominio tipado de comprobantes
  - conviene documentar el criterio de calculo y el tratamiento de notas de credito

## Prioridad baja

- `src/app/core/utils/constancia-inscripcion.util.ts`
  - documentar las heuristicas para clasificar perfiles fiscales

- `src/app/core/utils/arca-ticket.util.ts`
  - documentar compatibilidad hacia atras y buckets `wsfe` / `padron`

- `src/app/core/services/auth.service.ts`
  - documentar inicializacion de sesion, storage custom y criterio de navegacion post-auth

- `src/app/shared/components/ui/pdf-viewer.component.ts`
  - documentar limitaciones de PDF.js local en mobile e impresion

- `src/app/core/services/theme.service.ts`
  - documentar persistencia de `light` / `dark` / `auto`
  - documentar actualizacion de `meta[name="theme-color"]`

- PWA assets
  - documentar relacion entre `manifest.webmanifest`, `src/index.html`, iconos `factos-icon-*`, `ngsw-config.json` y headers de `netlify.toml`

## Inconsistencias o decisiones abiertas

- `supabase/config.toml` mantiene `verify_jwt = false`; las functions validan JWT en codigo usando `Authorization`.
- `environment*.ts` ya no versiona URL/anonKey Supabase; la fuente runtime es `public/app-config.json`.
- PDF.js ya no depende de CDN; el worker local se copia a `/assets/pdfjs`.
- `public/manifest.webmanifest` conserva descripcion legacy de TusFacturas aunque la app vigente opera con Factos/ARCA.
- limpiar el bloque legacy comentado que sigue en `src/app/features/listado/listado.component.ts`
- evaluar una pasada mas amplia de normalizacion UTF-8 en archivos no tocados por los refactors

## Estructura de docs sugerida

La estructura simple actual sigue siendo razonable:

```text
README.md
docs/
  arquitectura.md
  backend-operational-contracts.md
  flujos-clave.md
  runtime-config.md
  sectores-a-documentar.md
```

Con eso alcanza para:

- entender el alcance real
- ubicar modulos y responsabilidades
- seguir los flujos criticos
- identificar deuda documental y tecnica sin inflar el repositorio
