import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import type { MensajeEstado } from './configuracion.types';

@Component({
  selector: 'app-configuracion-mercadopago-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form (ngSubmit)="onSubmit()" class="space-y-5">
      <div class="card-surface">
        <div class="card-header">
          <div class="flex items-start gap-3">
            <svg
              class="mt-1 h-5 w-5 text-sky-600 dark:text-sky-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect x="2" y="5" width="20" height="14" rx="2" stroke-width="2" />
              <line x1="2" y1="10" x2="22" y2="10" stroke-width="2" />
              <path d="M6 14h2" stroke-width="2" stroke-linecap="round" />
            </svg>
            <div>
              <h3 class="card-title">Configuraci&oacute;n de Mercado Pago</h3>
            </div>
          </div>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label" for="mp-token-input">Access Token de Producci&oacute;n</label>
            </div>
            <div class="relative flex items-center gap-2">
              <input
                [type]="showToken() ? 'text' : 'password'"
                [formControl]="tokenControl"
                id="mp-token-input"
                class="form-input pr-10"
                [placeholder]="tieneToken() ? '••••••••••••••••••••••••••••••••' : 'APP_USR-...'"
                aria-label="Access Token de Mercado Pago"
              />
              <button
                type="button"
                (click)="showToken.set(!showToken())"
                class="absolute right-3 text-muted-foreground hover:text-foreground transition-colors"
                title="Mostrar/Ocultar Token"
              >
                @if (showToken()) {
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                } @else {
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                }
              </button>
            </div>
            <p class="form-help">
              Ingres&aacute; el &quot;Access token&quot; de producci&oacute;n de tu aplicaci&oacute;n de Mercado Pago. Pod&eacute;s crearlo u obtenerlo desde el
              <a
                href="https://www.mercadopago.com.ar/developers/panel"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline font-medium"
                >Developer Dashboard de Mercado Pago</a
              >.
            </p>
          </div>

          @if (tieneToken()) {
            <div class="config-status config-status--success flex items-center justify-between p-3 rounded-lg border">
              <span class="text-sm font-medium">
                &#x2714; Mercado Pago est&aacute; conectado y listo para usar.
              </span>
              <button
                type="button"
                (click)="onDisconnect()"
                class="text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-semibold underline transition-colors"
              >
                Desconectar
              </button>
            </div>
          } @else {
            <div class="config-status config-status--warning flex items-center gap-2 p-3 rounded-lg border">
              <span class="text-sm font-medium">
                &#x26A0; Falta configurar el token para poder importar transacciones.
              </span>
            </div>
          }
        </div>
      </div>

      @if (mensaje()) {
        <div
          class="config-status p-3 rounded-lg border text-sm"
          [class.config-status--success]="mensaje()?.tipo === 'success'"
          [class.config-status--error]="mensaje()?.tipo !== 'success'"
        >
          {{ mensaje()?.texto }}
        </div>
      }

      <button
        type="submit"
        [disabled]="guardando() || (!tokenControl.value && !tieneToken())"
        [class.btn-loading--active]="guardando()"
        class="btn-primary btn-loading w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="btn-loading__content">
          @if (guardando()) {
            <span class="btn-loading__spinner" aria-hidden="true"></span>
            <span>Guardando token...</span>
          } @else {
            <span>{{ tieneToken() ? 'Actualizar Token' : 'Guardar Token' }}</span>
          }
        </span>
      </button>
    </form>
  `,
})
export class ConfiguracionMercadopagoFormComponent {
  readonly tieneToken = input.required<boolean>();
  readonly guardando = input.required<boolean>();
  readonly mensaje = input<MensajeEstado | null>(null);

  readonly guardar = output<string>();

  readonly tokenControl = new FormControl('', Validators.required);
  readonly showToken = signal(false);

  onSubmit() {
    if (this.tokenControl.invalid && !this.tieneToken()) return;
    this.guardar.emit(this.tokenControl.value || '');
    this.tokenControl.reset('');
  }

  onDisconnect() {
    if (confirm('¿Estás seguro de que querés desconectar Mercado Pago?')) {
      this.guardar.emit('');
      this.tokenControl.reset('');
    }
  }
}
