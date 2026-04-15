# Sectores a documentar mejor

## Prioridad alta

- `supabase/schema.sql`
  - no refleja el modelo real que usan `database.types.ts`, `configuracion.component.ts` y las Edge Functions
  - conviene versionar migraciones reales o reescribir este schema base

- `supabase/functions/arca-proxy/index.ts`
  - falta una referencia breve de payloads esperados, errores frecuentes y supuestos de negocio

- `supabase/functions/padron-lookup/index.ts`
  - conviene documentar qué devuelve realmente, qué campos se infieren y cuáles quedan fijos

- `src/app/core/services/facturacion.service.ts`
  - debería explicarse la relación entre validaciones locales, llamado a Edge Function y persistencia en `comprobantes`

## Prioridad media

- `src/app/features/configuracion/configuracion.component.ts`
  - concentra demasiada lógica en un solo archivo
  - conviene separar en docs al menos:
    - datos fiscales
    - certificados
    - cuenta
    - lookup de padrón

- `src/app/features/listado/listado.component.ts`
  - es uno de los componentes más grandes del proyecto
  - merece documentación de:
    - cache por fecha
    - relación factura / nota de crédito
    - estados de UI

- `src/app/core/services/pdf.service.ts`
  - conviene documentar mejor el flujo vigente basado en blobs locales y `pdfmake`

## Prioridad baja

- `src/app/core/services/auth.service.ts`
  - documentar por qué usa retry y storage custom

- `src/app/core/services/theme.service.ts`
  - documentar persistencia local y estrategia `auto`

- `src/app/shared/components/ui/pdf-viewer.component.ts`
  - documentar limitaciones de PDF.js en mobile y qué caminos están activos o heredados

## Inconsistencias que conviene resolver primero

- actualizar o reemplazar `supabase/schema.sql`
- definir si `verify_jwt = false` en `supabase/config.toml` es intencional
- eliminar configuración heredada de `tusFacturas` si ya no forma parte del sistema
- revisar el manejo de certificados ARCA en `contribuyentes`

## Estructura de docs sugerida

La estructura mínima razonable para este proyecto es:

```text
README.md
docs/
  arquitectura.md
  flujos-clave.md
  sectores-a-documentar.md
```

Con eso alcanza para:

- entender el alcance real
- ubicar módulos y responsabilidades
- seguir los flujos críticos
- identificar deuda documental y técnica sin inflar el repositorio
