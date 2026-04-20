# Runtime config

La app cliente ya no versiona la `anonKey` de Supabase dentro de `src/environments`.

## Fuente de verdad

- El cliente carga `public/app-config.json` al arrancar.
- Ese archivo define:
  - `supabase.url`
  - `supabase.anonKey`

## Regla operativa

- `anonKey` no es `service_role`, pero sigue siendo configuracion operativa del despliegue.
- No debe editarse en codigo fuente ni quedar hardcodeada en `environment*.ts`.
- Cada entorno debe publicar su propio `app-config.json`.

## Despliegue

- Desarrollo local: completar `public/app-config.json` con los valores del proyecto.
- Produccion: sobreescribir ese archivo durante build o deploy.
- Si falta o queda con placeholders, la app falla al iniciar con un error explicito.
