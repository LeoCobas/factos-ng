import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { ThemeMode } from '../../core/services/theme.service';
import type { AccountFormModel } from './configuracion.types';

@Component({
  selector: 'app-configuracion-cuenta-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="space-y-5">
      <div class="card-surface">
        <div class="card-header">
          <h3 class="card-title">Apariencia</h3>
        </div>
        <div class="p-4 sm:p-6">
          <div class="theme-mode-grid">
            <button
              type="button"
              (click)="themeChange.emit('light')"
              title="Claro"
              aria-label="Tema claro"
              [class]="
                theme() === 'light'
                  ? 'theme-mode-btn theme-mode-btn-active'
                  : 'theme-mode-btn theme-mode-btn-inactive'
              "
            >
              <svg class="theme-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="4.5" stroke-width="1.8" />
                <path
                  d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              (click)="themeChange.emit('dark')"
              title="Oscuro"
              aria-label="Tema oscuro"
              [class]="
                theme() === 'dark'
                  ? 'theme-mode-btn theme-mode-btn-active'
                  : 'theme-mode-btn theme-mode-btn-inactive'
              "
            >
              <svg class="theme-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M20 14.4A8 8 0 1 1 9.6 4a6.5 6.5 0 0 0 10.4 10.4Z"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              (click)="themeChange.emit('auto')"
              title="Auto"
              aria-label="Tema automático"
              [class]="
                theme() === 'auto'
                  ? 'theme-mode-btn theme-mode-btn-active'
                  : 'theme-mode-btn theme-mode-btn-inactive'
              "
            >
              <svg class="theme-mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect
                  x="3.5"
                  y="5"
                  width="17"
                  height="12"
                  rx="2"
                  stroke-width="1.8"
                  stroke-linejoin="round"
                />
                <path d="M9 20h6" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <form [formGroup]="form()" class="space-y-5">
        <div class="card-surface">
          <div class="card-header">
            <h3 class="card-title">Cambiar Email</h3>
          </div>
          <div class="p-4 sm:p-6 space-y-5">
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Email actual</label>
              </div>
              <input
                type="email"
                [value]="emailActual()"
                readonly
                class="form-input bg-muted/50 cursor-not-allowed"
              />
            </div>
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Nuevo email</label>
              </div>
              <input
                type="email"
                formControlName="nuevoEmail"
                placeholder="nuevo@email.com"
                class="form-input"
              />
            </div>
              <button
                type="button"
                (click)="changeEmail.emit()"
                [disabled]="!form().controls.nuevoEmail.value || guardandoEmail() || guardandoPassword()"
                [class.btn-loading--active]="guardandoEmail()"
                [attr.aria-busy]="guardandoEmail()"
                class="btn-primary btn-loading w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="btn-loading__content">
                  @if (guardandoEmail()) {
                    <span class="btn-loading__spinner" aria-hidden="true"></span>
                    <span>Enviando confirmaci&oacute;n...</span>
                  } @else {
                    <span>Cambiar Email</span>
                  }
                </span>
              </button>
          </div>
        </div>

        <div class="card-surface">
          <div class="card-header">
            <h3 class="card-title">Cambiar Contrase&ntilde;a</h3>
          </div>
          <div class="p-4 sm:p-6 space-y-5">
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Nueva contrase&ntilde;a</label>
              </div>
              <input
                type="password"
                formControlName="nuevaPassword"
                placeholder="M&iacute;nimo 6 caracteres"
                class="form-input"
              />
            </div>
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Confirmar contrase&ntilde;a</label>
              </div>
              <input
                type="password"
                formControlName="confirmarPassword"
                placeholder="Repetir contrase&ntilde;a"
                class="form-input"
              />
            </div>
              <button
                type="button"
                (click)="changePassword.emit()"
                [disabled]="
                  !form().controls.nuevaPassword.value ||
                  !form().controls.confirmarPassword.value ||
                  guardandoPassword() ||
                  guardandoEmail()
                "
                [class.btn-loading--active]="guardandoPassword()"
                [attr.aria-busy]="guardandoPassword()"
                class="btn-primary btn-loading w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="btn-loading__content">
                  @if (guardandoPassword()) {
                    <span class="btn-loading__spinner" aria-hidden="true"></span>
                    <span>Actualizando contrase&ntilde;a...</span>
                  } @else {
                    <span>Cambiar Contrase&ntilde;a</span>
                  }
                </span>
              </button>
          </div>
        </div>

        @if (mensaje()) {
          <div
            class="p-3 rounded-lg border text-sm"
            [class]="
              mensaje()?.tipo === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700'
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'
            "
          >
            {{ mensaje()?.texto }}
          </div>
        }
      </form>
    </div>
  `,
})
export class ConfiguracionCuentaFormComponent {
  readonly form = input.required<FormGroup<AccountFormModel>>();
  readonly emailActual = input.required<string>();
  readonly theme = input.required<ThemeMode>();
  readonly guardandoEmail = input.required<boolean>();
  readonly guardandoPassword = input.required<boolean>();
  readonly mensaje = input<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  readonly themeChange = output<ThemeMode>();
  readonly changeEmail = output<void>();
  readonly changePassword = output<void>();
}
