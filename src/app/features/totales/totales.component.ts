import { Component, signal, computed } from '@angular/core';
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CurrencyPipe } from '@angular/common';
import { supabase } from '../../core/services/supabase.service';

interface PeriodoTotal {
  nombre: string;
  fechaTexto: string;
  total: number;
  cantidad: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

interface FacturaData {
  fecha: string;
  monto: number;
  estado: string;
  tipo_comprobante: string;
  esNotaCredito: boolean;
}

@Component({
  selector: 'app-totales',
  template: `
  <div class="space-y-3">
      <!-- Loading state -->
      @if (cargando()) {
        <div class="text-center py-8">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-muted-foreground mt-4">Cargando datos...</p>
        </div>
      } @else {
        <!-- Totales por período -->
  <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          @for (periodo of periodos(); track periodo.nombre) {
            <div class="card-surface p-4"
                 [class]="'border-l-4 border-l-' + periodo.color + '-500'">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-primary">
                    {{ periodo.nombre }}
                  </p>
                  <p class="text-xs text-muted-foreground mt-1">
                    {{ periodo.fechaTexto }}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-2xl font-bold text-foreground">
                    {{ periodo.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    {{ periodo.cantidad }} comprobante{{ periodo.cantidad !== 1 ? 's' : '' }}
                  </p>
                </div>
              </div>
            </div>
          }
        </div>

        

        <!-- Resumen anual -->
        <div class="bg-muted rounded-lg border border-border p-4">
          <div class="text-center">
            <h3 class="text-xl font-bold text-foreground mb-2">
              Resumen del Año {{ getAnoActual() }}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div class="text-center">
                <p class="text-3xl font-bold text-primary">{{ totalAnual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}</p>
                <p class="text-sm text-muted-foreground">Total facturado</p>
              </div>
              <div class="text-center">
                <p class="text-3xl font-bold text-primary">{{ comprobantesAnuales() }}</p>
                <p class="text-sm text-muted-foreground">Comprobantes emitidos</p>
              </div>
              <div class="text-center">
                <p class="text-3xl font-bold text-primary">{{ promedioMensual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}</p>
                <p class="text-sm text-muted-foreground">Promedio mensual</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Métricas adicionales -->
  <div class="grid gap-3 md:grid-cols-2">
          <!-- Día más productivo -->
          <div class="card-surface p-4">
            <h3 class="text-lg font-semibold text-foreground mb-4">Día Más Productivo</h3>
            @if (mejorDia()) {
              <div class="text-center">
                <p class="text-2xl font-bold text-primary">
                  {{ mejorDia()?.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="text-sm text-muted-foreground">{{ mejorDia()?.fecha }}</p>
                <p class="text-xs text-muted-foreground">{{ mejorDia()?.cantidad }} comprobante(s)</p>
              </div>
            } @else {
              <p class="text-muted-foreground text-center">No hay datos suficientes</p>
            }
          </div>

          <!-- Ticket promedio -->
          <div class="card-surface p-4">
            <h3 class="text-lg font-semibold text-foreground mb-4">Ticket Promedio</h3>
            <div class="text-center">
              <p class="text-2xl font-bold text-primary">
                {{ ticketPromedio() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
              </p>
              <p class="text-sm text-muted-foreground">Por comprobante</p>
              <p class="text-xs text-muted-foreground">Basado en {{ comprobantesAnuales() }} comprobante(s)</p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [CurrencyPipe]
})
export class TotalesComponent {
  // Signals para datos reales de Supabase
  facturas = signal<FacturaData[]>([]);
  cargando = signal(false);

  constructor() {
    this.cargarDatosIniciales();
  }

  async cargarDatosIniciales() {
    this.cargando.set(true);
    
    try {
      // Cargar facturas
      const { data: facturas, error: errorFacturas } = await supabase
        .from('facturas')
        .select('fecha, monto, estado, tipo_comprobante')
        .order('fecha', { ascending: false });

      // Cargar notas de crédito
      const { data: notasCredito, error: errorNotas } = await supabase
        .from('notas_credito')
        .select('fecha, monto, tipo_comprobante')
        .order('fecha', { ascending: false });

      if (errorFacturas || errorNotas) {
        console.error('Error al cargar datos:', errorFacturas, errorNotas);
        return;
      }

      // Combinar y convertir al formato esperado
      const todosLosComprobantes: FacturaData[] = [
        // Facturas
        ...(facturas || []).map(f => ({
          fecha: f.fecha,
          monto: Number(f.monto),
          estado: f.estado,
          tipo_comprobante: f.tipo_comprobante,
          esNotaCredito: false
        })),
        // Notas de crédito
        ...(notasCredito || []).map(nc => ({
          fecha: nc.fecha,
          monto: Number(nc.monto),
          estado: 'emitida', // Las NC siempre están emitidas
          tipo_comprobante: nc.tipo_comprobante || 'NOTA DE CREDITO B',
          esNotaCredito: true
        }))
      ];

      this.facturas.set(todosLosComprobantes);

    } catch (error) {
      console.error('Error inesperado al cargar datos:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  getAnoActual = computed(() => new Date().getFullYear());

  // Helper para calcular monto real (facturas positivas, NC negativas)
  calcularMontoReal = (comprobante: FacturaData) => {
    return comprobante.esNotaCredito ? -comprobante.monto : comprobante.monto;
  };

  periodos = computed((): PeriodoTotal[] => {
    const hoy = new Date();
    const ayer = subDays(hoy, 1);
    const inicioMesActual = startOfMonth(hoy);
    const finMesActual = endOfMonth(hoy);
    const inicioMesAnterior = startOfMonth(subMonths(hoy, 1));
    const finMesAnterior = endOfMonth(subMonths(hoy, 1));

    const comprobantesEmitidos = this.facturas().filter(f => f.estado === 'emitida');

    // Hoy
    const comprobantesHoy = comprobantesEmitidos.filter(f => f.fecha === format(hoy, 'yyyy-MM-dd'));
    const totalHoy = comprobantesHoy.reduce((sum, f) => sum + this.calcularMontoReal(f), 0);

    // Ayer
    const comprobantesAyer = comprobantesEmitidos.filter(f => f.fecha === format(ayer, 'yyyy-MM-dd'));
    const totalAyer = comprobantesAyer.reduce((sum, f) => sum + this.calcularMontoReal(f), 0);

    // Mes actual
    const comprobantesMesActual = comprobantesEmitidos.filter(f => {
      const fechaFactura = new Date(f.fecha + 'T00:00:00');
      return fechaFactura >= inicioMesActual && fechaFactura <= finMesActual;
    });
    const totalMesActual = comprobantesMesActual.reduce((sum, f) => sum + this.calcularMontoReal(f), 0);

    // Mes anterior
    const comprobantesMesAnterior = comprobantesEmitidos.filter(f => {
      const fechaFactura = new Date(f.fecha + 'T00:00:00');
      return fechaFactura >= inicioMesAnterior && fechaFactura <= finMesAnterior;
    });
    const totalMesAnterior = comprobantesMesAnterior.reduce((sum, f) => sum + this.calcularMontoReal(f), 0);

    return [
      {
        nombre: 'Hoy',
        fechaTexto: format(hoy, 'd \'de\' MMMM', { locale: es }),
        total: totalHoy,
        cantidad: comprobantesHoy.length,
        color: 'blue'
      },
      {
        nombre: 'Ayer',
        fechaTexto: format(ayer, 'd \'de\' MMMM', { locale: es }),
        total: totalAyer,
        cantidad: comprobantesAyer.length,
        color: 'green'
      },
      {
        nombre: 'Mes Actual',
        fechaTexto: format(hoy, 'MMMM yyyy', { locale: es }),
        total: totalMesActual,
        cantidad: comprobantesMesActual.length,
        color: 'purple'
      },
      {
        nombre: 'Mes Anterior',
        fechaTexto: format(subMonths(hoy, 1), 'MMMM yyyy', { locale: es }),
        total: totalMesAnterior,
        cantidad: comprobantesMesAnterior.length,
        color: 'orange'
      }
    ];
  });

  maxTotal = computed(() => {
    return Math.max(...this.periodos().map(p => p.total), 1);
  });

  totalAnual = computed(() => {
    const anoActual = this.getAnoActual();
    return this.facturas()
      .filter(f => f.estado === 'emitida' && f.fecha.startsWith(anoActual.toString()))
      .reduce((sum, f) => sum + this.calcularMontoReal(f), 0);
  });

  comprobantesAnuales = computed(() => {
    const anoActual = this.getAnoActual();
    return this.facturas()
      .filter(f => f.estado === 'emitida' && f.fecha.startsWith(anoActual.toString()))
      .length;
  });

  promedioMensual = computed(() => {
    const totalAnual = this.totalAnual();
    const mesActual = new Date().getMonth() + 1; // Meses transcurridos
    return mesActual > 0 ? totalAnual / mesActual : 0;
  });

  ticketPromedio = computed(() => {
    const totalComprobantes = this.comprobantesAnuales();
    const totalAnual = this.totalAnual();
    return totalComprobantes > 0 ? totalAnual / totalComprobantes : 0;
  });

  mejorDia = computed(() => {
    const comprobantesEmitidos = this.facturas().filter(f => f.estado === 'emitida');
    const totalesPorDia = new Map<string, { total: number; cantidad: number }>();

    comprobantesEmitidos.forEach(f => {
      const existing = totalesPorDia.get(f.fecha) || { total: 0, cantidad: 0 };
      totalesPorDia.set(f.fecha, {
        total: existing.total + this.calcularMontoReal(f),
        cantidad: existing.cantidad + 1
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

    if (!mejorFecha) return null;

    return {
      fecha: format(new Date(mejorFecha + 'T00:00:00'), 'EEEE d \'de\' MMMM', { locale: es }),
      total: mejorTotal,
      cantidad: mejorCantidad
    };
  });

  getBarWidth(total: number): number {
    const maxTotal = this.maxTotal();
    return maxTotal > 0 ? (total / maxTotal) * 100 : 0;
  }
}
