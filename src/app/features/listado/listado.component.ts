// Utilidad para obtener la fecha local en formato YYYY-MM-DD
function getFechaLocalArgentina(): string {
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}
import { Component, signal, computed, inject, effect } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CurrencyPipe } from '@angular/common';
import { supabase } from '../../core/services/supabase.service';
import { PdfService } from '../../core/services/pdf.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';

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
  cliente_cuit?: string;
  cliente_nombre?: string;
  cliente_domicilio?: string;
  cliente_condicion_iva?: string;
  cliente_doc_tipo?: number;
  cliente_doc_nro?: number;
  created_at?: string;
  updated_at?: string;
  // Para notas de crédito: número del comprobante que anula
  factura_anulada?: string;
  comprobante_asociado_id?: string;
  nota_credito_anuladora?: string;
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
            <p class="text-muted-foreground">{{ mensajeEstadoVacio() }}</p>
            @if (ultimaFechaConFacturasDisponible()) {
              <p class="text-sm text-muted-foreground mt-2">
                Último día facturado:
                <span class="font-medium text-foreground">{{ formatearFechaParaVista(ultimaFechaConFacturas()!) }}</span>
              </p>
              <button
                type="button"
                (click)="irAUltimoDiaFacturado()"
                class="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                Ir al último día facturado
              </button>
            }
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
                      {{ obtenerTipoComprobanteVista(factura) }}
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
                          [disabled]="facturaEstaAnulada(factura)"
                          [class]="facturaEstaAnulada(factura) ? 
                            'bg-gray-400 text-gray-600 cursor-not-allowed font-medium py-2 px-3 rounded-lg text-sm flex items-center justify-center gap-2' :
                            'bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2'">
                          {{ facturaEstaAnulada(factura) ? 'Anulada' : 'Anular' }}
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
                      @if (factura.cliente_nombre) {
                        <div>Cliente: {{ factura.cliente_nombre }}</div>
                      }
                      @if (factura.cliente_cuit) {
                        <div>CUIT: {{ formatearCuitVista(factura.cliente_cuit) }}</div>
                      }
                      @if (factura.cliente_condicion_iva) {
                        <div>CondiciÃ³n IVA: {{ factura.cliente_condicion_iva }}</div>
                      }
                      @if (factura.cliente_domicilio) {
                        <div>Domicilio: {{ factura.cliente_domicilio }}</div>
                      }
                      @if (esNotaCredito(factura) && factura.factura_anulada) {
                        <div class="font-medium text-orange-600">Anula factura: {{ obtenerNumeroSinCeros(factura.factura_anulada) }}</div>
                      }
                      @if (!esNotaCredito(factura) && factura.estado === 'anulada') {
                        <div class="font-medium text-red-600">Anulada por nota de crédito: {{ obtenerNotaCreditoQueAnula(factura) || 'N/A' }}</div>
                      }
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

    <!-- Card de Nota de Crédito Emitida -->
    @if (notaCreditoEmitida()) {
      <div class="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" 
           (click)="cerrarNotaCredito()">
        <div class="bg-card rounded-lg max-w-md w-full shadow-2xl"
             (click)="$event.stopPropagation()">
          <div class="p-6">
            <!-- Encabezado -->
            <div class="text-center mb-6">
              <div class="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-3">
                <svg class="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-foreground mb-2">Nota de Crédito emitida:</h3>
              <div class="text-xl font-bold text-primary">
                NC {{ notaCreditoEmitida()?.numero }} - {{ notaCreditoEmitida()?.monto | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
              </div>
              <p class="text-sm text-muted-foreground mt-1">
                Anula factura {{ notaCreditoEmitida()?.facturaOriginal }}
              </p>
              @if (notaCreditoEmitida()?.cae) {
                <p class="text-xs text-muted-foreground mt-1">
                  CAE: {{ notaCreditoEmitida()?.cae }}
                </p>
              }
            </div>

            <!-- Botones de acción -->
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button 
                (click)="verPDFNotaCredito()" 
                class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">
                Ver PDF
              </button>
              <button 
                (click)="compartirNotaCredito()" 
                class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">
                Compartir
              </button>
              <button 
                (click)="descargarNotaCredito()" 
                class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">
                Descargar
              </button>
              <button 
                (click)="imprimirNotaCredito()" 
                class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">
                Imprimir
              </button>
            </div>

            <!-- Botón Cerrar -->
            <button 
              (click)="cerrarNotaCredito()" 
              class="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium py-2 px-3 rounded-lg transition-colors text-sm">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    }

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
  private readonly pdfService = inject(PdfService);
  private readonly facturacionService = inject(FacturacionService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly contribuyenteService = inject(ContribuyenteService);

  // Signals para estado
  fechaSeleccionada = signal(getFechaLocalArgentina()); // Fecha actual por defecto
  facturas = signal<Factura[]>([]);
  cargando = signal(false);
  facturaExpandida = signal<string | null>(null); // ID de factura expandida
  notaCreditoEmitida = signal<any>(null); // Nota de crédito recién emitida
  ultimaFechaConFacturas = signal<string | null>(null);

  // Cache de facturas por fecha para evitar consultas repetidas
  private cacheFacturasPorFecha = new Map<string, Factura[]>();
  private cacheUltimaFechaConFacturas = new Map<string, string | null>();

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

  constructor() {
    // Cargar facturas iniciales
    this.cargarFacturasIniciales();

    // Recargar cuando cambia el contribuyente
    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        this.limpiarTodoElCache();
        this.cargarFacturasPorFecha(this.fechaSeleccionada());
      }
    });
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
    
    try {
      const asset = await this.pdfService.createPdfAsset(factura);

      this.pdfViewing.set(factura);
      this.pdfViewingInfo.set({
        title: asset.info.title,
        url: asset.blobUrl,
        filename: asset.info.filename
      });

      const oldBlobUrl = this.pdfViewingBlobUrl();
      this.pdfService.revokeBlobUrl(oldBlobUrl);
      this.pdfViewingBlobUrl.set(asset.blobUrl);
    } catch (error) {
      console.error('❌ Error al cargar PDF en modal:', error);
      this.cerrarVisorPdf();
      alert('Hubo un error al generar el ticket.');
    }
  }

  async compartir(factura: any, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    try {
      const pdfInfo = this.pdfService.createPdfInfo(factura);
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
    
    try {
      const pdfInfo = this.pdfService.createPdfInfo(factura);
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
    
    try {
      await this.pdfService.printFactura(factura);
    } catch (error) {
      console.error('Error al imprimir:', error);
      alert('Hubo un error enviando a imprimir');
    }
  }

  // Métodos específicos para acciones de nota de crédito
  async verPDFNotaCredito() {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      // Crear un objeto temporal para usar con el visor existente
      const notaCreditoTemporal = {
        numero_comprobante: notaCredito.numero,
        tipo_comprobante: notaCredito.tipo_comprobante || 'NOTA DE CREDITO',
        monto: notaCredito.monto,
        total: notaCredito.monto,
        fecha: new Date().toISOString().split('T')[0],
        cae: notaCredito.cae,
        vencimiento_cae: notaCredito.vencimiento_cae
      };

      await this.verPDF(notaCreditoTemporal);
    } catch (error) {
      console.error('Error al ver PDF de nota de crédito:', error);
    }
  }

  async compartirNotaCredito() {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      const notaCreditoTemporal = {
        numero_comprobante: notaCredito.numero,
        tipo_comprobante: notaCredito.tipo_comprobante || 'NOTA DE CREDITO',
        monto: notaCredito.monto,
        total: notaCredito.monto,
        fecha: new Date().toISOString().split('T')[0],
        cae: notaCredito.cae,
        vencimiento_cae: notaCredito.vencimiento_cae
      };
      const pdfInfo = this.pdfService.createPdfInfo(notaCreditoTemporal);
      await this.pdfService.sharePdf(pdfInfo);
    } catch (error) {
      console.error('Error al compartir nota de crédito:', error);
    }
  }

  async descargarNotaCredito() {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      const notaCreditoTemporal = {
        numero_comprobante: notaCredito.numero,
        tipo_comprobante: notaCredito.tipo_comprobante || 'NOTA DE CREDITO',
        monto: notaCredito.monto,
        total: notaCredito.monto,
        fecha: new Date().toISOString().split('T')[0],
        cae: notaCredito.cae,
        vencimiento_cae: notaCredito.vencimiento_cae
      };
      const pdfInfo = this.pdfService.createPdfInfo(notaCreditoTemporal);
      await this.pdfService.downloadPdf(pdfInfo);
    } catch (error) {
      console.error('Error al descargar nota de crédito:', error);
    }
  }

  async imprimirNotaCredito() {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      const notaCreditoTemporal = {
        numero_comprobante: notaCredito.numero,
        tipo_comprobante: notaCredito.tipo_comprobante || 'NOTA DE CREDITO',
        monto: notaCredito.monto,
        total: notaCredito.monto,
        fecha: new Date().toISOString().split('T')[0],
        cae: notaCredito.cae,
        vencimiento_cae: notaCredito.vencimiento_cae
      };
      
      await this.pdfService.printFactura(notaCreditoTemporal);
    } catch (error) {
      console.error('Error al imprimir nota de credito:', error);
      alert('Hubo un error al intentar imprimir la nota de credito');
    }
  }

  // Método para cerrar la card de nota de crédito
  cerrarNotaCredito() {
    this.notaCreditoEmitida.set(null);
  }

  // Computed para nombre de fecha formateado
  nombreFechaSeleccionada = computed(() => {
    const fecha = new Date(this.fechaSeleccionada() + 'T00:00:00');
    return `Facturas del ${format(fecha, 'dd/MM/yyyy', { locale: es })}`;
  });

  mensajeEstadoVacio = computed(() => {
    return this.ultimaFechaConFacturas()
      ? 'No hay facturas para esta fecha'
      : 'Todavía no hay facturas emitidas';
  });

  ultimaFechaConFacturasDisponible = computed(() => {
    const ultimaFecha = this.ultimaFechaConFacturas();
    return Boolean(ultimaFecha && ultimaFecha !== this.fechaSeleccionada());
  });

  // Computed para facturas filtradas por fecha (ahora solo ordena, ya que vienen filtradas)
  facturasFiltradas = computed(() => {
    // Los datos ya vienen filtrados por fecha desde la base de datos
    return this.facturas()
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
    // Cargar solo la fecha actual al inicio
    await this.cargarFacturasPorFecha(this.fechaSeleccionada());
  }

  async cargarFacturasPorFecha(fecha: string) {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) return;

    const cacheKey = `${contribuyente.id}:${fecha}`;
    if (this.cacheFacturasPorFecha.has(cacheKey)) {
      const facturasCacheadas = this.cacheFacturasPorFecha.get(cacheKey)!;
      this.facturas.set(facturasCacheadas);
      await this.actualizarUltimaFechaConFacturas(fecha, facturasCacheadas);
      return;
    }

    this.cargando.set(true);
    
    try {
      // Query unificada a tabla comprobantes
      const { data: comprobantes, error } = await supabase
        .from('comprobantes')
        .select(`
          *,
          comprobante_asociado:comprobante_asociado_id (
            numero_comprobante
          )
        `)
        .eq('contribuyente_id', contribuyente.id)
        .eq('fecha', fecha)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar comprobantes:', error);
        return;
      }

      const idsFacturasAnuladas = (comprobantes || [])
        .filter(
          c => c.estado === 'anulada' && !String(c.tipo_comprobante).includes('NOTA DE CREDITO')
        )
        .map(c => c.id);

      const mapaNotasCreditoPorAsociado = new Map<string, string>();

      if (idsFacturasAnuladas.length > 0) {
        const { data: notasCreditoAsociadas, error: notasError } = await supabase
          .from('comprobantes')
          .select('comprobante_asociado_id, numero_comprobante, created_at')
          .eq('contribuyente_id', contribuyente.id)
          .in('comprobante_asociado_id', idsFacturasAnuladas)
          .like('tipo_comprobante', 'NOTA DE CREDITO%')
          .order('created_at', { ascending: false });

        if (notasError) {
          console.error('Error al cargar notas de crédito asociadas:', notasError);
        } else {
          for (const nc of notasCreditoAsociadas || []) {
            if (!nc.comprobante_asociado_id || !nc.numero_comprobante) continue;
            if (!mapaNotasCreditoPorAsociado.has(nc.comprobante_asociado_id)) {
              mapaNotasCreditoPorAsociado.set(nc.comprobante_asociado_id, nc.numero_comprobante);
            }
          }
        }
      }

      // Convertir al formato esperado por el template
      const comprobantesFormateados: Factura[] = (comprobantes || []).map(c => {
        const esNC = c.tipo_comprobante.includes('NOTA DE CREDITO');
        return {
          id: c.id,
          numero_factura: c.numero_comprobante,
          fecha: c.fecha,
          monto: Number(c.total),
          estado: c.estado as 'emitida' | 'anulada',
          cae: c.cae || undefined,
          vencimiento_cae: c.vencimiento_cae || undefined,
          tipo_comprobante: c.tipo_comprobante,
          pdf_url: c.pdf_url || undefined,
          concepto: c.concepto,
          punto_venta: c.punto_venta,
          cliente_cuit: (c as any).cliente_cuit || undefined,
          cliente_nombre: (c as any).cliente_nombre || undefined,
          cliente_domicilio: (c as any).cliente_domicilio || undefined,
          cliente_condicion_iva: (c as any).cliente_condicion_iva || undefined,
          cliente_doc_tipo: (c as any).cliente_doc_tipo || undefined,
          cliente_doc_nro: (c as any).cliente_doc_nro || undefined,
          created_at: c.created_at,
          updated_at: c.updated_at,
          comprobante_asociado_id: c.comprobante_asociado_id || undefined,
          factura_anulada: esNC ? (c as any).comprobante_asociado?.numero_comprobante : undefined,
          nota_credito_anuladora: !esNC ? mapaNotasCreditoPorAsociado.get(c.id) : undefined
        };
      });
      
      this.cacheFacturasPorFecha.set(cacheKey, comprobantesFormateados);
      this.facturas.set(comprobantesFormateados);
      await this.actualizarUltimaFechaConFacturas(fecha, comprobantesFormateados);

    } catch (error) {
      console.error('Error inesperado al cargar comprobantes:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarFecha(event: Event) {
    const target = event.target as HTMLInputElement;
    const nuevaFecha = target.value;
    this.fechaSeleccionada.set(nuevaFecha);
    
    // Cargar facturas de la nueva fecha si no están en caché
    await this.cargarFacturasPorFecha(nuevaFecha);
  }

  async irAUltimoDiaFacturado() {
    const ultimaFecha = this.ultimaFechaConFacturas();
    if (!ultimaFecha || ultimaFecha === this.fechaSeleccionada()) return;

    this.fechaSeleccionada.set(ultimaFecha);
    await this.cargarFacturasPorFecha(ultimaFecha);
  }

  formatearFechaParaVista(fecha: string): string {
    return format(new Date(`${fecha}T00:00:00`), 'dd/MM/yyyy', { locale: es });
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

  facturaEstaAnulada(factura: Factura): boolean {
    return factura.estado === 'anulada';
  }

  // Computed para crear un mapa de facturas anuladas y sus notas de crédito (solo para el día actual)
  mapaFacturasAnuladas = computed(() => {
    const mapa = new Map<string, string>();
    
    // Buscar solo en las facturas del día actual (conjunto pequeño)
    this.facturas().forEach(f => {
      if (this.esNotaCredito(f) && f.factura_anulada) {
        mapa.set(f.factura_anulada, this.obtenerNumeroSinCeros(f.numero_factura));
      }
    });
    
    return mapa;
  });

  // Método optimizado para obtener qué nota de crédito anula una factura (O(1))
  obtenerNotaCreditoQueAnula(factura: Factura): string | null {
    // Solo para facturas anuladas
    if (factura.estado !== 'anulada') return null;

    if (factura.nota_credito_anuladora) {
      return this.obtenerNumeroSinCeros(factura.nota_credito_anuladora);
    }

    // Fallback cuando la NC está cargada en la fecha visible
    return this.mapaFacturasAnuladas().get(factura.numero_factura) || null;
  }

  // Método para limpiar caché de una fecha específica (útil después de anular facturas)
  limpiarCacheFecha(fecha: string) {
    // Las keys son "{contribuyente_id}:{fecha}", buscar por suffix
    for (const key of this.cacheFacturasPorFecha.keys()) {
      if (key.endsWith(`:${fecha}`)) {
        this.cacheFacturasPorFecha.delete(key);
      }
    }
  }

  // Método para limpiar todo el caché (útil para debugging o después de cambios masivos)
  limpiarTodoElCache() {
    this.cacheFacturasPorFecha.clear();
    this.cacheUltimaFechaConFacturas.clear();
    this.ultimaFechaConFacturas.set(null);
  }

  private async actualizarUltimaFechaConFacturas(fecha: string, comprobantes: Factura[]) {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      this.ultimaFechaConFacturas.set(null);
      return;
    }

    if (comprobantes.length > 0) {
      this.cacheUltimaFechaConFacturas.set(contribuyente.id, fecha);
      this.ultimaFechaConFacturas.set(fecha);
      return;
    }

    const cacheKey = contribuyente.id;
    if (this.cacheUltimaFechaConFacturas.has(cacheKey)) {
      this.ultimaFechaConFacturas.set(this.cacheUltimaFechaConFacturas.get(cacheKey) ?? null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('comprobantes')
        .select('fecha')
        .eq('contribuyente_id', contribuyente.id)
        .order('fecha', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error al buscar última fecha con facturas:', error);
        this.ultimaFechaConFacturas.set(null);
        return;
      }

      const ultimaFecha = data?.[0]?.fecha ?? null;
      this.cacheUltimaFechaConFacturas.set(cacheKey, ultimaFecha);
      this.ultimaFechaConFacturas.set(ultimaFecha);
    } catch (error) {
      console.error('Error inesperado al buscar última fecha con facturas:', error);
      this.ultimaFechaConFacturas.set(null);
    }
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

  obtenerTipoComprobanteVista(factura: Factura): string {
    if (factura.tipo_comprobante === 'NOTA DE CREDITO A') return 'NC A';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO B') return 'NC B';
    if (factura.tipo_comprobante === 'NOTA DE CREDITO C') return 'NC C';
    if (factura.tipo_comprobante === 'FACTURA A') return 'FC A';
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    return factura.tipo_comprobante || 'FC B';
  }

  formatearCuitVista(cuit?: string): string {
    if (!cuit || cuit.length !== 11) return cuit || '';
    return `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10)}`;
  }

  async anularFactura(factura: Factura, event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Verificar si la factura ya está anulada
    if (this.facturaEstaAnulada(factura)) {
      alert('Esta factura ya está anulada y no puede ser anulada nuevamente.');
      return;
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
        // Guardar la nota de crédito emitida para mostrar la card
        this.notaCreditoEmitida.set({
          numero: resultado.data?.numero,
          cae: resultado.data?.cae,
          cae_vto: resultado.data?.vencimiento_cae,
          pdf_url: resultado.data?.pdf_url,
          monto: factura.monto,
          facturaOriginal: factura.numero_factura,
          notaCredito: resultado.data?.comprobante
        });

        // Recargar facturas para mostrar la nueva nota de crédito
        // Limpiar caché de la fecha actual para forzar recarga
        this.limpiarCacheFecha(this.fechaSeleccionada());
        await this.cargarFacturasPorFecha(this.fechaSeleccionada());

        // Contraer la factura expandida
        this.facturaExpandida.set(null);

      } else {
        // Error - manejar según el tipo
        const errorMessage = resultado.error || 'Error desconocido';
        
        // Si es un error de mantenimiento, ofrecer reintentar
        if (resultado.shouldRetry) {
          const shouldRetry = confirm(
            `⚠️ ARCA está en mantenimiento\n\n` +
            `El sistema de facturación de ARCA/AFIP está temporalmente fuera de servicio.\n` +
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
          `⚠️ ARCA está en mantenimiento\n\n` +
          `El sistema de facturación de ARCA/AFIP está temporalmente fuera de servicio.\n` +
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
          `Las credenciales de ARCA parecen estar incorrectas.\n` +
          `Revisa los certificados en la configuración del servidor.\n\n` +
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

