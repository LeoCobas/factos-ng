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
          <p class="form-section-description">
            Estos datos aparecen en tus comprobantes. Los campos con badge son obligatorios.
          </p>
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
                class="btn-primary min-w-[8.5rem] rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {{ buscandoCuit() ? 'Buscando...' : 'Buscar CUIT' }}
              </button>
            </div>
            <p class="form-help">
              Us&aacute; la constancia de inscripci&oacute;n ARCA para autocompletar raz&oacute;n
              social, domicilio fiscal y condici&oacute;n frente al IVA.
            </p>
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
            <p class="form-help">
              Si se completa, aparece destacado en el ticket con mayor tama&ntilde;o visual.
            </p>
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
            <p class="form-help">
              Obligatorio en el comprobante. Pod&eacute;s modificarlo si ten&eacute;s varios puntos
              de venta.
            </p>
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
              <p class="form-help">Generalmente coincide con el CUIT en Convenio Multilateral.</p>
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
          <p class="form-section-description">
            Defin&iacute; c&oacute;mo se completa cada comprobante por defecto.
          </p>
        </div>
        <div class="p-4 sm:p-6 space-y-5">
          <div class="grid gap-5 lg:grid-cols-2">
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
              <p class="form-help">Se usa como valor inicial al emitir comprobantes.</p>
            </div>

            <div class="form-field">
              <div class="form-label-row">
                <label class="form-label">Tipo de Comprobante</label>
              </div>
              <select formControlName="tipo_comprobante_default" class="form-select">
                <option value="FACTURA B">Factura B / NC B (Responsable Inscripto)</option>
                <option value="FACTURA C">Factura C / NC C (Monotributista)</option>
              </select>
            </div>
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
            <p class="form-help">Se propone autom&aacute;ticamente al iniciar una nueva factura.</p>
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
              <p class="form-help">
                Define cu&aacute;ntos d&iacute;as hacia atr&aacute;s se pueden emitir facturas.
              </p>
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
            <p class="form-help">
              Si carg&aacute;s un monto mayor a 0, al intentar emitir una factura por encima de ese
              valor se pedir&aacute; una confirmaci&oacute;n adicional antes de continuar.
            </p>
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
        class="btn-primary w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {{ guardando() ? 'Guardando...' : 'Guardar Datos de Facturaci&oacute;n' }}
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
