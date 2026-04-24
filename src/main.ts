import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { loadRuntimeConfig } from './app/core/config/runtime-config';

export function renderStartupError(error: unknown): void {
  if (typeof document === 'undefined') {
    return;
  }

  const message =
    error instanceof Error
      ? error.message
      : 'No se pudo iniciar la aplicacion. Intenta nuevamente en unos minutos.';
  const container = document.createElement('main');
  container.setAttribute('role', 'alert');
  container.style.cssText = [
    'min-height:100vh',
    'display:grid',
    'place-items:center',
    'padding:24px',
    'font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'background:#f8fafc',
    'color:#0f172a',
  ].join(';');
  container.innerHTML = `
    <section style="max-width:520px;border:1px solid #fecaca;background:#fff;border-radius:8px;padding:20px;box-shadow:0 12px 30px rgba(15,23,42,.08)">
      <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3">No se pudo iniciar la app</h1>
      <p style="margin:0;color:#991b1b;line-height:1.5"></p>
    </section>
  `;
  container.querySelector('p')!.textContent = message;
  document.body.replaceChildren(container);
}

loadRuntimeConfig()
  .then(() => bootstrapApplication(App, appConfig))
  .catch((err) => {
    console.error(err);
    renderStartupError(err);
  });
