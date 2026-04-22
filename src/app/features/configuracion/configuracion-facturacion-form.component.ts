import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import type { FacturacionFormModel } from './configuracion.types';

@Component({
  selector: 'app-configuracion-facturacion-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form()" (ngSubmit)="guardar.emit()" class="space-y-5">
      <div class="card-surface">
        <div class="card-header">
          <h3 class="card-title">Datos del Emisor</h3>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">CUIT</label>
              <span class="form-required-badge">Obligatorio</span>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                formControlName="cuit"
                maxlength="11"
                placeholder="20332398181"
                class="form-input flex-1"
                [class.error]="form().controls.cuit.invalid && form().controls.cuit.touched"
              />
              <button
                type="button"
                (click)="buscarCuit.emit()"
                [disabled]="buscandoCuit() || form().controls.cuit.invalid"
                [class.btn-loading--active]="buscandoCuit()"
                [attr.aria-busy]="buscandoCuit()"
                class="btn-primary btn-loading min-w-[8.5rem] rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span class="btn-loading__content">
                  @if (buscandoCuit()) {
                    <span class="btn-loading__spinner" aria-hidden="true"></span>
                    <span>Buscando CUIT...</span>
                  } @else {
                    <span>Buscar CUIT</span>
                  }
                </span>
              </button>
            </div>
            @if (form().controls.cuit.invalid && form().controls.cuit.touched) {
              <p class="form-error">El CUIT debe tener 11 d&iacute;gitos.</p>
            }
            @if (mensajePadron()) {
              <p
                class="form-help"
                [class]="
                  mensajePadron()!.tipo === 'success'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-amber-600 dark:text-amber-400'
                "
              >
                {{ mensajePadron()!.texto }}
              </p>
            }
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Raz&oacute;n Social</label>
              <span class="form-required-badge">Obligatorio</span>
            </div>
            <input
              type="text"
              formControlName="razon_social"
              placeholder="APELLIDO NOMBRE"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Nombre de Fantas&iacute;a</label>
              <span class="form-optional-text">Opcional</span>
            </div>
            <input
              type="text"
              formControlName="nombre_fantasia"
              placeholder="Mi Negocio"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Domicilio Comercial</label>
            </div>
            <input
              type="text"
              formControlName="domicilio"
              placeholder="Av. Siempre Viva 742, Springfield"
              class="form-input"
            />
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Condici&oacute;n frente al IVA</label>
              </div>
              <select formControlName="condicion_iva" class="form-select">
                <option value="Responsable Monotributo">Responsable Monotributo</option>
                <option value="IVA Responsable Inscripto">IVA Responsable Inscripto</option>
                <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
              </select>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Ingresos Brutos</label>
              </div>
              <input
                type="text"
                formControlName="ingresos_brutos"
                placeholder="20332398181"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Fecha de Inicio de Actividades</label>
            </div>
            <input type="date" formControlName="inicio_actividades" class="form-input" />
          </div>
        </div>
      </div>

      <div class="card-surface">
        <div class="card-header">
          <h3 class="card-title">Preferencias de Facturaci&oacute;n</h3>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Punto de Venta</label>
              <span class="form-required-badge">Obligatorio</span>
            </div>
            <input
              type="number"
              formControlName="punto_venta"
              min="1"
              max="9999"
              placeholder="4"
              class="form-input"
            />
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Concepto a Facturar</label>
              <span class="form-required-badge">Obligatorio</span>
            </div>
            <input
              type="text"
              formControlName="concepto"
              placeholder="Honorarios Profesionales"
              class="form-input"
            />
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">IVA</label>
              </div>
              <select formControlName="iva_porcentaje" class="form-select">
                <option value="21.00">21%</option>
                <option value="10.50">10.5%</option>
              </select>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Actividad</label>
              </div>
              <select formControlName="actividad" class="form-select">
                <option value="bienes">Bienes (-5 d&iacute;as)</option>
                <option value="servicios">Servicios (-10 d&iacute;as)</option>
              </select>
            </div>
          </div>

          <div class="form-field">
            <div class="form-label-row">
              <label class="form-label">Monto m&aacute;ximo por factura</label>
              <span class="form-optional-text">0 = sin l&iacute;mite</span>
            </div>
            <input
              type="number"
              formControlName="monto_maximo_factura"
              min="0"
              step="0.01"
              placeholder="0"
              class="form-input"
              [class.error]="
                form().controls.monto_maximo_factura.invalid &&
                form().controls.monto_maximo_factura.touched
              "
            />
            @if (
              form().controls.monto_maximo_factura.invalid &&
              form().controls.monto_maximo_factura.touched
            ) {
              <p class="form-error">Ingres&aacute; un monto igual o mayor a 0.</p>
            }
          </div>
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
        [disabled]="form().invalid || guardando()"
        [class.btn-loading--active]="guardando()"
        [attr.aria-busy]="guardando()"
        class="btn-primary btn-loading w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span class="btn-loading__content">
          @if (guardando()) {
            <span class="btn-loading__spinner" aria-hidden="true"></span>
            <span>Guardando datos...</span>
          } @else {
            <span>Guardar Datos de Facturaci&oacute;n</span>
          }
        </span>
      </button>
    </form>
  `,
})
export class ConfiguracionFacturacionFormComponent {
  readonly form = input.required<FormGroup<FacturacionFormModel>>();
  readonly buscandoCuit = input.required<boolean>();
  readonly guardando = input.required<boolean>();
  readonly mensajePadron = input<{ texto: string; tipo: 'success' | 'error' } | null>(null);
  readonly mensaje = input<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  readonly buscarCuit = output<void>();
  readonly guardar = output<void>();
}
