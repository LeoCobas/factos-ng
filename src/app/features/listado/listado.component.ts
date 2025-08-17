import { Component, signal, computed } from '@angular/core';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface Factura {
  id: string;
  numero: string;
  fecha: string;
  monto: number;
  estado: 'emitida' | 'anulada';
  cae?: string;
  tipo_comprobante: string;
  pdf_url?: string;
}

@Component({
  selector: 'app-listado',
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Listado de Facturas</h1>
          <p class="text-gray-600 mt-1">
            Gestión de comprobantes emitidos
          </p>
        </div>

        <!-- Selector de fecha -->
        <div class="mt-4 sm:mt-0">
          <label for="fecha" class="block text-sm font-medium text-gray-700 mb-1">
            Seleccionar fecha
          </label>
          <input
            type="date"
            [value]="fechaSeleccionada()"
            (change)="cambiarFecha($event)"
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <!-- Facturas del día -->
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div class="p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ nombreFechaSeleccionada() }}
          </h3>
          <p class="text-sm text-gray-600">
            {{ facturasFiltradas().length }} comprobante(s) emitido(s)
          </p>
        </div>

        <div class="divide-y divide-gray-200">
          @if (facturasFiltradas().length === 0) {
            <div class="p-8 text-center text-gray-500">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              <p>No hay facturas emitidas en esta fecha</p>
              <p class="text-sm mt-1">Las facturas aparecerán aquí después de emitirlas</p>
            </div>
          } @else {
            @for (factura of facturasFiltradas(); track factura.id) {
              <div class="p-4 hover:bg-gray-50 cursor-pointer" (click)="verFactura(factura)">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center space-x-3">
                      <div class="flex-shrink-0">
                        @if (factura.estado === 'emitida') {
                          <div class="w-3 h-3 bg-green-400 rounded-full"></div>
                        } @else {
                          <div class="w-3 h-3 bg-red-400 rounded-full"></div>
                        }
                      </div>
                      <div>
                        <p class="text-sm font-medium text-gray-900">{{ factura.numero }}</p>
                        <p class="text-sm text-gray-500">{{ factura.tipo_comprobante }}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div class="text-right">
                    <p class="text-sm font-medium text-gray-900">
                      {{ factura.monto | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
                    </p>
                    <p class="text-sm text-gray-500 capitalize">{{ factura.estado }}</p>
                  </div>
                </div>

                @if (factura.cae) {
                  <div class="mt-2 text-xs text-gray-400">
                    CAE: {{ factura.cae }}
                  </div>
                }
              </div>
            }
          }
        </div>
      </div>

      <!-- Resumen del día -->
      @if (facturasFiltradas().length > 0) {
        <div class="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-blue-800">Total del día</p>
              <p class="text-xs text-blue-600">{{ facturasFiltradas().length }} comprobante(s)</p>
            </div>
            <div class="text-right">
              <p class="text-lg font-bold text-blue-800">
                {{ totalDelDia() | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
              </p>
              <p class="text-xs text-blue-600">
                {{ facturasEmitidas().length }} emitida(s) • {{ facturasAnuladas().length }} anulada(s)
              </p>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Modal de detalles (simplificado) -->
    @if (facturaSeleccionada()) {
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" (click)="cerrarModal()">
        <div class="bg-white rounded-lg p-6 max-w-md w-full" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">Detalles de Factura</h3>
            <button (click)="cerrarModal()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          
          <div class="space-y-3">
            <div>
              <p class="text-sm text-gray-600">Número</p>
              <p class="font-medium">{{ facturaSeleccionada()?.numero }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Fecha</p>
              <p class="font-medium">{{ facturaSeleccionada()?.fecha }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Monto</p>
              <p class="font-medium">{{ facturaSeleccionada()?.monto | currency:'ARS':'symbol':'1.2-2':'es-AR' }}</p>
            </div>
            <div>
              <p class="text-sm text-gray-600">Estado</p>
              <p class="font-medium capitalize">{{ facturaSeleccionada()?.estado }}</p>
            </div>
            @if (facturaSeleccionada()?.cae) {
              <div>
                <p class="text-sm text-gray-600">CAE</p>
                <p class="font-mono text-sm">{{ facturaSeleccionada()?.cae }}</p>
              </div>
            }
          </div>

          <div class="flex space-x-3 mt-6">
            <button
              (click)="verPDF(facturaSeleccionada()!)"
              class="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              Ver PDF
            </button>
            @if (facturaSeleccionada()?.estado === 'emitida') {
              <button
                (click)="confirmarAnulacion(facturaSeleccionada()!)"
                [disabled]="anulando()"
                class="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {{ anulando() ? 'Anulando...' : 'Anular' }}
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  imports: []
})
export class ListadoComponent {
  fechaSeleccionada = signal(format(new Date(), 'yyyy-MM-dd'));
  facturaSeleccionada = signal<Factura | null>(null);
  anulando = signal(false);

  // Datos simulados (en la app real vendrían de Supabase)
  facturas = signal<Factura[]>([
    {
      id: '1',
      numero: '0001-00000040',
      fecha: '2024-08-16',
      monto: 15000,
      estado: 'emitida',
      cae: '74830150816940',
      tipo_comprobante: 'Factura C'
    },
    {
      id: '2',
      numero: '0001-00000041',
      fecha: '2024-08-16',
      monto: 8500,
      estado: 'emitida',
      cae: '74830150816941',
      tipo_comprobante: 'Factura C'
    },
    {
      id: '3',
      numero: '0001-00000039',
      fecha: '2024-08-15',
      monto: 12300,
      estado: 'anulada',
      tipo_comprobante: 'Factura C'
    }
  ]);

  facturasFiltradas = computed(() => {
    const fecha = this.fechaSeleccionada();
    return this.facturas().filter(f => f.fecha === fecha);
  });

  nombreFechaSeleccionada = computed(() => {
    const fecha = new Date(this.fechaSeleccionada() + 'T00:00:00');
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const ayer = format(new Date(Date.now() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    if (this.fechaSeleccionada() === hoy) {
      return 'Hoy - ' + format(fecha, 'EEEE d \'de\' MMMM \'de\' yyyy', { locale: es });
    } else if (this.fechaSeleccionada() === ayer) {
      return 'Ayer - ' + format(fecha, 'EEEE d \'de\' MMMM \'de\' yyyy', { locale: es });
    } else {
      return format(fecha, 'EEEE d \'de\' MMMM \'de\' yyyy', { locale: es });
    }
  });

  totalDelDia = computed(() => {
    return this.facturasEmitidas().reduce((total, factura) => total + factura.monto, 0);
  });

  facturasEmitidas = computed(() => {
    return this.facturasFiltradas().filter(f => f.estado === 'emitida');
  });

  facturasAnuladas = computed(() => {
    return this.facturasFiltradas().filter(f => f.estado === 'anulada');
  });

  cambiarFecha(event: Event) {
    const target = event.target as HTMLInputElement;
    this.fechaSeleccionada.set(target.value);
  }

  verFactura(factura: Factura) {
    this.facturaSeleccionada.set(factura);
  }

  cerrarModal() {
    this.facturaSeleccionada.set(null);
  }

  verPDF(factura: Factura) {
    console.log('Ver PDF de factura:', factura.numero);
    // Aquí se abriría el PDF
  }

  async confirmarAnulacion(factura: Factura) {
    const confirmar = confirm(`¿Estás seguro de que deseas anular la factura ${factura.numero}?`);
    if (!confirmar) return;

    this.anulando.set(true);
    
    try {
      // Simular anulación
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Actualizar estado
      this.facturas.update(facturas => 
        facturas.map(f => 
          f.id === factura.id 
            ? { ...f, estado: 'anulada' as const }
            : f
        )
      );

      this.cerrarModal();
      
    } catch (error) {
      console.error('Error al anular factura:', error);
    } finally {
      this.anulando.set(false);
    }
  }
}
