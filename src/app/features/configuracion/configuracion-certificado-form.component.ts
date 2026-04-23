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
            </div>
          </div>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Certificado (.crt)</label>
            </div>
            <div class="flex items-center gap-3">
              <label
                class="file-dropzone flex-1"
                [class]="
                  tieneCert()
                    ? 'file-dropzone--loaded'
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
                    ? 'file-dropzone--loaded'
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
          </div>

          @if (tieneCert() && tieneKey()) {
            <div
              class="config-status config-status--success flex items-center gap-2 p-3 rounded-lg border"
            >
              <span class="text-sm font-medium">
                Certificados configurados. Ya pod&eacute;s facturar.
              </span>
            </div>
          } @else {
            <div
              class="config-status config-status--warning flex items-center gap-2 p-3 rounded-lg border"
            >
              <span class="text-sm font-medium">
                Sub&iacute; ambos archivos para poder facturar.
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
        [disabled]="guardando()"
        [class.btn-loading--active]="guardando()"
        [attr.aria-busy]="guardando()"
        class="btn-primary btn-loading w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="btn-loading__content">
          @if (guardando()) {
            <span class="btn-loading__spinner" aria-hidden="true"></span>
            <span>Guardando certificado...</span>
          } @else {
            <span>Guardar Certificado</span>
          }
        </span>
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
