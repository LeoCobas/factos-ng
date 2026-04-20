# Sectores a documentar mejor

## Prioridad alta

- `supabase/functions/arca-proxy/index.ts`
  - conviene documentar payloads esperados y ejemplos mínimos para:
    - factura
    - nota de crédito
    - receptor con CUIT
  - también conviene dejar documentados los errores AFIP más comunes

- `supabase/functions/padron-lookup/index.ts`
  - merece una nota técnica específica sobre:
    - consulta de constancia de inscripción
    - modo `debug`
    - timeouts
    - significado de `fiscal_status_reliable`

- `src/app/core/services/facturacion.service.ts`
  - concentra lookup fiscal, resolución del tipo, emisión, nota de crédito y persistencia
  - sería útil documentar sus contratos de entrada y salida

- `src/app/core/utils/factura-cliente.util.ts`
  - contiene reglas de negocio críticas para decidir `FACTURA A/B/C`
  - conviene dejar sus casos esperados documentados junto a tests

## Prioridad media

- `src/app/features/facturar/facturar-nuevo.component.ts`
  - ahora tiene lógica de CUIT cliente, mensajes de confiabilidad y fallback
  - conviene documentar el flujo de UI y cuándo pide revisión manual

- `src/app/features/configuracion/configuracion.component.ts`
  - concentra demasiada lógica en un solo archivo
  - conviene separar en docs al menos:
    - datos fiscales
    - certificados
    - cuenta
    - consulta de constancia del emisor

- `src/app/features/listado/listado.component.ts`
  - merece documentación de:
    - cache por fecha
    - relación factura / nota de crédito
    - visualización de datos del cliente

## Prioridad baja

- `src/app/core/utils/constancia-inscripcion.util.ts`
  - documentar las heurísticas para clasificar perfiles fiscales

- `src/app/core/utils/arca-ticket.util.ts`
  - documentar compatibilidad hacia atrás y buckets `wsfe` / `padron`

- `src/app/core/services/auth.service.ts`
  - documentar por qué usa retry y storage custom

- `src/app/shared/components/ui/pdf-viewer.component.ts`
  - documentar limitaciones de PDF.js en mobile

## Inconsistencias o decisiones abiertas

- definir si `verify_jwt = false` en `supabase/config.toml` es intencional o deuda técnica
- revisar si las credenciales de `environment*.ts` deben seguir versionadas
- revisar si la carga de PDF.js desde CDN es aceptable para el entorno operativo real

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
- ubicar módulos y responsabilidades
- seguir los flujos críticos
- identificar deuda documental y técnica sin inflar el repositorio
