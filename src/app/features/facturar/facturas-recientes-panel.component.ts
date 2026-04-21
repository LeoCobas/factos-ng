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
  template: `
    <aside class="card-surface p-3.5 sm:p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold tracking-[-0.01em] text-foreground sm:text-[0.98rem]">
          &Uacute;ltimas facturas
        </h3>
        <span class="rounded-full border border-border/80 bg-muted/35 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Recientes
        </span>
      </div>

      @if (cargando) {
        <div class="space-y-2">
          @for (skeleton of [1, 2, 3]; track skeleton) {
            <div class="animate-pulse rounded-xl border border-border/60 bg-muted/25 p-3">
              <div class="mb-2 h-4 w-24 rounded bg-muted"></div>
              <div class="h-4 w-full rounded bg-muted"></div>
            </div>
          }
        </div>
      } @else if (facturas.length === 0) {
        <div class="rounded-xl border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
          Todav&iacute;a no hay facturas recientes.
        </div>
      } @else {
        <div class="space-y-2">
          @for (factura of facturas; track factura.id) {
            <div class="rounded-xl border border-border/80 bg-muted/18 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-semibold tracking-[-0.01em] text-foreground">
                    {{ factura.tipoLabel }} {{ factura.numeroLabel }}
                  </div>
                  <div class="mt-1 text-[0.78rem] text-muted-foreground">
                    {{ factura.fechaLabel }}
                  </div>
                </div>
                <div class="whitespace-nowrap text-right text-sm font-semibold text-foreground">
                  {{ formatTotal(factura.total) }}
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

  protected formatTotal(total: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(total);
  }
}
