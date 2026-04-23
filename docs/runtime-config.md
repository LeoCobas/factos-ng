# Runtime config

La app cliente ya no versiona la `anonKey` de Supabase dentro de `src/environments`.

## Fuente de verdad

- El cliente carga `public/app-config.json` al arrancar.
- Ese archivo define:
  - `supabase.url`
  - `supabase.anonKey`
- `public/app-config.json` se genera automaticamente con `scripts/generate-runtime-config.mjs` antes de `start`, `build`, `watch`, `test` y `netlify:build`.
- `environment.ts` y `environment.prod.ts` solo conservan `runtimeConfigPath`.

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

## Assets runtime

- PDF.js se importa desde `pdfjs-dist` dentro del bundle.
- El worker `pdf.worker.min.mjs` se copia desde `node_modules/pdfjs-dist/build` a `/assets/pdfjs`.
- El visor y la impresion comparten `PdfjsLoaderService`, por lo que no hay fallback documentado a CDN.
- La PWA usa iconos versionados como `icons/factos-icon-*.png`; Netlify fuerza revalidacion/caching correcto de esos assets para apps instaladas.
