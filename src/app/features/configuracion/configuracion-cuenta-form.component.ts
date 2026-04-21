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
          <div class="flex flex-col gap-2 rounded-xl bg-muted/60 p-2 sm:flex-row">
            <button
              type="button"
              (click)="themeChange.emit('light')"
              [class]="
                theme() === 'light'
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              "
              class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200"
            >
              Claro
            </button>
            <button
              type="button"
              (click)="themeChange.emit('dark')"
              [class]="
                theme() === 'dark'
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              "
              class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200"
            >
              Oscuro
            </button>
            <button
              type="button"
              (click)="themeChange.emit('auto')"
              [class]="
                theme() === 'auto'
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              "
              class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200"
            >
              Auto
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
              [disabled]="!form().controls.nuevoEmail.value || guardando()"
              class="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ guardando() ? 'Enviando...' : 'Cambiar Email' }}
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
                guardando()
              "
              class="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ guardando() ? 'Cambiando...' : 'Cambiar Contrase&ntilde;a' }}
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
  readonly guardando = input.required<boolean>();
  readonly mensaje = input<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  readonly themeChange = output<ThemeMode>();
  readonly changeEmail = output<void>();
  readonly changePassword = output<void>();
}
