# Runtime config

La app cliente ya no versiona la `anonKey` de Supabase dentro de `src/environments`.

## Fuente de verdad

- El cliente carga `public/app-config.json` al arrancar.
- Ese archivo define:
  - `supabase.url`
  - `supabase.anonKey`
- `public/app-config.json` se genera automaticamente con `scripts/generate-runtime-config.mjs` antes de `start`, `build`, `watch`, `test` y `netlify:build`.

## Regla operativa

- `anonKey` no es `service_role`, pero sigue siendo configuracion operativa del despliegue.
- No debe quedar hardcodeada en `environment*.ts`.
- En este repo la app apunta por defecto al proyecto Supabase operativo actual.
- Si en el futuro se separan entornos, cada deploy puede sobreescribir ese archivo sin tocar el bundle.
- Las Edge Functions de este proyecto usan autenticacion propia en codigo y no dependen del verificador legacy `verify_jwt` del gateway.

## Despliegue

- Desarrollo local: no requiere pasos manuales; el script genera `public/app-config.json` con el proyecto actual.
- Netlify: no requiere edicion manual del archivo. Si definis `SUPABASE_URL` y `SUPABASE_ANON_KEY`, el build las usa; si no, usa el proyecto actual por defecto.
- Produccion: se puede sobreescribir ese archivo durante build o deploy si cambia el proyecto.
- Si falta o queda invalido, la app falla al iniciar con un error explicito.
