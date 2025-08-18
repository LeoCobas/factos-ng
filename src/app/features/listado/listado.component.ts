import { Component, signal, computed, inject } from '@angular/core';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CurrencyPipe, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es-AR';
import { supabase } from '../../core/services/supabase.service';
import { PdfService } from '../../core/services/pdf.service';

interface Factura {
  id: string;
  numero_factura: string;
  fecha: string;
  monto: number;
  estado: 'emitida' | 'anulada';
  cae?: string;
  tipo_comprobante: string;
  pdf_url?: string;
  concepto?: string;
  punto_venta?: number;
  created_at?: string;
  updated_at?: string;
}

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CurrencyPipe],
  template: `
    <!-- Simplified mobile-first design matching screenshot -->
    <div class="space-y-4 sm:space-y-6">
      <!-- Selector de fecha -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <label class="block text-sm font-medium text-gray-700 mb-4">
          Seleccionar fecha
        </label>
        
        <div class="relative">
          <input
            type="date"
            [value]="fechaSeleccionada()"
            (change)="cambiarFecha($event)"
            class="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pl-10"
          />
          <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </div>
      </div>

      <!-- Lista de facturas -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 class="block text-sm font-medium text-gray-700 mb-4">
          {{ nombreFechaSeleccionada() }}
        </h3>

        @if (cargando()) {
          <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p class="text-gray-500 mt-4">Cargando facturas...</p>
          </div>
        } @else if (facturasFiltradas().length === 0) {
          <div class="text-center py-8">
            <svg class="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-gray-500">No hay facturas para esta fecha</p>
          </div>
        } @else {
          <div class="space-y-2">
            @for (factura of facturasFiltradas(); track factura.id) {
              <div class="border border-gray-200 rounded-lg overflow-hidden transition-all duration-200"
                   [class]="facturaExpandida() === factura.id ? 'shadow-md border-blue-300' : 'shadow-sm'">
                
                <!-- Tarjeta principal (clickeable) -->
                <div [class]="obtenerClaseFilaFactura(factura) + ' p-3 cursor-pointer hover:bg-gray-50'"
                     (click)="toggleExpansion(factura.id)">
                  <div class="flex items-center justify-between gap-3">
                    <!-- Tipo de comprobante -->
                    <div class="text-xs font-medium text-gray-700 min-w-0 flex-shrink-0 text-left">
                      {{ obtenerTipoComprobante(factura) }}
                    </div>
                    <!-- Número de factura -->
                    <div class="font-mono text-sm min-w-0 flex-shrink-0 text-right">
                      {{ obtenerNumeroSinCeros(factura.numero_factura) }}
                    </div>
                    <!-- Estado -->
                    <div class="min-w-0 flex-shrink-0 text-center">
                      <span class="px-2 py-1 rounded text-xs font-medium"
                            [class]="obtenerClaseEstado(factura.estado)">
                        {{ obtenerTextoEstado(factura.estado) }}
                      </span>
                    </div>
                    <!-- Monto -->
                    <div class="text-right font-semibold text-sm min-w-0" [class]="obtenerClaseMonto(factura).replace('col-span-3', '')">
                      {{ obtenerMontoMostrar(factura) | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
                    </div>
                    <!-- Icono de expansión -->
                    <div class="ml-2 text-gray-400">
                      <svg class="w-4 h-4 transition-transform duration-200"
                           [class]="facturaExpandida() === factura.id ? 'rotate-180' : ''"
                           fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                </div>

                <!-- Panel expandido con botones de acción -->
                @if (facturaExpandida() === factura.id) {
                  <div class="border-t border-gray-200 bg-gray-50 p-4 animate-fadeIn">
                    <div class="grid grid-cols-2 gap-2 mb-3">
                      <button
                        (click)="verPDF(factura)"
                        class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        Ver
                      </button>
                      <button
                        (click)="compartir(factura)"
                        class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                        </svg>
                        Compartir
                      </button>
                      <button
                        (click)="descargar(factura)"
                        class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Descargar
                      </button>
                      <button
                        (click)="imprimir(factura)"
                        class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        Imprimir
                      </button>
                    </div>
                    
                    <!-- Información adicional -->
                    <div class="text-xs text-gray-600 space-y-1">
                      @if (factura.cae) {
                        <div>CAE: {{ factura.cae }}</div>
                      }
                      @if (factura.concepto) {
                        <div>Concepto: {{ factura.concepto }}</div>
                      }
                      @if (factura.punto_venta) {
                        <div>Punto de venta: {{ factura.punto_venta }}</div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      <!-- Totales del día -->
      @if (facturasFiltradas().length > 0) {
  <div class="bg-blue-50 rounded-lg border border-blue-200 p-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-blue-800">
              Total del día ({{ facturasFiltradas().length }} facturas)
            </span>
            <span class="text-lg font-bold text-blue-900">
              {{ totalDelDia() | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
            </span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out;
    }
  `]
})
export class ListadoComponent {
  // Signals para estado
  fechaSeleccionada = signal(new Date().toISOString().split('T')[0]); // Fecha actual por defecto
  facturas = signal<Factura[]>([]);
  cargando = signal(false);
  facturaExpandida = signal<string | null>(null); // ID de factura expandida

