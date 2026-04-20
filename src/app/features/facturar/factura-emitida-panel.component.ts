import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Comprobante } from '../../core/types/database.types';

@Component({
  selector: 'app-factura-emitida-panel',
  standalone: true,
  template: `
    @if (factura) {
      <div class="mt-4 p-4 card-factura-emitida">
        <div class="text-center mb-4">
          <h3 class="text-lg font-semibold mb-2">Factura emitida:</h3>
          <div class="text-xl font-bold text-primary">
            {{ tipoComprobante }}
            {{ numeroComprobante }}
            {{ monto }}
          </div>
          @if (factura && factura.cliente_nombre) {
            <div class="mt-2 text-sm text-muted-foreground">
              {{ factura.cliente_nombre }} -
              {{ factura.cliente_condicion_iva }}
            </div>
          }
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <button
            (click)="ver.emit()"
            class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            Ver
          </button>
          <button
            (click)="compartir.emit()"
            class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            Compartir
          </button>
          <button
            (click)="descargar.emit()"
            class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            Descargar
          </button>
          <button
            (click)="imprimir.emit()"
            class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            Imprimir
          </button>
        </div>
        <button
          (click)="volver.emit()"
          class="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
        >
          Volver
        </button>
      </div>
    }
  `,
})
export class FacturaEmitidaPanelComponent {
  @Input({ required: true }) factura!: Comprobante | null;
  @Input({ required: true }) tipoComprobante!: string;
  @Input({ required: true }) numeroComprobante!: string;
  @Input({ required: true }) monto!: string;

  @Output() readonly ver = new EventEmitter<void>();
  @Output() readonly compartir = new EventEmitter<void>();
  @Output() readonly descargar = new EventEmitter<void>();
  @Output() readonly imprimir = new EventEmitter<void>();
  @Output() readonly volver = new EventEmitter<void>();
}
