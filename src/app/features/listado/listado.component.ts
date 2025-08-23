import { Component, signal, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CurrencyPipe } from '@angular/common';
import { supabase } from '../../core/services/supabase.service';
import { PdfService } from '../../core/services/pdf.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfViewerComponent, PdfViewerConfig } from '../../shared/components/ui/pdf-viewer.component';

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
  imports: [CurrencyPipe, PdfViewerComponent],
  template: `
    <!-- Simplified mobile-first design matching screenshot -->
    <div class="space-y-4 sm:space-y-6">
      <!-- Selector de fecha -->
      <div class="card-surface p-4">
        <label class="form-label mb-4">
          Seleccionar fecha
        </label>
        
        <div class="relative">
          <input
            type="date"
            [value]="fechaSeleccionada()"
            (change)="cambiarFecha($event)"
            class="form-input w-full py-2 px-3"
          />
        </div>
      </div>

      <!-- Lista de facturas -->
      <div class="card-surface p-4">
        <h3 class="form-label mb-4">
          {{ nombreFechaSeleccionada() }}
        </h3>

        @if (cargando()) {
          <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="text-muted-foreground mt-4">Cargando facturas...</p>
          </div>
        } @else if (facturasFiltradas().length === 0) {
          <div class="text-center py-8">
            <svg class="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <p class="text-muted-foreground">No hay facturas para esta fecha</p>
          </div>
        } @else {
          <div class="space-y-2">
            @for (factura of facturasFiltradas(); track factura.id) {
              <div class="border border-border rounded-lg overflow-hidden transition-all duration-200"
                   [class]="facturaExpandida() === factura.id ? 'shadow-md border-primary' : 'shadow-sm'">
                
                <!-- Tarjeta principal (clickeable) -->
                <div [class]="obtenerClaseFilaFactura(factura) + ' p-3 cursor-pointer hover:bg-muted'"
                     (click)="toggleExpansion(factura.id, $event)"
                     role="button"
                     tabindex="0">
                  <div class="flex items-center justify-between gap-3">
                    <!-- Tipo de comprobante -->
                    <div class="text-xs font-medium text-foreground min-w-0 flex-shrink-0 text-left">
                      {{ obtenerTipoComprobante(factura) }}
                    </div>
                    <!-- Número de factura -->
                    <div class="font-mono text-sm min-w-0 flex-shrink-0 text-right text-foreground">
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
                    <div class="ml-2 text-muted-foreground">
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
                  <div class="border-t border-border bg-muted p-4 animate-fadeIn">
                    
                    <!-- Fila superior: Anular - Descargar (solo icono) - Ver -->
                    @if (!esNotaCredito(factura) && factura.estado === 'emitida') {
                      <!-- Para facturas que se pueden anular: 3 botones -->
                      <div class="grid grid-cols-3 gap-2 mb-2">
                        <button
                          (click)="anularFactura(factura, $event)"
                          class="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                          Anular
                        </button>
                        <button
                          (click)="descargar(factura, $event)"
                          class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center">
                          Descargar
                        </button>
                        <button
                          (click)="verPDF(factura, $event)"
                          class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          Ver
                        </button>
                      </div>
                    } @else {
                      <!-- Para notas de crédito o facturas anuladas: solo Descargar y Ver -->
                      <div class="grid grid-cols-2 gap-2 mb-2">
                        <button
                          (click)="descargar(factura, $event)"
                          class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center">
                          Descargar
                        </button>
                        <button
                          (click)="verPDF(factura, $event)"
                          class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                          </svg>
                          Ver
                        </button>
                      </div>
                    }

                    <!-- Fila inferior: Compartir - Imprimir -->
                    <div class="grid grid-cols-2 gap-2 mb-3">
                      <button
                        (click)="compartir(factura, $event)"
                        class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"></path>
                        </svg>
                        Compartir
                      </button>
                      <button
                        (click)="imprimir(factura, $event)"
                        class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
                        </svg>
                        Imprimir
                      </button>
                    </div>
                    
                    <!-- Información adicional -->
                    <div class="text-xs text-muted-foreground space-y-1">
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

    <!-- Modal visor PDF -->
    @if (pdfViewing()) {
      <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
           (click)="cerrarVisorPdf()">
        <div class="bg-card rounded-lg w-full max-w-6xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
             (click)="$event.stopPropagation()">
          
          <!-- Visor PDF -->
          <div class="flex-1 overflow-hidden">
            @if (pdfViewerConfig()) {
              <app-pdf-viewer [config]="pdfViewerConfig()!" (closeRequested)="cerrarVisorPdf()"></app-pdf-viewer>
            } @else {
              <div class="flex items-center justify-center h-full">
                <div class="text-center">
                  <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p class="text-muted-foreground">Cargando PDF...</p>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
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

  // Signals para el visor PDF
  pdfViewing = signal<Factura | null>(null);
  pdfViewingInfo = signal<{title: string; url: string; filename: string} | null>(null);
  pdfViewingBlobUrl = signal<string | null>(null);

  // Config para el PDF viewer
  pdfViewerConfig = computed((): PdfViewerConfig | null => {
    const blobUrl = this.pdfViewingBlobUrl();
    const info = this.pdfViewingInfo();
    
    if (!blobUrl || !info) return null;
    
    return {
      url: blobUrl,
      title: info.title,
      filename: info.filename
    };
  });

  constructor(
    private pdfService: PdfService,
    private facturacionService: FacturacionService,
    private sanitizer: DomSanitizer
  ) {
  // Cargar facturas iniciales
  this.cargarFacturasIniciales();
  }

  // Función para alternar la expansión de una tarjeta
  toggleExpansion(facturaId: string, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.facturaExpandida() === facturaId) {
      this.facturaExpandida.set(null);
    } else {
      this.facturaExpandida.set(facturaId);
    }
  }

  // Método de prueba simple
  testClick(facturaId: string) {
  alert('Click funcionando para factura: ' + facturaId);
  }

  // Métodos de acción para PDF (adaptados de facturar-nuevo)
  async verPDF(factura: any, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible');
      return;
    }
    try {
      // Establecer la información básica del modal primero
      this.pdfViewing.set(factura);
      this.pdfViewingInfo.set({
        title: `${this.obtenerTipoComprobante(factura)} ${this.obtenerNumeroSinCeros(factura.numero_factura)}`,
        url: factura.pdf_url,
        filename: `${this.obtenerTipoComprobante(factura).toLowerCase().replace(' ', '-')}-${factura.numero_factura}.pdf`
      });
      // Limpiar blob URL anterior si existe
      const oldBlobUrl = this.pdfViewingBlobUrl();
      if (oldBlobUrl) {
        URL.revokeObjectURL(oldBlobUrl);
        this.pdfViewingBlobUrl.set(null);
      }
      // Descargar PDF usando el método que funciona (igual que impresión)
      const pdfBlob = await this.downloadPdfBlob(factura.pdf_url);
      // Crear blob URL local
      const blobUrl = URL.createObjectURL(pdfBlob);
      this.pdfViewingBlobUrl.set(blobUrl);
    } catch (error) {
      console.error('❌ Error al cargar PDF en modal:', error);
      // Limpiar el modal en caso de error
      this.cerrarVisorPdf();
      // Fallback: abrir en nueva ventana
      window.open(factura.pdf_url, '_blank');
    }
  }

  // Helper method para descargar PDF usando el proxy (igual que en PDF service)
  private async downloadPdfBlob(pdfUrl: string): Promise<Blob> {
    // Obtener session token para autenticación
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No hay sesión activa');
    }

    // Usar pdf-proxy para evitar CORS
    const proxyUrl = `https://tejrdiwlgdzxsrqrqsbj.supabase.co/functions/v1/pdf-proxy?url=${encodeURIComponent(pdfUrl)}`;
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Error descargando PDF: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();
    // Asegurar que el tipo MIME sea correcto
    if (blob.type !== 'application/pdf') {
      return new Blob([blob], { type: 'application/pdf' });
    }
    return blob;
  }

  async compartir(factura: any, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
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

  async descargar(factura: any, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
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

  async imprimir(factura: any, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    if (!factura.pdf_url) {
      console.error('No hay URL de PDF disponible para imprimir');
      return;
    }

    try {
      // Último recurso: abrir en nueva ventana
      window.open(factura.pdf_url, '_blank');
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
        // Ordenar por created_at descendente (más recientes primero)
        if (a.created_at && b.created_at) {
          const fechaA = new Date(a.created_at).getTime();
          const fechaB = new Date(b.created_at).getTime();
          return fechaB - fechaA;
        }
        
        // Fallback: ordenar por número de factura descendente
        const numA = this.extraerNumeroFactura(a.numero_factura);
        const numB = this.extraerNumeroFactura(b.numero_factura);
        return numB - numA;
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

  // Computed para la URL segura del PDF en el visor
  pdfViewingUrl = computed((): SafeResourceUrl | null => {
    const blobUrl = this.pdfViewingBlobUrl();
    if (!blobUrl) return null;
    
    // Sanitizar la blob URL para que Angular la acepte en el iframe
    return this.sanitizer.bypassSecurityTrustResourceUrl(blobUrl);
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

      // Combinar facturas y notas de crédito y mantener orden por fecha de creación
      const todosLosComprobantes = [...facturasFormateadas, ...notasCreditoFormateadas]
        .sort((a, b) => {
          // Ordenar por created_at descendente (más recientes primero)
          const fechaA = new Date(a.created_at || '').getTime();
          const fechaB = new Date(b.created_at || '').getTime();
          return fechaB - fechaA;
        });
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
    if (this.esNotaCredito(factura)) {
      return 'card-nota-credito';
    }
    return 'card-factura';
  }

  obtenerClaseMonto(factura: Factura): string {
    const baseClass = 'col-span-3 text-right font-semibold text-sm';
    if (this.esNotaCredito(factura)) {
      return baseClass + ' monto-negativo';
    }
    return baseClass + ' text-foreground';
  }

  obtenerTextoEstado(estado: string): string {
    return estado === 'emitida' ? 'Emitida' : 'Anulada';
  }

  async anularFactura(factura: Factura, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Confirmar anulación
    const confirmar = confirm(
      `¿Está seguro que desea anular la factura ${factura.numero_factura} por ${factura.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}?\n\n` +
      'Esto generará una Nota de Crédito automáticamente.'
    );

    if (!confirmar) {
      return;
    }

    try {
      // Mostrar loading
      this.cargando.set(true);
      // Crear nota de crédito
      const resultado = await this.facturacionService.crearNotaCredito(
        factura.id,
        factura.numero_factura,
        factura.monto
      );
      // Manejar el resultado
      if (resultado.success) {
        // Mostrar mensaje de éxito
        alert(
          `✅ Factura anulada exitosamente!\n\n` +
          `Nota de Crédito: ${resultado.data?.numero}\n` +
          `CAE: ${resultado.data?.cae || 'Pendiente'}\n` +
          `PDF generado: ${resultado.data?.pdf_url ? 'Sí' : 'No'}`
        );

        // Recargar facturas para mostrar la nueva nota de crédito
        await this.cargarFacturasIniciales();

        // Contraer la factura expandida
        this.facturaExpandida.set(null);

      } else {
        // Error - manejar según el tipo
        const errorMessage = resultado.error || 'Error desconocido';
        
        // Si es un error de mantenimiento, ofrecer reintentar
        if (resultado.shouldRetry) {
          const shouldRetry = confirm(
            `⚠️ TusFacturas está en mantenimiento\n\n` +
            `El sistema de facturación de AFIP está temporalmente fuera de servicio.\n` +
            `${errorMessage}\n\n` +
            `¿Quieres intentar nuevamente en unos segundos?`
          );
          
          if (shouldRetry) {
            // Esperar 3 segundos y reintentar
            setTimeout(() => {
              this.anularFactura(factura, event);
            }, 3000);
            return;
          }
        }
        
        throw new Error(errorMessage);
      }

    } catch (error) {
      console.error('Error al anular factura:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      // Manejo específico para diferentes tipos de errores
      if (errorMessage.includes('mantenimiento')) {
        alert(
          `⚠️ TusFacturas está en mantenimiento\n\n` +
          `El sistema de facturación de AFIP está temporalmente fuera de servicio.\n` +
          `Por favor, intenta nuevamente en unos minutos.\n\n` +
          `Error: ${errorMessage}`
        );
      } else if (errorMessage.includes('red') || errorMessage.includes('network') || errorMessage.includes('fetch')) {
        alert(
          `🌐 Error de conexión\n\n` +
          `No se pudo conectar con el servidor de facturación.\n` +
          `Verifica tu conexión a internet e intenta nuevamente.\n\n` +
          `Error: ${errorMessage}`
        );
      } else if (errorMessage.includes('autenticación') || errorMessage.includes('credentials') || errorMessage.includes('token')) {
        alert(
          `🔐 Error de autenticación\n\n` +
          `Las credenciales de TusFacturas parecen estar incorrectas.\n` +
          `Revisa la configuración en el panel de administración.\n\n` +
          `Error: ${errorMessage}`
        );
      } else {
        alert(
          `❌ Error al anular la factura\n\n` +
          `${errorMessage}\n\n` +
          `Si el problema persiste, contacta al soporte técnico.`
        );
      }
    } finally {
      this.cargando.set(false);
    }
  }

  // Métodos del visor PDF modal
  cerrarVisorPdf() {
    // Limpiar blob URL para liberar memoria
    const blobUrl = this.pdfViewingBlobUrl();
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    
    // Limpiar signals
    this.pdfViewing.set(null);
    this.pdfViewingInfo.set(null);
    this.pdfViewingBlobUrl.set(null);
  }
}
