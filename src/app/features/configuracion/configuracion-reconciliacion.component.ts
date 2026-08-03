import { Component, effect, inject, input, signal } from '@angular/core';
import {
  ArcaReconciliationService,
  AuditableInvoiceType,
  ReconciliationResult,
} from '../../core/services/arca-reconciliation.service';

@Component({
  selector: 'app-configuracion-reconciliacion',
  standalone: true,
  template: `
    <section class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-3">
        <label class="space-y-1.5 text-sm font-medium">
          <span>Punto de venta</span>
          <input class="form-input w-full" type="number" min="1" [value]="puntoVenta()"
            (input)="puntoVenta.set(+$any($event.target).value)" />
        </label>
        <label class="space-y-1.5 text-sm font-medium">
          <span>Tipo</span>
          <select class="form-select w-full" [value]="tipoComprobante()"
            (change)="tipoComprobante.set($any($event.target).value)">
            <option value="FACTURA A">Factura A</option>
            <option value="FACTURA B">Factura B</option>
            <option value="FACTURA C">Factura C</option>
          </select>
        </label>
        <label class="space-y-1.5 text-sm font-medium">
          <span>N&uacute;mero</span>
          <div class="flex gap-2">
            <input class="form-input min-w-0 flex-1" type="number" min="1" [value]="cbteNro() || ''"
              (input)="cbteNro.set(+$any($event.target).value)" />
            <button type="button" class="btn-secondary px-3" title="Reconciliar comprobante"
              aria-label="Reconciliar comprobante" [disabled]="loading() || cbteNro() < 1"
              (click)="reconciliar()">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </label>
      </div>

      <div class="flex items-center justify-between gap-4 border-t border-border pt-4">
        <div class="flex flex-wrap gap-2 text-xs">
          @for (entry of summaryEntries(); track entry[0]) {
            <span class="rounded border border-border px-2 py-1">{{ entry[0] }}: {{ entry[1] }}</span>
          }
        </div>
        <button type="button" class="btn-primary shrink-0" [disabled]="loading() || puntoVenta() < 1"
          (click)="auditar()">
          {{ loading() ? 'Consultando...' : 'Auditar &uacute;ltimos 100' }}
        </button>
      </div>

      @if (error()) {
        <p class="text-sm text-destructive">{{ error() }}</p>
      }
      @if (results().length) {
        <div class="overflow-x-auto border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left">
              <tr><th class="px-3 py-2">N&uacute;mero</th><th class="px-3 py-2">Estado</th><th class="px-3 py-2">Detalle</th></tr>
            </thead>
            <tbody>
              @for (result of results(); track result.cbte_nro) {
                <tr class="border-t border-border">
                  <td class="px-3 py-2 tabular-nums">{{ result.cbte_nro }}</td>
                  <td class="px-3 py-2">{{ result.status }}</td>
                  <td class="px-3 py-2 text-muted-foreground">{{ result.error || '' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class ConfiguracionReconciliacionComponent {
  private readonly service = inject(ArcaReconciliationService);
  readonly puntoVentaInicial = input<number | null>(null);
  readonly puntoVenta = signal(1);
  readonly tipoComprobante = signal<AuditableInvoiceType>('FACTURA C');
  readonly cbteNro = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly summary = signal<Record<string, number>>({});
  readonly results = signal<ReconciliationResult[]>([]);
  readonly summaryEntries = () => Object.entries(this.summary());

  constructor() {
    effect(() => {
      const initial = this.puntoVentaInicial();
      if (initial && initial > 0) this.puntoVenta.set(initial);
    });
  }

  async auditar(): Promise<void> {
    await this.run(async () => {
      const result = await this.service.auditar(this.puntoVenta(), this.tipoComprobante());
      this.summary.set(result.summary);
      this.results.set(result.results);
    });
  }

  async reconciliar(): Promise<void> {
    await this.run(async () => {
      const result = await this.service.reconciliar(
        this.puntoVenta(),
        this.tipoComprobante(),
        this.cbteNro(),
      );
      this.summary.set({ [result.status]: 1 });
      this.results.set([{ cbte_nro: this.cbteNro(), status: result.status }]);
    });
  }

  private async run(operation: () => Promise<void>): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      await operation();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.loading.set(false);
    }
  }
}