  constructor(private pdfService: PdfService) {
    // Registrar locale argentino
    registerLocaleData(localeEs, 'es-AR');
    
    // Cargar facturas iniciales
    this.cargarFacturasIniciales();
  }

  // Función para alternar la expansión de una tarjeta
  toggleExpansion(facturaId: string) {
    if (this.facturaExpandida() === facturaId) {
      this.facturaExpandida.set(null);
    } else {
      this.facturaExpandida.set(facturaId);
    }
  }

  // Métodos de acción para PDF (adaptados de facturar-nuevo)
  async verPDF(factura: any) {
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible');
      return;
    }

    try {
      // Abrir en nueva pestaña
      window.open(factura.pdf_url, '_blank');
    } catch (error) {
      console.error('Error al abrir PDF:', error);
    }
  }

  async compartir(factura: any) {
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible para compartir');
      return;
    }

    try {
      const pdfInfo = {
        url: factura.pdf_url,
        filename: `factura-${factura.numero_factura}.pdf`,
        title: `Factura ${factura.numero_factura}`,
        text: `Factura ${factura.numero_factura} - ${factura.monto}`
      };
      await this.pdfService.sharePdf(pdfInfo);
    } catch (error) {
      console.error('Error al compartir:', error);
    }
  }

  async descargar(factura: any) {
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible para descargar');
      return;
    }

    try {
      const pdfInfo = {
        url: factura.pdf_url,
        filename: `factura-${factura.numero_factura}.pdf`,
        title: `Factura ${factura.numero_factura}`,
        text: `Factura ${factura.numero_factura} - ${factura.monto}`
      };
      await this.pdfService.downloadPdf(pdfInfo);
    } catch (error) {
      console.error('Error al descargar:', error);
    }
  }

  async imprimir(factura: any) {
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible para imprimir');
      return;
    }

    try {
      const pdfInfo = {
        url: factura.pdf_url,
        filename: `factura-${factura.numero_factura}.pdf`,
        title: `Factura ${factura.numero_factura}`,
        text: `Factura ${factura.numero_factura} - ${factura.monto}`
      };
      await this.pdfService.printPdf(pdfInfo);
    } catch (error) {
      console.error('Error al imprimir:', error);
    }
  }

  // Computed para nombre de fecha formateado
  nombreFechaSeleccionada = computed(() => {
    const fecha = new Date(this.fechaSeleccionada() + 'T00:00:00');
    return `Facturas del ${format(fecha, 'dd/MM/yyyy', { locale: es })}`;
  });

  // Computed para facturas filtradas por fecha
  facturasFiltradas = computed(() => {
    const fechaStr = this.fechaSeleccionada();
    return this.facturas()
      .filter(f => f.fecha === fechaStr)
      .sort((a, b) => {
        // Ordenar por número de factura (orden de emisión)
        const numA = this.extraerNumeroFactura(a.numero_factura);
        const numB = this.extraerNumeroFactura(b.numero_factura);
        return numA - numB;
      });
  });

  // Computed para total del día
  totalDelDia = computed(() => {
    return this.facturasFiltradas()
      .filter(f => f.estado === 'emitida')
      .reduce((total, f) => {
        // Las notas de crédito se restan del total
        const esNotaCredito = f.tipo_comprobante.includes('NC') || f.tipo_comprobante.includes('NOTA DE CREDITO');
        return total + (esNotaCredito ? -f.monto : f.monto);
      }, 0);
  });

  async cargarFacturasIniciales() {
    this.cargando.set(true);
    
    try {
      // Cargar facturas
      const { data: facturas, error: errorFacturas } = await supabase
        .from('facturas')
        .select('*')
        .order('created_at', { ascending: false });

      if (errorFacturas) {
        console.error('Error al cargar facturas:', errorFacturas);
        return;
      }

      // Cargar notas de crédito
      const { data: notasCredito, error: errorNotas } = await supabase
        .from('notas_credito')
        .select('*')
        .order('created_at', { ascending: false });

      if (errorNotas) {
        console.error('Error al cargar notas de crédito:', errorNotas);
        return;
      }

      // Convertir facturas al formato esperado
      const facturasFormateadas: Factura[] = (facturas || []).map(f => ({
        id: f.id,
        numero_factura: f.numero_factura,
        fecha: f.fecha,
        monto: Number(f.monto),
        estado: f.estado as 'emitida' | 'anulada',
        cae: f.cae || undefined,
        tipo_comprobante: f.tipo_comprobante,
        pdf_url: f.pdf_url || undefined,
        concepto: f.concepto,
        punto_venta: f.punto_venta,
        created_at: f.created_at,
        updated_at: f.updated_at
      }));

      // Convertir notas de crédito al formato esperado
      const notasCreditoFormateadas: Factura[] = (notasCredito || []).map(nc => ({
        id: nc.id,
        numero_factura: nc.numero_nota,
        fecha: nc.fecha,
        monto: Number(nc.monto),
        estado: 'emitida' as 'emitida' | 'anulada', // Las NC siempre están emitidas
        cae: nc.cae || undefined,
        tipo_comprobante: nc.tipo_comprobante || 'NOTA DE CREDITO B', // Usar tipo real de la DB
        pdf_url: nc.pdf_url || undefined,
        concepto: 'Nota de Crédito',
        punto_venta: 4, // Valor por defecto
        created_at: nc.created_at,
        updated_at: nc.updated_at
      }));

      // Combinar facturas y notas de crédito
      const todosLosComprobantes = [...facturasFormateadas, ...notasCreditoFormateadas];
      this.facturas.set(todosLosComprobantes);

    } catch (error) {
      console.error('Error inesperado al cargar facturas:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFecha(event: Event) {
    const target = event.target as HTMLInputElement;
    this.fechaSeleccionada.set(target.value);
    // No necesitamos recargar facturas, el computed se actualiza automáticamente
  }

  // Métodos helper para el template
  extraerNumeroFactura(numeroCompleto: string): number {
    // Extraer el número final de formatos como "00004-00000005" 
    if (numeroCompleto.includes('-')) {
      const partes = numeroCompleto.split('-');
      return parseInt(partes[partes.length - 1]);
    }
    return parseInt(numeroCompleto.replace(/^0+/, '') || '0');
  }

  esNotaCredito(factura: Factura): boolean {
    return factura.tipo_comprobante.includes('NOTA DE CREDITO');
  }

  obtenerMontoMostrar(factura: Factura): number {
    // Las notas de crédito se muestran en negativo
    return this.esNotaCredito(factura) ? -factura.monto : factura.monto;
  }

  obtenerTipoComprobante(factura: Factura): string {
    // Para notas de crédito, convertir "NOTA DE CREDITO B" a "NC B"
    if (factura.tipo_comprobante === 'NOTA DE CREDITO B') {
      return 'NC B';
    }
    if (factura.tipo_comprobante === 'NOTA DE CREDITO C') {
      return 'NC C';
    }
    
    // Para facturas, convertir "FACTURA B" a "FC B"
    if (factura.tipo_comprobante === 'FACTURA B') {
      return 'FC B';
    }
    if (factura.tipo_comprobante === 'FACTURA C') {
      return 'FC C';
    }
    
    // Fallback: mostrar el tipo original o FC B por defecto
    return factura.tipo_comprobante || 'FC B';
  }

  obtenerNumeroSinCeros(numero: string): string {
    if (numero.includes('-')) {
      return numero.split('-')[1];
    }
    return numero.replace(/^0+/, '') || '0';
  }

  obtenerClaseEstado(estado: string): string {
    if (estado === 'emitida') {
      return 'bg-green-100 text-green-700';
    } else {
      return 'bg-red-100 text-red-700';
    }
  }

  obtenerClaseFilaFactura(factura: Factura): string {
  const baseClass = 'px-2 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer';
    if (this.esNotaCredito(factura)) {
      return baseClass + ' bg-red-50 border-red-200 hover:bg-red-100';
    }
    return baseClass;
  }

  obtenerClaseMonto(factura: Factura): string {
    const baseClass = 'col-span-3 text-right font-semibold text-sm';
    if (this.esNotaCredito(factura)) {
      return baseClass + ' text-red-600';
    }
    return baseClass;
  }

  obtenerTextoEstado(estado: string): string {
    return estado === 'emitida' ? 'Emitida' : 'Anulada';
  }
}
