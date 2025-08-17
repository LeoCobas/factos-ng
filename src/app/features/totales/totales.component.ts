 m import { Component, signal, computed } from '@angular/core';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, subDays } from 'date-fns';
import { es } from 'date-fns/locale';

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
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Totales</h1>
        <p class="text-gray-600 mt-1">
          Estadísticas y resúmenes de facturación
        </p>
      </div>

      <!-- Totales por período -->
      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        @for (periodo of periodos(); track periodo.nombre) {
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6"
               [class]="'border-l-4 border-l-' + periodo.color + '-500'">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium" [class]="'text-' + periodo.color + '-600'">
                  {{ periodo.nombre }}
                </p>
                <p class="text-xs text-gray-500 mt-1">
                  {{ periodo.fechaTexto }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-2xl font-bold text-gray-900">
                  {{ periodo.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
                </p>
                <p class="text-xs text-gray-500">
                  {{ periodo.cantidad }} factura{{ periodo.cantidad !== 1 ? 's' : '' }}
                </p>
              </div>
            </div>
          </div>
        }
      </div>

      <!-- Gráfico simple (representación textual) -->
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Comparación de Períodos</h3>
        
        <div class="space-y-4">
          @for (periodo of periodos(); track periodo.nombre) {
            <div class="flex items-center">
              <div class="w-20 text-sm text-gray-600">{{ periodo.nombre }}</div>
              <div class="flex-1 mx-4">
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    class="h-2 rounded-full"
                    [class]="'bg-' + periodo.color + '-500'"
                    [style.width.%]="getBarWidth(periodo.total)"
                  ></div>
                </div>
              </div>
              <div class="w-24 text-sm text-right font-medium">
                {{ periodo.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Resumen anual -->
      <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div class="text-center">
          <h3 class="text-xl font-bold text-gray-900 mb-2">
            Resumen del Año {{ añoActual() }}
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div class="text-center">
              <p class="text-3xl font-bold text-blue-600">{{ totalAnual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}</p>
              <p class="text-sm text-gray-600">Total facturado</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-green-600">{{ facturasAnuales() }}</p>
              <p class="text-sm text-gray-600">Facturas emitidas</p>
            </div>
            <div class="text-center">
              <p class="text-3xl font-bold text-purple-600">{{ promedioMensual() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}</p>
              <p class="text-sm text-gray-600">Promedio mensual</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Métricas adicionales -->
      <div class="grid gap-6 md:grid-cols-2">
        <!-- Día más productivo -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Día Más Productivo</h3>
          @if (mejorDia()) {
            <div class="text-center">
              <p class="text-2xl font-bold text-green-600">
                {{ mejorDia()?.total | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
              </p>
              <p class="text-sm text-gray-600">{{ mejorDia()?.fecha }}</p>
              <p class="text-xs text-gray-500">{{ mejorDia()?.cantidad }} factura(s)</p>
            </div>
          } @else {
            <p class="text-gray-500 text-center">No hay datos suficientes</p>
          }
        </div>

        <!-- Factura promedio -->
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Ticket Promedio</h3>
          <div class="text-center">
            <p class="text-2xl font-bold text-blue-600">
              {{ facturaPromedio() | currency:'ARS':'symbol':'1.0-0':'es-AR' }}
            </p>
            <p class="text-sm text-gray-600">Por factura</p>
            <p class="text-xs text-gray-500">Basado en {{ facturasAnuales() }} factura(s)</p>
          </div>
        </div>
      </div>
    </div>
  `,
  imports: []
})
export class TotalesComponent {
  // Datos simulados (en la app real vendrían de Supabase)
  facturas = signal([
    { fecha: '2024-08-16', monto: 15000, estado: 'emitida' },
    { fecha: '2024-08-16', monto: 8500, estado: 'emitida' },
    { fecha: '2024-08-15', monto: 12300, estado: 'emitida' },
    { fecha: '2024-08-14', monto: 9800, estado: 'emitida' },
    { fecha: '2024-08-13', monto: 22100, estado: 'emitida' },
    { fecha: '2024-07-30', monto: 18700, estado: 'emitida' },
    { fecha: '2024-07-28', monto: 14200, estado: 'emitida' },
    { fecha: '2024-07-25', monto: 11900, estado: 'emitida' },
  ]);

  añoActual = computed(() => new Date().getFullYear());

  periodos = computed((): PeriodoTotal[] => {
    const hoy = new Date();
    const ayer = subDays(hoy, 1);
    const inicioMesActual = startOfMonth(hoy);
    const finMesActual = endOfMonth(hoy);
    const inicioMesAnterior = startOfMonth(subMonths(hoy, 1));
    const finMesAnterior = endOfMonth(subMonths(hoy, 1));

    const facturasEmitidas = this.facturas().filter(f => f.estado === 'emitida');

    // Hoy
    const facturasHoy = facturasEmitidas.filter(f => f.fecha === format(hoy, 'yyyy-MM-dd'));
    const totalHoy = facturasHoy.reduce((sum, f) => sum + f.monto, 0);

    // Ayer
    const facturasAyer = facturasEmitidas.filter(f => f.fecha === format(ayer, 'yyyy-MM-dd'));
    const totalAyer = facturasAyer.reduce((sum, f) => sum + f.monto, 0);

    // Mes actual
    const facturasMesActual = facturasEmitidas.filter(f => {
      const fechaFactura = new Date(f.fecha + 'T00:00:00');
      return fechaFactura >= inicioMesActual && fechaFactura <= finMesActual;
    });
    const totalMesActual = facturasMesActual.reduce((sum, f) => sum + f.monto, 0);

    // Mes anterior
    const facturasMesAnterior = facturasEmitidas.filter(f => {
      const fechaFactura = new Date(f.fecha + 'T00:00:00');
      return fechaFactura >= inicioMesAnterior && fechaFactura <= finMesAnterior;
    });
    const totalMesAnterior = facturasMesAnterior.reduce((sum, f) => sum + f.monto, 0);

    return [
      {
        nombre: 'Hoy',
        fechaTexto: format(hoy, 'd \'de\' MMMM', { locale: es }),
        total: totalHoy,
        cantidad: facturasHoy.length,
        color: 'blue'
      },
      {
        nombre: 'Ayer',
        fechaTexto: format(ayer, 'd \'de\' MMMM', { locale: es }),
        total: totalAyer,
        cantidad: facturasAyer.length,
        color: 'green'
      },
      {
        nombre: 'Mes Actual',
        fechaTexto: format(hoy, 'MMMM yyyy', { locale: es }),
        total: totalMesActual,
        cantidad: facturasMesActual.length,
        color: 'purple'
      },
      {
        nombre: 'Mes Anterior',
        fechaTexto: format(subMonths(hoy, 1), 'MMMM yyyy', { locale: es }),
        total: totalMesAnterior,
        cantidad: facturasMesAnterior.length,
        color: 'orange'
      }
    ];
  });

  maxTotal = computed(() => {
    return Math.max(...this.periodos().map(p => p.total), 1);
  });

  totalAnual = computed(() => {
    const añoActual = this.añoActual();
    return this.facturas()
      .filter(f => f.estado === 'emitida' && f.fecha.startsWith(añoActual.toString()))
      .reduce((sum, f) => sum + f.monto, 0);
  });

  facturasAnuales = computed(() => {
    const añoActual = this.añoActual();
    return this.facturas()
      .filter(f => f.estado === 'emitida' && f.fecha.startsWith(añoActual.toString()))
      .length;
  });

  promedioMensual = computed(() => {
    const totalAnual = this.totalAnual();
    const mesActual = new Date().getMonth() + 1; // Meses transcurridos
    return mesActual > 0 ? totalAnual / mesActual : 0;
  });

  facturaPromedio = computed(() => {
    const totalFacturas = this.facturasAnuales();
    const totalAnual = this.totalAnual();
    return totalFacturas > 0 ? totalAnual / totalFacturas : 0;
  });

  mejorDia = computed(() => {
    const facturasEmitidas = this.facturas().filter(f => f.estado === 'emitida');
    const totalesPorDia = new Map<string, { total: number; cantidad: number }>();

    facturasEmitidas.forEach(f => {
      const existing = totalesPorDia.get(f.fecha) || { total: 0, cantidad: 0 };
      totalesPorDia.set(f.fecha, {
        total: existing.total + f.monto,
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
