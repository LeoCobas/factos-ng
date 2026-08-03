# Migracion de Factos a Sao Paulo

## Objetivo

Migrar Factos desde Supabase `us-east-1` a un proyecto nuevo en `sa-east-1` para
eliminar los viajes interregionales de las Edge Functions hacia PostgreSQL. La
migracion debe conservar emision durable, idempotencia, usuarios, datos,
archivos, funciones y capacidad de rollback.

La linea base son las facturas 91 a 93:

- Preparacion Edge a DB: 420 ms promedio.
- Persistencia Edge a DB: 312 ms promedio.
- Trabajo interno de PostgreSQL: menos de 6 ms por operacion.
- Servidor hasta persistir: 971 ms promedio.

El cambio se acepta si reduce al menos 300 ms el promedio servidor hasta
persistir, sin regresiones fiscales ni perdida de datos.

## Estrategia de cupos

La organizacion Free tiene dos proyectos activos: Factos y CC-App. El orden
operativo sera:

1. Inventariar y respaldar Factos y CC-App.
2. Pausar temporalmente CC-App.
3. Crear `Factos Sao Paulo` en `sa-east-1` con compute Free.
4. Migrar y validar Factos en paralelo al proyecto de Virginia.
5. Cortar la aplicacion al nuevo proyecto.
6. Pausar Factos Virginia cuando el nuevo entorno quede aceptado.
7. Reanudar CC-App.

No se eliminara ningun proyecto durante la migracion.

## Respaldo e inventario

Antes de pausar o crear proyectos se guardara un manifiesto local ignorado por
Git con:

- Referencias, regiones y estado de ambos proyectos.
- Conteos de tablas publicas y `auth.users`.
- Extensiones, buckets y cantidad de objetos.
- Edge Functions desplegadas y sus opciones `verify_jwt`.
- Lista de nombres de secretos, sin exponer valores en logs ni archivos
  versionados.
- Migraciones aplicadas y configuracion de Auth relevante.

El respaldo de Factos incluira roles, esquema, datos e historial
`supabase_migrations`. Los archivos binarios de Storage se copiaran por separado;
la metadata SQL no se considerara respaldo suficiente.

## Creacion y restauracion

El proyecto destino se creara en la misma organizacion, region `sa-east-1`, con
una contrasena aleatoria que no se escribira en Git. La restauracion seguira la
guia oficial de Supabase:

1. Restaurar roles, esquema y datos en una unica transaccion cuando sea posible.
2. Restaurar el historial de migraciones.
3. Verificar RLS, RPC, indices, extensiones y publicaciones.
4. Copiar objetos de Storage y comparar conteos y tamanos.
5. Desplegar todas las Edge Functions desde el filesystem del repositorio.
6. Configurar secretos y ajustes de Auth en el destino.

Los usuarios de Auth y sus credenciales se conservaran mediante la restauracion
de base. Los JWT del proyecto anterior no seran validos, por lo que los clientes
deberan iniciar sesion nuevamente despues del corte.

## Validacion

Antes del cambio de frontend se verificara:

- Conteos y checksums logicos de tablas criticas.
- Login real de un usuario de prueba.
- Lectura y escritura bajo RLS.
- Descarga de objetos privados de Storage.
- RPC `prepare_arca_emission`, `finalize_arca_emission` y reconciliacion.
- Prefetch WSFE y renovacion de tickets.
- Emision A, B o C en homologacion segun la condicion fiscal disponible.
- Reenvio del mismo `emision_id` sin duplicacion.
- Auditoria con `getVoucherInfo`.

No se contactara ARCA produccion durante la validacion.

## Corte

El corte actualizara la URL y la clave publica de Supabase en:

- Variables de entorno del hosting.
- Defaults de `generate-runtime-config.mjs`.
- Configuracion PWA que referencia el host anterior.
- Documentacion operativa.

Luego se desplegara el frontend, se limpiara la version PWA anterior y se
validara login, consulta y una emision de homologacion desde escritorio y movil.

## Rollback

Mientras Factos Virginia siga activo, el rollback consiste en restaurar las
variables de entorno y volver a desplegar el frontend anterior. Si el destino ya
recibio nuevas emisiones, antes del rollback se auditaran ambos proyectos contra
ARCA para no perder comprobantes autorizados.

Factos Virginia se pausara, pero no se eliminara, una vez aceptado el destino.
CC-App se reanudara inmediatamente despues. La eliminacion definitiva del
proyecto anterior queda fuera de este cambio.

## Limites de alcance

- No se reescribira el flujo fiscal durante la migracion.
- No se cambiara la estrategia durable ni la numeracion.
- No se optimizaran operaciones que representen solo unos pocos milisegundos.
- No se mezclaran datos de CC-App con Factos.
