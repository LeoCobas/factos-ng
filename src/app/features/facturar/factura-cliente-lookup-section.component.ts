import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ClienteLookupResult } from '../../core/services/facturacion.service';

@Component({
  selector: 'app-factura-cliente-lookup-section',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="rounded-2xl border border-border bg-card/70 p-3 sm:p-4 space-y-3">
      <div class="flex items-end gap-2 sm:gap-3">
        <div class="flex-1">
          <label class="block text-sm font-medium text-foreground mb-1.5">CUIT del cliente</label>
          <input
            type="text"
            inputmode="numeric"
            maxlength="11"
            [formControl]="clienteCuitControl"
            (input)="clienteCuitInput.emit()"
            (keydown.enter)="onClienteCuitEnter($event)"
            placeholder="Ingresar CUIT"
            class="form-input w-full"
          />
        </div>
        <button
          type="button"
          (click)="buscarCliente.emit()"
          [disabled]="buscandoCliente || !clienteCuitValido"
          class="btn-primary inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          [attr.aria-label]="buscandoCliente ? 'Buscando cliente' : 'Buscar cliente'"
          [attr.title]="buscandoCliente ? 'Buscando cliente' : 'Buscar cliente'"
        >
          @if (buscandoCliente) {
            <svg
              class="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2"
                class="opacity-30"
              />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          } @else {
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="6" stroke="currentColor" stroke-width="2" />
              <path
                d="m20 20-4.35-4.35"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          }
        </button>
      </div>

      @if (clienteSeleccionado) {
        <div class="rounded-xl border border-border bg-background/80 p-3 sm:p-4 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-semibold text-foreground">
                {{ clienteSeleccionado!.nombre || 'Cliente identificado' }}
              </div>
              <div class="mt-1 text-xs text-muted-foreground">
                CUIT {{ clienteCuitFormateado }}
              </div>
            </div>
            <button
              type="button"
              (click)="limpiarCliente.emit()"
              class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Quitar cliente
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
              {{ condicionClienteLabel }}
            </span>
            <span
              class="rounded-full px-2.5 py-1 text-xs font-medium"
              [class]="
                requiereRevision
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              "
            >
              {{ tipoComprobanteResueltoLabel }}
            </span>
          </div>
        </div>
      }

      @if (mostrarAlertaCliente) {
        <div
          class="rounded-lg border px-3 py-2 text-sm"
          [class]="
            mensajeClienteTipo === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
              : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
          "
        >
          {{ alertaClienteTexto }}
        </div>
      }
    </div>
  `,
})
export class FacturaClienteLookupSectionComponent {
  @Input({ required: true }) clienteCuitControl!: FormControl<string>;
  @Input({ required: true }) clienteCuitValido!: boolean;
  @Input({ required: true }) buscandoCliente!: boolean;
  @Input() clienteSeleccionado: ClienteLookupResult | null = null;
  @Input() clienteCuitFormateado = '';
  @Input({ required: true }) condicionClienteLabel!: string;
  @Input({ required: true }) tipoComprobanteResueltoLabel!: string;
  @Input() requiereRevision = false;
  @Input() mostrarAlertaCliente = false;
  @Input() alertaClienteTexto = '';
  @Input() mensajeClienteTipo: 'success' | 'warning' | 'error' = 'success';

  @Output() readonly buscarCliente = new EventEmitter<void>();
  @Output() readonly limpiarCliente = new EventEmitter<void>();
  @Output() readonly clienteCuitInput = new EventEmitter<void>();

  onClienteCuitEnter(event: Event) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.clienteCuitValido || this.buscandoCliente) {
      return;
    }

    this.buscarCliente.emit();
  }
}
