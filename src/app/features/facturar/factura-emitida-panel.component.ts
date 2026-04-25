import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Comprobante } from '../../core/types/database.types';
import {
  ComprobanteResultadoAction,
  ComprobanteResultadoActionId,
  ComprobanteResultadoMessageType,
  ComprobanteResultadoPanelComponent,
} from '../../shared/components/ui/comprobante-resultado-panel.component';

@Component({
  selector: 'app-factura-emitida-panel',
  standalone: true,
  imports: [ComprobanteResultadoPanelComponent],
  template: `
    @if (factura) {
      <app-comprobante-resultado-panel
        class="mt-4 block"
        eyebrow="Factura emitida"
        [title]="tipoComprobante + ' ' + numeroComprobante + ' ' + monto"
        [subtitle]="clienteDescripcion()"
        [actions]="acciones"
        [actionInProgress]="accionEnCurso"
        [message]="mensajeAccion"
        [messageType]="mensajeAccionTipo"
        closeLabel="Cerrar"
        (actionSelected)="onAction($event)"
        (closeRequested)="volver.emit()"
      />
    }
  `,
})
export class FacturaEmitidaPanelComponent {
  @Input({ required: true }) factura!: Comprobante | null;
  @Input({ required: true }) tipoComprobante!: string;
  @Input({ required: true }) numeroComprobante!: string;
  @Input({ required: true }) monto!: string;
  @Input() accionEnCurso: ComprobanteResultadoActionId | null = null;
  @Input() mensajeAccion: string | null = null;
  @Input() mensajeAccionTipo: ComprobanteResultadoMessageType = 'success';

  @Output() readonly ver = new EventEmitter<void>();
  @Output() readonly compartir = new EventEmitter<void>();
  @Output() readonly descargar = new EventEmitter<void>();
  @Output() readonly imprimir = new EventEmitter<void>();
  @Output() readonly volver = new EventEmitter<void>();

  readonly acciones: ComprobanteResultadoAction[] = [
    { id: 'ver', label: 'Ver', title: 'Ver comprobante' },
    { id: 'compartir', label: 'Compartir', title: 'Compartir comprobante' },
    { id: 'descargar', label: 'Descargar', title: 'Descargar comprobante' },
    { id: 'imprimir', label: 'Imprimir', title: 'Imprimir comprobante' },
  ];

  clienteDescripcion(): string {
    if (!this.factura?.cliente_nombre) {
      return '';
    }

    return [this.factura.cliente_nombre, this.factura.cliente_condicion_iva]
      .filter(Boolean)
      .join(' - ');
  }

  onAction(action: ComprobanteResultadoActionId): void {
    if (action === 'ver') this.ver.emit();
    if (action === 'compartir') this.compartir.emit();
    if (action === 'descargar') this.descargar.emit();
    if (action === 'imprimir') this.imprimir.emit();
  }
}
