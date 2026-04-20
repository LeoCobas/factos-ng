import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import type { CertFormModel } from './configuracion.types';

@Component({
  selector: 'app-configuracion-certificado-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form()" (ngSubmit)="guardar.emit()" class="space-y-5">
      <div class="card-surface">
        <div class="card-header">
          <div class="flex items-start gap-3">
            <svg
              class="mt-1 h-5 w-5 text-blue-600 dark:text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              ></path>
            </svg>
            <div>
              <h3 class="card-title">Certificados ARCA (AFIP)</h3>
              <p class="form-section-description">
                Necesarios para emitir comprobantes electr&oacute;nicos desde tu cuenta.
              </p>
            </div>
          </div>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div
            class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300"
          >
            <p class="font-medium mb-1">Archivos sensibles</p>
            <p>Los certificados se almacenan de forma segura asociados a tu cuenta.</p>
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Certificado (.crt)</label>
            </div>
            <div class="flex items-center gap-3">
              <label
                class="file-dropzone flex-1"
                [class]="
                  tieneCert()
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-border text-muted-foreground hover:text-foreground'
                "
              >
                <input
                  type="file"
                  accept=".crt,.pem,.cer"
                  class="hidden"
                  (change)="certSelected.emit($event)"
                />
                @if (tieneCert()) {
                  <span class="text-sm font-medium">Certificado cargado</span>
                } @else {
                  <span class="text-sm">Seleccionar archivo .crt</span>
                }
              </label>
              @if (tieneCert()) {
                <button
                  type="button"
                  (click)="borrarCert.emit()"
                  class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Eliminar"
                >
                  &times;
                </button>
              }
            </div>
            <p class="form-help">Sub&iacute; el certificado p&uacute;blico emitido para tu CUIT.</p>
            @if (certFileName()) {
              <p class="form-help">{{ certFileName() }}</p>
            }
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Clave Privada (.key)</label>
            </div>
            <div class="flex items-center gap-3">
              <label
                class="file-dropzone flex-1"
                [class]="
                  tieneKey()
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-border text-muted-foreground hover:text-foreground'
                "
              >
                <input
                  type="file"
                  accept=".key,.pem"
                  class="hidden"
                  (change)="keySelected.emit($event)"
                />
                @if (tieneKey()) {
                  <span class="text-sm font-medium">Clave privada cargada</span>
                } @else {
                  <span class="text-sm">Seleccionar archivo .key</span>
                }
              </label>
              @if (tieneKey()) {
                <button
                  type="button"
                  (click)="borrarKey.emit()"
                  class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Eliminar"
                >
                  &times;
                </button>
              }
            </div>
            <p class="form-help">Sub&iacute; la clave privada asociada al certificado anterior.</p>
            @if (keyFileName()) {
              <p class="form-help">{{ keyFileName() }}</p>
            }
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Entorno ARCA</label>
            </div>
            <select formControlName="arca_production" class="form-select">
              <option [ngValue]="false">Testing / Homologaci&oacute;n</option>
              <option [ngValue]="true">Producci&oacute;n</option>
            </select>
            <p class="form-help">
              Us&aacute; Testing para validar la integraci&oacute;n antes de pasar a producci&oacute;n.
            </p>
          </div>

          @if (tieneCert() && tieneKey()) {
            <div
              class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700"
            >
              <span class="text-sm font-medium text-green-700 dark:text-green-300">
                Certificados configurados. Ya pod&eacute;s facturar.
              </span>
            </div>
          } @else {
            <div
              class="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700"
            >
              <span class="text-sm text-yellow-700 dark:text-yellow-300">
                Sub&iacute; ambos archivos para poder facturar.
              </span>
            </div>
          }
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

      <button
        type="submit"
        [disabled]="guardando()"
        class="btn-primary w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ guardando() ? 'Guardando...' : 'Guardar Certificado' }}
      </button>
    </form>
  `,
})
export class ConfiguracionCertificadoFormComponent {
  readonly form = input.required<FormGroup<CertFormModel>>();
  readonly tieneCert = input.required<boolean>();
  readonly tieneKey = input.required<boolean>();
  readonly certFileName = input<string | null>(null);
  readonly keyFileName = input<string | null>(null);
  readonly guardando = input.required<boolean>();
  readonly mensaje = input<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  readonly guardar = output<void>();
  readonly certSelected = output<Event>();
  readonly keySelected = output<Event>();
  readonly borrarCert = output<void>();
  readonly borrarKey = output<void>();
}
