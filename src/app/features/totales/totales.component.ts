import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ComprobanteMetricRow } from '../../core/types/comprobantes.types';
import { getFriendlyNetworkErrorMessage } from '../../core/utils/network-error.util';

interface PeriodoTotal {
  titulo: string;
  diaNumero?: string;
  total: number;
  cantidad: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

@Component({
  selector: 'app-totales',
  template: `
    <div class="totales-view space-y-3">
      @if (cargando()) {
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-muted-foreground mt-4">Cargando datos...</p>
        </div>
      } @else {
        @if (errorCarga()) {
          <div class="rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {{ errorCarga() }}
          </div>
        }

        <div class="totales-period-grid">
          @for (periodo of periodos(); track periodo.titulo + (periodo.diaNumero ?? '')) {
            <div class="card-surface totales-period-card p-4" [class]="'border-l-4 border-l-' + periodo.color + '-500'">
              <div class="totales-period-card__layout">
                <div class="totales-period-card__copy">
                  @if (periodo.diaNumero) {
                    <p class="period-title period-title--inline">
                      <span>{{ periodo.titulo }}</span>
                      <span class="period-day">{{ periodo.diaNumero }}</span>
                    </p>
                  } @else {
                    <p class="period-title">{{ periodo.titulo }}</p>
                  }
                </div>
                <div class="totales-period-card__metric text-right">
                  <p class="period-amount">
                    {{ periodo.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                  </p>
                  <p class="period-sub text-info">
                    {{ periodo.cantidad }} comprobante{{ periodo.cantidad !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

        <div class="bg-muted rounded-lg border border-border p-4">
          <div class="text-center">
            <h3 class="period-title totales-section-title mb-2">Resumen del Año {{ getAnoActual() }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div class="text-center">
                <p class="period-amount totales-hero-amount">
                  {{ totalAnual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="period-sub">Total facturado</p>
              </div>
              <div class="text-center">
                <p class="period-amount totales-hero-amount">{{ comprobantesAnuales() }}</p>
                <p class="period-sub">Comprobantes emitidos</p>
              </div>
              <div class="text-center">
                <p class="period-amount totales-hero-amount">
                  {{ promedioMensual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="period-sub">Promedio mensual</p>
              </div>
              <div class="text-center">
                <p class="period-amount totales-hero-amount">
                {{ ticketPromedio() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="period-sub">Ticket Promedio ({{ comprobantesAnuales() }})</p>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [CurrencyPipe],
  styles: [`
    .totales-period-grid {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: minmax(0, 1fr);
    }

    @media (min-width: 360px) {
      .totales-period-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .totales-view .period-sub {
      line-height: 1.35;
    }

    .totales-period-card {
      min-height: 10.5rem;
    }

    .totales-period-card__layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: start;
      gap: 0.9rem;
      height: 100%;
    }

    .totales-period-card__copy,
    .totales-period-card__metric {
      min-width: 0;
    }

    .totales-period-card__copy {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .totales-period-card .period-title {
      font-size: clamp(1.05rem, 0.92rem + 0.4vw, 1.35rem);
      font-weight: 650;
      line-height: 1.12;
      letter-spacing: -0.015em;
    }

    .totales-period-card .period-title--inline {
      display: inline-flex;
      align-items: baseline;
      gap: 0.45rem;
      flex-wrap: wrap;
    }

    .totales-period-card .period-day {
      color: inherit;
      font-weight: 700;
    }

    .totales-period-card .period-amount {
      font-size: clamp(1.55rem, 1.3rem + 1vw, 2.15rem);
      font-weight: 700;
      line-height: 0.96;
      letter-spacing: -0.03em;
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .totales-period-card .period-sub {
      font-size: 0.96rem;
    }

    .totales-period-card__metric .period-sub {
      margin-top: 0.45rem;
      font-size: 0.9rem;
      text-wrap: balance;
    }

    .totales-section-title {
      font-size: clamp(1.22rem, 1.08rem + 0.45vw, 1.55rem);
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.02em;
    }

    .totales-hero-amount {
      font-size: clamp(2.15rem, 1.8rem + 1vw, 2.85rem);
      font-weight: 750;
      line-height: 1;
    }

    @media (min-width: 1024px) {
      .totales-period-card__layout {
        grid-template-columns: minmax(0, 1fr);
        align-content: start;
      }

      .totales-period-card__metric {
        margin-top: auto;
        padding-top: 0.35rem;
        text-align: left;
      }
    }

    @media (max-width: 767px) {
      .totales-period-card {
        min-height: auto;
      }

      .totales-period-card__layout {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.8rem;
      }

      .totales-period-card__metric {
        text-align: left;
      }

      .totales-period-card .period-amount,
      .totales-hero-amount {
        overflow-wrap: anywhere;
      }
    }
  `],
})
export class TotalesComponent {
  readonly facturas = signal<ComprobanteMetricRow[]>([]);
  readonly cargando = signal(false);
  readonly errorCarga = signal<string | null>(null);

  private readonly comprobantesService = inject(ComprobantesService);
  private readonly contribuyenteService = inject(ContribuyenteService);

  constructor() {
    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        void this.cargarDatosIniciales();
      } else {
        this.facturas.set([]);
      }
    });
  }

  async cargarDatosIniciales() {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      this.facturas.set([]);
      return;
    }

    this.cargando.set(true);
    this.errorCarga.set(null);

    try {
      this.facturas.set(
        await this.comprobantesService.cargarMetricasComprobantes(contribuyente.id),
      );
    } catch (error) {
      console.error('Error inesperado al cargar datos:', error);
      this.facturas.set([]);
      this.errorCarga.set(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudieron cargar los totales en este momento.',
          'No se pudieron cargar los totales porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      );
    } finally {
      this.cargando.set(false);
    }
  }

  getAnoActual = computed(() => new Date().getFullYear());

  calcularMontoReal = (comprobante: ComprobanteMetricRow) =>
    comprobante.esNotaCredito ? -comprobante.total : comprobante.total;

  capitalizarPrimeraLetra = (texto: string) =>
    texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;

  periodos = computed((): PeriodoTotal[] => {
    const hoy = new Date();
    const ayer = subDays(hoy, 1);
    const inicioMesActual = startOfMonth(hoy);
    const finMesActual = endOfMonth(hoy);
    const inicioMesAnterior = startOfMonth(subMonths(hoy, 1));
    const finMesAnterior = endOfMonth(subMonths(hoy, 1));

    const comprobantesEmitidos = this.facturas().filter((factura) => factura.estado === 'emitida');
    const comprobantesHoy = comprobantesEmitidos.filter(
      (factura) => factura.fecha === format(hoy, 'yyyy-MM-dd'),
    );
    const comprobantesAyer = comprobantesEmitidos.filter(
      (factura) => factura.fecha === format(ayer, 'yyyy-MM-dd'),
    );
    const comprobantesMesActual = comprobantesEmitidos.filter((factura) => {
      const fechaFactura = new Date(`${factura.fecha}T00:00:00`);
      return fechaFactura >= inicioMesActual && fechaFactura <= finMesActual;
    });
    const comprobantesMesAnterior = comprobantesEmitidos.filter((factura) => {
      const fechaFactura = new Date(`${factura.fecha}T00:00:00`);
      return fechaFactura >= inicioMesAnterior && fechaFactura <= finMesAnterior;
    });

    return [
      {
        titulo: 'Hoy',
        diaNumero: format(hoy, 'd', { locale: es }),
        total: comprobantesHoy.reduce((sum, factura) => sum + this.calcularMontoReal(factura), 0),
        cantidad: comprobantesHoy.length,
        color: 'blue',
      },
      {
        titulo: 'Ayer',
        diaNumero: format(ayer, 'd', { locale: es }),
        total: comprobantesAyer.reduce((sum, factura) => sum + this.calcularMontoReal(factura), 0),
        cantidad: comprobantesAyer.length,
        color: 'green',
      },
      {
        titulo: this.capitalizarPrimeraLetra(format(hoy, 'MMMM', { locale: es })),
        total: comprobantesMesActual.reduce(
          (sum, factura) => sum + this.calcularMontoReal(factura),
          0,
        ),
        cantidad: comprobantesMesActual.length,
        color: 'purple',
      },
      {
        titulo: this.capitalizarPrimeraLetra(format(subMonths(hoy, 1), 'MMMM', { locale: es })),
        total: comprobantesMesAnterior.reduce(
          (sum, factura) => sum + this.calcularMontoReal(factura),
          0,
        ),
        cantidad: comprobantesMesAnterior.length,
        color: 'orange',
      },
    ];
  });

  totalAnual = computed(() => {
    const anoActual = this.getAnoActual();
    return this.facturas()
      .filter((factura) => factura.estado === 'emitida' && factura.fecha.startsWith(anoActual.toString()))
      .reduce((sum, factura) => sum + this.calcularMontoReal(factura), 0);
  });

  comprobantesAnuales = computed(() => {
    const anoActual = this.getAnoActual();
    return this.facturas().filter(
      (factura) => factura.estado === 'emitida' && factura.fecha.startsWith(anoActual.toString()),
    ).length;
  });

  promedioMensual = computed(() => {
    const mesActual = new Date().getMonth() + 1;
    return mesActual > 0 ? this.totalAnual() / mesActual : 0;
  });

  ticketPromedio = computed(() => {
    const totalComprobantes = this.comprobantesAnuales();
    return totalComprobantes > 0 ? this.totalAnual() / totalComprobantes : 0;
  });

}
