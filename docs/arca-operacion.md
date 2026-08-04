# Operacion ARCA

Este documento describe el flujo ARCA vigente y las decisiones operativas que
deben conservarse al modificar la facturacion.

## Entorno operativo

- El backend productivo es `Factos Sao Paulo` (`veqpyhqnpuemdysdorse`) en
  `sa-east-1`.
- El proyecto anterior de Virginia (`ifkfofyylfkxwtxvyewi`) esta pausado y se
  conserva temporalmente como rollback de infraestructura.
- Las Edge Functions `arca-proxy`, `padron-lookup` y `mercadopago-sync` usan
  `@arcasdk/core@2.0.0`.
- ARCA es la fuente canonica de numeracion y autorizacion fiscal.

## Emision individual durable

1. Angular genera un `emision_id` UUID estable para el intento.
2. Al enfocar o escribir un monto valido, y cuando cambia el tipo resuelto, la
   app dispara un prefetch no bloqueante del ultimo comprobante.
3. El prefetch tiene deduplicacion local y utiliza
   `ultimo_comprobante_cache`, con TTL de 15 minutos.
4. `crear-factura` llama una sola vez a `prepare_arca_emission`. La RPC deriva
   el contribuyente mediante la identidad autenticada, obtiene certificados,
   ticket WSFE, cache de numeracion y registra el intento antes de contactar
   ARCA.
5. Con cache fresca se usa `cache + 1`. Sin cache fresca se consulta
   `getLastVoucher(puntoVenta, cbteTipo)` y se guarda el numero en el intento
   antes de autorizar.
6. La emision usa `createVoucher(payload)` con `CbteDesde` y `CbteHasta`
   explicitos. No se usa `createNextVoucher`, porque agregaria una consulta de
   ultimo comprobante en cada emision.
7. `finalize_arca_emission` inserta el comprobante idempotentemente, finaliza
   `arca_emisiones` y actualiza la cache en una transaccion.
8. Angular consume el comprobante ya persistido por la Edge Function; no hace
   una insercion posterior.

Los estados de `arca_emisiones` son `pending`, `authorized`, `persisted`,
`rejected`, `uncertain` y `conflict`. Reenviar el mismo `emision_id` converge
sobre el mismo intento y no debe crear una segunda factura.

## Recuperacion ante respuestas ambiguas

- Ante timeout, desconexion o respuesta ambigua, se consulta primero
  `getVoucherInfo(numero, puntoVenta, cbteTipo)`.
- Un comprobante se recupera solamente si coinciden numero, punto de venta,
  tipo, fecha, documento, concepto, moneda y total, con tolerancia de un
  centavo.
- Si coincide, se persiste y responde exito sin volver a emitir.
- Si ARCA devuelve otro payload, el intento pasa a `conflict` y no se emite
  automaticamente otro numero.
- Ante rechazo de numeracion se inspecciona primero el numero intentado. Si
  corresponde a otra emision legitima, se actualiza `getLastVoucher` y se
  permite un solo reintento con el siguiente numero.

## Reconciliacion

`arca-proxy` expone dos acciones administrativas autenticadas:

- `reconciliar-comprobante`: consulta un numero con `getVoucherInfo` y lo
  importa o completa cuando la identidad fiscal es inequivoca.
- `auditar-comprobantes`: compara hasta los ultimos 100 numeros de facturas A,
  B o C y consulta ARCA solamente para faltantes o inconsistencias.

La reconciliacion conserva datos locales que ARCA no devuelve. Las
importaciones sin datos locales usan `origen = reconciliacion`. Una coincidencia
ambigua se reporta como conflicto y no se sobrescribe.

La auditoria inicial de agosto de 2026 dejo 207 comprobantes reconciliados. Se
preservaron 183 registros locales que habian sido duplicados por la primera
version de la importacion, se conservaron 24 importaciones realmente ausentes y
el resultado final quedo sin duplicados fiscales. Los pares reparados tienen un
respaldo privado en `private.reconciliation_duplicate_backup_20260804`.

Los registros historicos sin `cbte_nro` no se reconcilian masivamente. Se
auditan de forma individual o por rangos controlados cuando exista una necesidad
operativa.

## Tickets ARCA

- Los certificados de cada contribuyente viven en `contribuyentes`.
- Sus tickets se almacenan en `contribuyentes.arca_ticket`, separados en los
  buckets `wsfe` y `padron` mediante `SupabaseArcaTicketStorage`.
- El certificado de sistema para onboarding utiliza
  `SupabaseSystemArcaTicketStorage` y la tabla `arca_system_tickets`.
- El ticket de sistema se separa por nombre de servicio, CUIT emisor y ambiente.
- Ningun ticket con menos de 60 segundos de vigencia se reutiliza.
- `arca_system_tickets` tiene RLS y no concede acceso a `anon` ni
  `authenticated`; solamente la Edge Function accede con `service_role`.

## Consulta de constancia y onboarding

`padron-lookup` exige una sesion Supabase valida. Si el usuario tiene certificado
propio, lo usa y persiste su ticket `padron`. Si todavia no tiene certificado,
usa estas variables del entorno de la Edge Function:

- `SYSTEM_ARCA_CERT`
- `SYSTEM_ARCA_KEY`
- `SYSTEM_ARCA_CUIT`
- `SYSTEM_ARCA_PRODUCTION`

El certificado de sistema debe ser dedicado y tener autorizacion solamente para
el web service de Consulta de Constancia de Inscripcion. No debe autorizar WSFE.

Cada usuario autenticado puede realizar 10 consultas por ventana fija de 60
segundos. El consumo es atomico en PostgreSQL. Al superar el limite la funcion
responde HTTP `429`, incluye `Retry-After` y no contacta ARCA. La tabla de cuota
no es accesible desde roles cliente.

Hasta configurar los cuatro secretos, el lookup automatico del onboarding
devuelve un error operativo y el usuario puede completar sus datos manualmente.

## Despliegue y verificacion

Los cambios de esquema se versionan en `supabase/migrations`. Para cambios ARCA:

1. ejecutar tests Deno de `supabase/functions/_shared`;
2. ejecutar las pruebas SQL transaccionales de `supabase/tests`;
3. ejecutar `npm run test:facturar`, `npm test` y `npm run build`;
4. aplicar la migracion en Sao Paulo;
5. desplegar la Edge Function afectada;
6. revisar Security Advisor y logs antes de probar contra ARCA.

No deben incluirse certificados, claves privadas, tickets o secretos Supabase en
el repositorio, documentacion, logs ni frontend.
