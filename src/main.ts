import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

loadRuntimeConfig()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => {
    console.error(err);

    if (typeof window !== 'undefined') {
      alert(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar la aplicacion. Intenta nuevamente en unos minutos.',
      );
    }
  });
