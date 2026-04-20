import { CurrencyPipe } from '@angular/common';
import { Component, Input } from '@angular/core';

interface FacturaRecienteView {
  id: string;
  tipoLabel: string;
  numeroLabel: string;
  fechaLabel: string;
  total: number;
}

@Component({
  selector: 'app-facturas-recientes-panel',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <aside class="card-surface p-4 sm:p-5">
      <div class="mb-4">
        <h3 class="text-base font-semibold text-foreground">Últimas facturas</h3>
      </div>

      @if (cargando) {
        <div class="space-y-2">
          @for (skeleton of [1, 2, 3]; track skeleton) {
            <div class="rounded-lg border border-border/60 bg-muted/30 p-3 animate-pulse">
              <div class="h-4 w-24 bg-muted rounded mb-2"></div>
              <div class="h-4 w-full bg-muted rounded"></div>
            </div>
          }
        </div>
      } @else if (facturas.length === 0) {
        <div class="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Todavía no hay facturas recientes.
        </div>
      } @else {
        <div class="space-y-2">
          @for (factura of facturas; track factura.id) {
            <div class="rounded-lg border border-border bg-card/70 px-3 py-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-foreground">
                    {{ factura.tipoLabel }} {{ factura.numeroLabel }}
                  </div>
                  <div class="text-xs text-muted-foreground mt-1">
                    {{ factura.fechaLabel }}
                  </div>
                </div>
                <div class="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                  {{ factura.total | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
                </div>
              </div>
            </div>
          }
        </div>
      }
    </aside>
  `,
})
export class FacturasRecientesPanelComponent {
  @Input({ required: true }) facturas!: FacturaRecienteView[];
  @Input({ required: true }) cargando!: boolean;
}
