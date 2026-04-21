import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ComprobanteMetricRow } from '../../core/types/comprobantes.types';

interface PeriodoTotal {
  nombre: string;
  fechaTexto: string;
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
        <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          @for (periodo of periodos(); track periodo.nombre) {
            <div class="card-surface totales-period-card p-4" [class]="'border-l-4 border-l-' + periodo.color + '-500'">
              <div class="totales-period-card__layout">
                <div class="totales-period-card__copy">
                  <p class="period-title">{{ periodo.nombre }}</p>
                  <p class="period-sub">{{ periodo.fechaTexto }}</p>
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
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
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
            </div>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2">
          <div class="card-surface totales-detail-card p-4">
            <h3 class="period-title totales-section-title mb-4">Día Más Productivo</h3>
            @if (mejorDia()) {
              <div class="text-center">
                <p class="period-amount totales-detail-amount">
                  {{ mejorDia()?.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="period-sub">{{ mejorDia()?.fecha }}</p>
                <p class="period-sub text-info">{{ mejorDia()?.cantidad }} comprobante(s)</p>
              </div>
            } @else {
              <p class="period-sub text-center">No hay datos suficientes</p>
            }
          </div>

          <div class="card-surface totales-detail-card p-4">
            <h3 class="period-title totales-section-title mb-4">Ticket Promedio</h3>
            <div class="text-center">
              <p class="period-amount totales-detail-amount">
                {{ ticketPromedio() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
              </p>
              <p class="period-sub">Por comprobante</p>
              <p class="period-sub text-info">
                Basado en {{ comprobantesAnuales() }} comprobante(s)
              </p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [CurrencyPipe],
  styles: [`
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

    .totales-period-card .period-amount {
      font-size: clamp(1.55rem, 1.3rem + 1vw, 2.15rem);
      font-weight: 700;
      line-height: 0.96;
      letter-spacing: -0.03em;
      white-space: nowrap;
    }

    .totales-period-card .period-sub {
      font-size: 0.96rem;
    }

    .totales-period-card__metric .period-sub {
      margin-top: 0.45rem;
      font-size: 0.9rem;
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

    .totales-detail-card {
      min-height: 13.25rem;
    }

    .totales-detail-amount {
      font-size: clamp(2rem, 1.75rem + 0.85vw, 2.55rem);
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

      .totales-period-card .period-amount {
        white-space: normal;
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
      .totales-hero-amount,
      .totales-detail-amount {
        white-space: normal;
      }
    }
  `],
})
export class TotalesComponent {
  readonly facturas = signal<ComprobanteMetricRow[]>([]);
  readonly cargando = signal(false);

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

    try {
      this.facturas.set(
        await this.comprobantesService.cargarMetricasComprobantes(contribuyente.id),
      );
    } catch (error) {
      console.error('Error inesperado al cargar datos:', error);
      this.facturas.set([]);
    } finally {
      this.cargando.set(false);
    }
  }

  getAnoActual = computed(() => new Date().getFullYear());

  calcularMontoReal = (comprobante: ComprobanteMetricRow) =>
    comprobante.esNotaCredito ? -comprobante.total : comprobante.total;

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
        nombre: 'Hoy',
        fechaTexto: format(hoy, "d 'de' MMMM", { locale: es }),
        total: comprobantesHoy.reduce((sum, factura) => sum + this.calcularMontoReal(factura), 0),
        cantidad: comprobantesHoy.length,
        color: 'blue',
      },
      {
        nombre: 'Ayer',
        fechaTexto: format(ayer, "d 'de' MMMM", { locale: es }),
        total: comprobantesAyer.reduce((sum, factura) => sum + this.calcularMontoReal(factura), 0),
        cantidad: comprobantesAyer.length,
        color: 'green',
      },
      {
        nombre: 'Mes Actual',
        fechaTexto: format(hoy, 'MMMM yyyy', { locale: es }),
        total: comprobantesMesActual.reduce(
          (sum, factura) => sum + this.calcularMontoReal(factura),
          0,
        ),
        cantidad: comprobantesMesActual.length,
        color: 'purple',
      },
      {
        nombre: 'Mes Anterior',
        fechaTexto: format(subMonths(hoy, 1), 'MMMM yyyy', { locale: es }),
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

  mejorDia = computed(() => {
    const comprobantesEmitidos = this.facturas().filter((factura) => factura.estado === 'emitida');
    const totalesPorDia = new Map<string, { total: number; cantidad: number }>();

    comprobantesEmitidos.forEach((factura) => {
      const existing = totalesPorDia.get(factura.fecha) || { total: 0, cantidad: 0 };
      totalesPorDia.set(factura.fecha, {
        total: existing.total + this.calcularMontoReal(factura),
        cantidad: existing.cantidad + 1,
      });
    });

    let mejorFecha = '';
    let mejorTotal = 0;
    let mejorCantidad = 0;

    totalesPorDia.forEach((data, fecha) => {
      if (data.total > mejorTotal) {
        mejorTotal = data.total;
        mejorFecha = fecha;
        mejorCantidad = data.cantidad;
      }
    });

    if (!mejorFecha) {
      return null;
    }

    return {
      fecha: format(new Date(`${mejorFecha}T00:00:00`), "EEEE d 'de' MMMM", { locale: es }),
      total: mejorTotal,
      cantidad: mejorCantidad,
    };
  });
}
