# Sectores a documentar mejor

## Prioridad alta

- `supabase/functions/arca-proxy/index.ts`
  - conviene documentar payloads esperados y ejemplos minimos para:
    - factura
    - nota de credito
    - receptor con CUIT
  - tambien conviene dejar documentados los errores AFIP/ARCA mas comunes

- `supabase/functions/padron-lookup/index.ts`
  - merece una nota tecnica especifica sobre:
    - consulta de constancia de inscripcion
    - timeouts
    - significado de `fiscal_status_reliable`

- `src/app/core/services/facturacion.service.ts`
  - hoy concentra las operaciones transaccionales mas criticas
  - conviene documentar contratos de entrada/salida para:
    - lookup de cliente
    - emitir factura
    - crear nota de credito
    - cargar facturas recientes

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
  - documentar limitaciones de PDF.js en mobile

## Inconsistencias o decisiones abiertas

- documentar que `arca-proxy` y `padron-lookup` requieren `verify_jwt = true` y JWT valido
- revisar si las credenciales de `environment*.ts` deben seguir versionadas
- revisar si la carga de PDF.js desde CDN es aceptable para el entorno operativo real
- limpiar el bloque legacy comentado que sigue en `src/app/features/listado/listado.component.ts`
- evaluar una pasada mas amplia de normalizacion UTF-8 en archivos no tocados por los refactors

## Estructura de docs sugerida

La estructura simple actual sigue siendo razonable:

```text
README.md
docs/
  arquitectura.md
  flujos-clave.md
  sectores-a-documentar.md
```

Con eso alcanza para:

- entender el alcance real
- ubicar modulos y responsabilidades
- seguir los flujos criticos
- identificar deuda documental y tecnica sin inflar el repositorio
