import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { Comprobante } from '../../core/types/database.types';
import { PdfComprobanteData } from '../../core/types/pdf.types';
import {
  getFriendlyNetworkErrorMessage,
  isLikelyNetworkErrorMessage,
} from '../../core/utils/network-error.util';
import {
  ComprobanteResultadoAction,
  ComprobanteResultadoActionId,
  ComprobanteResultadoPanelComponent,
} from '../../shared/components/ui/comprobante-resultado-panel.component';
import { PdfViewerComponent, PdfViewerConfig } from '../../shared/components/ui/pdf-viewer.component';

function getFechaLocalArgentina(): string {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

interface Factura {
  id: string;
  numero_factura: string;
  fecha: string;
  monto: number;
  estado: 'emitida' | 'anulada';
  cae?: string;
  vencimiento_cae?: string;
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
  factura_anulada?: string;
  comprobante_asociado_id?: string;
  nota_credito_anuladora?: string;
}

interface NotaCreditoEmitida {
  numero?: string;
  cae?: string;
  vencimiento_cae?: string;
  pdf_url?: string;
  monto: number;
  facturaOriginal: string;
  tipo_comprobante?: string;
  notaCredito?: Comprobante;
}

interface PdfFacturaLike {
  numero_comprobante: string;
  tipo_comprobante: string;
  monto?: number;
  total?: number;
  fecha: string;
  cae?: string | null;
  vencimiento_cae?: string | null;
}

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CurrencyPipe, PdfViewerComponent, ComprobanteResultadoPanelComponent],
  template: `
    <div class="space-y-4 sm:space-y-6">
      <div class="card-surface p-4">
        <label class="form-label mb-4">Seleccionar fecha</label>

        <div class="relative">
          <input
            type="date"
            [value]="fechaSeleccionada()"
            (change)="cambiarFecha($event)"
            class="form-input w-full py-2 px-3"
          />
        </div>
      </div>

      <div class="card-surface p-4">
        <h3 class="form-label mb-4">{{ nombreFechaSeleccionada() }}</h3>

        @if (mensajeCarga()) {
          <div class="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {{ mensajeCarga() }}
          </div>
        }

        @if (mensajeAccion()) {
          <div
            class="mb-4 rounded-lg px-4 py-3 text-sm"
            [class]="mensajeAccionTipo() === 'success'
              ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
              : 'border border-destructive/25 bg-destructive/10 text-destructive'"
          >
            {{ mensajeAccion() }}
          </div>
        }

        @if (notaCreditoEmitida()) {
          <app-comprobante-resultado-panel
            eyebrow="Nota de crédito emitida"
            [title]="notaCreditoPanelTitle()"
            [subtitle]="notaCreditoPanelSubtitle()"
            [meta]="notaCreditoPanelMeta()"
            [actions]="accionesComprobante"
            [actionsOpen]="notaCreditoAccionesAbiertas()"
            closeLabel="Cerrar"
            (toggleActions)="toggleNotaCreditoAcciones()"
            (actionSelected)="onNotaCreditoAction($event)"
            (closeRequested)="cerrarNotaCredito()"
          />
        }

        @if (cargando()) {
          <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p class="text-muted-foreground mt-4">Cargando facturas...</p>
          </div>
        } @else if (facturasFiltradas().length === 0) {
          <div class="text-center py-8">
            <svg
              class="w-12 h-12 text-muted-foreground mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <p class="text-muted-foreground">{{ mensajeEstadoVacio() }}</p>
            @if (ultimaFechaConFacturasDisponible()) {
              <p class="text-sm text-muted-foreground mt-2">
                Último día facturado:
                <span class="font-medium text-foreground">
                  {{ formatearFechaParaVista(ultimaFechaConFacturas()!) }}
                </span>
              </p>
              <button
                type="button"
                (click)="irAUltimoDiaFacturado()"
                class="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Ir al último día facturado
              </button>
            }
          </div>
        } @else {
          <div class="space-y-2">
            @for (factura of facturasFiltradas(); track factura.id) {
              <div
                class="border border-border rounded-lg overflow-hidden transition-all duration-200"
                [class]="facturaExpandida() === factura.id ? 'shadow-md border-primary' : 'shadow-sm'"
              >
                <div
                  [class]="obtenerClaseFilaFactura(factura) + ' p-3 cursor-pointer hover:bg-muted'"
                  (click)="toggleExpansion(factura.id, $event)"
                  role="button"
                  tabindex="0"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="text-xs font-medium text-foreground min-w-0 flex-shrink-0 text-left">
                      {{ obtenerTipoComprobanteVista(factura) }}
                    </div>
                    <div class="font-mono text-sm min-w-0 flex-shrink-0 text-right text-foreground">
                      {{ obtenerNumeroSinCeros(factura.numero_factura) }}
                    </div>
                    <div class="min-w-0 flex-shrink-0 text-center">
                      <span
                        class="px-2 py-1 rounded text-xs font-medium"
                        [class]="obtenerClaseEstado(factura.estado)"
                      >
                        {{ obtenerTextoEstado(factura.estado) }}
                      </span>
                    </div>
                    <div
                      class="text-right font-semibold text-sm min-w-0"
                      [class]="obtenerClaseMonto(factura).replace('col-span-3', '')"
                    >
                      {{ obtenerMontoMostrar(factura) | currency:'ARS':'symbol':'1.2-2':'es-AR' }}
                    </div>
                    <div class="ml-2 text-muted-foreground">
                      <svg
                        class="w-4 h-4 transition-transform duration-200"
                        [class]="facturaExpandida() === factura.id ? 'rotate-180' : ''"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>
                    </div>
                  </div>
                </div>

                @if (facturaExpandida() === factura.id) {
                  <div class="border-t border-border bg-muted p-4 animate-fadeIn">
                    <div
                      class="receipt-card-actions mb-3"
                      [class.receipt-card-actions--with-danger]="puedeAnularFactura(factura)"
                    >
                      @if (puedeAnularFactura(factura)) {
                        <button
                          type="button"
                          (click)="anularFactura(factura, $event)"
                          [disabled]="esAnulandoFactura(factura.id)"
                          [class.btn-loading--active]="esAnulandoFactura(factura.id)"
                          [attr.aria-busy]="esAnulandoFactura(factura.id)"
                          class="receipt-danger-btn btn-loading"
                        >
                          <span class="btn-loading__content">
                            @if (esAnulandoFactura(factura.id)) {
                              <span class="btn-loading__spinner" aria-hidden="true"></span>
                              <span>Anulando...</span>
                            } @else {
                              <span>Anular</span>
                            }
                          </span>
                        </button>
                      }

                      <div class="receipt-card-actions__utility">
                        <button
                          type="button"
                          class="receipt-action-btn"
                          title="Ver comprobante"
                          aria-label="Ver comprobante"
                          (click)="verPDF(factura, $event)"
                        >
                          <span class="receipt-action-btn__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              ></path>
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              ></path>
                            </svg>
                          </span>
                          <span class="receipt-action-btn__label">Ver</span>
                        </button>

                        <button
                          type="button"
                          class="receipt-action-btn"
                          title="Compartir comprobante"
                          aria-label="Compartir comprobante"
                          (click)="compartir(factura, $event)"
                        >
                          <span class="receipt-action-btn__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                              ></path>
                            </svg>
                          </span>
                          <span class="receipt-action-btn__label">Compartir</span>
                        </button>

                        <button
                          type="button"
                          class="receipt-action-btn"
                          title="Descargar comprobante"
                          aria-label="Descargar comprobante"
                          (click)="descargar(factura, $event)"
                        >
                          <span class="receipt-action-btn__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 3v12m0 0 4-4m-4 4-4-4m-3 8h14"
                              ></path>
                            </svg>
                          </span>
                          <span class="receipt-action-btn__label">Descargar</span>
                        </button>

                        <button
                          type="button"
                          class="receipt-action-btn"
                          title="Imprimir comprobante"
                          aria-label="Imprimir comprobante"
                          (click)="imprimir(factura, $event)"
                        >
                          <span class="receipt-action-btn__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                              ></path>
                            </svg>
                          </span>
                          <span class="receipt-action-btn__label">Imprimir</span>
                        </button>
                      </div>
                    </div>

                    <div class="text-xs text-muted-foreground space-y-1">
                      @if (factura.cliente_nombre) {
                        <div>Cliente: {{ factura.cliente_nombre }}</div>
                      }
                      @if (factura.cliente_cuit) {
                        <div>CUIT: {{ formatearCuitVista(factura.cliente_cuit) }}</div>
                      }
                      @if (factura.cliente_condicion_iva) {
                        <div>Condición IVA: {{ factura.cliente_condicion_iva }}</div>
                      }
                      @if (factura.cliente_domicilio) {
                        <div>Domicilio: {{ factura.cliente_domicilio }}</div>
                      }
                      @if (esNotaCredito(factura) && factura.factura_anulada) {
                        <div class="font-medium text-orange-600">
                          Anula factura: {{ obtenerNumeroSinCeros(factura.factura_anulada) }}
                        </div>
                      }
                      @if (!esNotaCredito(factura) && factura.estado === 'anulada') {
                        <div class="font-medium text-red-600">
                          Anulada por nota de crédito:
                          {{ obtenerNotaCreditoQueAnula(factura) || 'N/A' }}
                        </div>
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

    @if (pdfViewing()) {
      <div
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        (click)="cerrarVisorPdf()"
      >
        <div
          class="bg-card rounded-lg w-full max-w-6xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
          (click)="$event.stopPropagation()"
        >
          <div class="flex-1 overflow-hidden">
            @if (pdfViewerConfig()) {
              <app-pdf-viewer
                [config]="pdfViewerConfig()!"
                (closeRequested)="cerrarVisorPdf()"
              ></app-pdf-viewer>
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
  styles: [
    `
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
    `,
  ],
})
export class ListadoComponent {
  private readonly comprobantesService = inject(ComprobantesService);
  private readonly pdfService = inject(PdfService);
  private readonly facturacionService = inject(FacturacionService);
  private readonly contribuyenteService = inject(ContribuyenteService);

  readonly accionesComprobante: ComprobanteResultadoAction[] = [
    { id: 'ver', label: 'Ver', title: 'Ver comprobante' },
    { id: 'compartir', label: 'Compartir', title: 'Compartir comprobante' },
    { id: 'descargar', label: 'Descargar', title: 'Descargar comprobante' },
    { id: 'imprimir', label: 'Imprimir', title: 'Imprimir comprobante' },
  ];

  fechaSeleccionada = signal(getFechaLocalArgentina());
  facturas = signal<Factura[]>([]);
  cargando = signal(false);
  facturaExpandida = signal<string | null>(null);
  anulandoFacturaId = signal<string | null>(null);
  notaCreditoEmitida = signal<NotaCreditoEmitida | null>(null);
  notaCreditoAccionesAbiertas = signal(false);
  ultimaFechaConFacturas = signal<string | null>(null);
  mensajeCarga = signal<string | null>(null);
  mensajeAccion = signal<string | null>(null);
  mensajeAccionTipo = signal<'success' | 'error'>('success');

  private cacheFacturasPorFecha = new Map<string, Factura[]>();
  private cacheUltimaFechaConFacturas = new Map<string, string | null>();
  private mensajeAccionTimer: ReturnType<typeof setTimeout> | null = null;

  pdfViewing = signal<Factura | PdfFacturaLike | null>(null);
  pdfViewingInfo = signal<{ title: string; url: string; filename: string } | null>(null);
  pdfViewingBlobUrl = signal<string | null>(null);

  readonly pdfViewerConfig = computed((): PdfViewerConfig | null => {
    const blobUrl = this.pdfViewingBlobUrl();
    const info = this.pdfViewingInfo();

    if (!blobUrl || !info) return null;

    return {
      url: blobUrl,
      title: info.title,
      filename: info.filename,
    };
  });

  readonly nombreFechaSeleccionada = computed(() => {
    const fecha = new Date(`${this.fechaSeleccionada()}T00:00:00`);
    return `Facturas del ${format(fecha, 'dd/MM/yyyy', { locale: es })}`;
  });

  readonly mensajeEstadoVacio = computed(() =>
    this.ultimaFechaConFacturas()
      ? 'No hay facturas para esta fecha'
      : 'Todavía no hay facturas emitidas',
  );

  readonly ultimaFechaConFacturasDisponible = computed(() => {
    const ultimaFecha = this.ultimaFechaConFacturas();
    return Boolean(ultimaFecha && ultimaFecha !== this.fechaSeleccionada());
  });

  readonly facturasFiltradas = computed(() =>
    this.facturas().sort((a, b) => {
      if (a.created_at && b.created_at) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      return this.extraerNumeroFactura(b.numero_factura) - this.extraerNumeroFactura(a.numero_factura);
    }),
  );

  readonly totalDelDia = computed(() =>
    this.facturasFiltradas()
      .filter((factura) => factura.estado === 'emitida')
      .reduce((total, factura) => {
        const esNotaCredito = this.esNotaCredito(factura);
        return total + (esNotaCredito ? -factura.monto : factura.monto);
      }, 0),
  );

  readonly mapaFacturasAnuladas = computed(() => {
    const mapa = new Map<string, string>();
    this.facturas().forEach((factura) => {
      if (this.esNotaCredito(factura) && factura.factura_anulada) {
        mapa.set(factura.factura_anulada, this.obtenerNumeroSinCeros(factura.numero_factura));
      }
    });
    return mapa;
  });

  readonly notaCreditoPanelTitle = computed(() => {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return '';
    return `NC ${notaCredito.numero || '0000'} - ${this.formatearMoneda(notaCredito.monto)}`;
  });

  readonly notaCreditoPanelSubtitle = computed(() => {
    const notaCredito = this.notaCreditoEmitida();
    return notaCredito ? `Anula factura ${notaCredito.facturaOriginal}` : '';
  });

  readonly notaCreditoPanelMeta = computed(() => {
    const notaCredito = this.notaCreditoEmitida();
    return notaCredito?.cae ? `CAE: ${notaCredito.cae}` : '';
  });

  constructor() {
    void this.cargarFacturasIniciales();

    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        this.limpiarTodoElCache();
        void this.cargarFacturasPorFecha(this.fechaSeleccionada());
      }
    });
  }

  toggleExpansion(facturaId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.facturaExpandida.set(this.facturaExpandida() === facturaId ? null : facturaId);
  }

  puedeAnularFactura(factura: Factura): boolean {
    return !this.esNotaCredito(factura) && factura.estado === 'emitida';
  }

  esAnulandoFactura(facturaId: string): boolean {
    return this.anulandoFacturaId() === facturaId;
  }

  toggleNotaCreditoAcciones(): void {
    this.notaCreditoAccionesAbiertas.update((value) => !value);
  }

  onNotaCreditoAction(action: ComprobanteResultadoActionId): void {
    if (action === 'ver') void this.verPDFNotaCredito();
    if (action === 'compartir') void this.compartirNotaCredito();
    if (action === 'descargar') void this.descargarNotaCredito();
    if (action === 'imprimir') void this.imprimirNotaCredito();
  }

  async verPDF(factura: Factura | PdfComprobanteData, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      const asset = await this.pdfService.createPdfAsset(this.toPdfComprobanteData(factura));
      this.pdfViewing.set(factura);
      this.pdfViewingInfo.set({
        title: asset.info.title,
        url: asset.blobUrl,
        filename: asset.info.filename,
      });
      this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
      this.pdfViewingBlobUrl.set(asset.blobUrl);
    } catch (error) {
      console.error('Error al cargar PDF en modal:', error);
      this.cerrarVisorPdf();
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'Hubo un error al generar el ticket.',
          'No se pudo generar el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  async compartir(factura: Factura | PdfComprobanteData, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      const pdfInfo = this.pdfService.createPdfInfo(this.toPdfComprobanteData(factura));
      await this.pdfService.sharePdf(pdfInfo);
    } catch (error) {
      console.error('Error al compartir:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudo compartir el ticket.',
          'No se pudo compartir el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  async descargar(factura: Factura | PdfComprobanteData, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      const pdfInfo = this.pdfService.createPdfInfo(this.toPdfComprobanteData(factura));
      await this.pdfService.downloadPdf(pdfInfo);
    } catch (error) {
      console.error('Error al descargar:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudo descargar el ticket.',
          'No se pudo descargar el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  async imprimir(factura: Factura | PdfComprobanteData, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    try {
      await this.pdfService.printFactura(this.toPdfComprobanteData(factura));
    } catch (error) {
      console.error('Error al imprimir:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'Hubo un error enviando a imprimir.',
          'No se pudo enviar a imprimir porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  private buildNotaCreditoPdfPayload(notaCredito: NotaCreditoEmitida): PdfComprobanteData {
    return {
      numero_comprobante: notaCredito.numero || '0000-00000000',
      tipo_comprobante: notaCredito.tipo_comprobante || 'NOTA DE CREDITO',
      total: notaCredito.monto,
      fecha: new Date().toISOString().split('T')[0],
      cae: notaCredito.cae ?? null,
      vencimiento_cae: notaCredito.vencimiento_cae ?? null,
    };
  }

  private toPdfComprobanteData(factura: Factura | PdfComprobanteData): PdfComprobanteData {
    if ('numero_comprobante' in factura) {
      return factura;
    }

    return {
      tipo_comprobante: factura.tipo_comprobante,
      numero_comprobante: factura.numero_factura,
      fecha: factura.fecha,
      total: factura.monto,
      cae: factura.cae ?? null,
      vencimiento_cae: factura.vencimiento_cae ?? null,
      cliente_cuit: factura.cliente_cuit ?? null,
      cliente_doc_tipo: factura.cliente_doc_tipo ?? null,
      cliente_doc_nro: factura.cliente_doc_nro ?? null,
      cliente_nombre: factura.cliente_nombre ?? null,
      cliente_domicilio: factura.cliente_domicilio ?? null,
      cliente_condicion_iva: factura.cliente_condicion_iva ?? null,
      punto_venta: factura.punto_venta ?? null,
      concepto: factura.concepto ?? null,
    };
  }

  async verPDFNotaCredito(): Promise<void> {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;
    await this.verPDF(this.buildNotaCreditoPdfPayload(notaCredito));
  }

  async compartirNotaCredito(): Promise<void> {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      const pdfInfo = this.pdfService.createPdfInfo(this.buildNotaCreditoPdfPayload(notaCredito));
      await this.pdfService.sharePdf(pdfInfo);
    } catch (error) {
      console.error('Error al compartir nota de crédito:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudo compartir la nota de crédito.',
          'No se pudo compartir la nota de crédito porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  async descargarNotaCredito(): Promise<void> {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      const pdfInfo = this.pdfService.createPdfInfo(this.buildNotaCreditoPdfPayload(notaCredito));
      await this.pdfService.downloadPdf(pdfInfo);
    } catch (error) {
      console.error('Error al descargar nota de crédito:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudo descargar la nota de crédito.',
          'No se pudo descargar la nota de crédito porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  async imprimirNotaCredito(): Promise<void> {
    const notaCredito = this.notaCreditoEmitida();
    if (!notaCredito) return;

    try {
      await this.pdfService.printFactura(this.buildNotaCreditoPdfPayload(notaCredito));
    } catch (error) {
      console.error('Error al imprimir nota de credito:', error);
      this.setMensajeAccion(
        getFriendlyNetworkErrorMessage(
          error,
          'Hubo un error al intentar imprimir la nota de credito.',
          'No se pudo imprimir la nota de credito porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
        'error',
      );
    }
  }

  cerrarNotaCredito(): void {
    this.notaCreditoEmitida.set(null);
    this.notaCreditoAccionesAbiertas.set(false);
  }

  async cargarFacturasIniciales(): Promise<void> {
    await this.cargarFacturasPorFecha(this.fechaSeleccionada());
  }

  async cargarFacturasPorFecha(
    fecha: string,
    options?: { silent?: boolean; force?: boolean },
  ): Promise<void> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) return;

    const silent = options?.silent ?? false;
    const force = options?.force ?? false;
    const cacheKey = `${contribuyente.id}:${fecha}`;

    if (!force && this.cacheFacturasPorFecha.has(cacheKey)) {
      const facturasCacheadas = this.cacheFacturasPorFecha.get(cacheKey)!;
      this.facturas.set(facturasCacheadas);
      this.mensajeCarga.set(null);
      await this.actualizarUltimaFechaConFacturas(fecha, facturasCacheadas);
      return;
    }

    if (!silent) {
      this.cargando.set(true);
    }
    this.mensajeCarga.set(null);

    try {
      const comprobantes = await this.comprobantesService.cargarComprobantesPorFecha(
        contribuyente.id,
        fecha,
      );
      this.cacheFacturasPorFecha.set(cacheKey, comprobantes);
      this.facturas.set(comprobantes);
      await this.actualizarUltimaFechaConFacturas(fecha, comprobantes);
    } catch (error) {
      console.error('Error inesperado al cargar comprobantes:', error);
      this.facturas.set([]);
      this.mensajeCarga.set(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudieron cargar los comprobantes para esa fecha.',
          'No se pudieron cargar los comprobantes porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      );
    } finally {
      if (!silent) {
        this.cargando.set(false);
      }
    }
  }

  async cambiarFecha(event: Event): Promise<void> {
    const nuevaFecha = (event.target as HTMLInputElement).value;
    this.fechaSeleccionada.set(nuevaFecha);
    await this.cargarFacturasPorFecha(nuevaFecha);
  }

  async irAUltimoDiaFacturado(): Promise<void> {
    const ultimaFecha = this.ultimaFechaConFacturas();
    if (!ultimaFecha || ultimaFecha === this.fechaSeleccionada()) return;

    this.fechaSeleccionada.set(ultimaFecha);
    await this.cargarFacturasPorFecha(ultimaFecha);
  }

  formatearFechaParaVista(fecha: string): string {
    return format(new Date(`${fecha}T00:00:00`), 'dd/MM/yyyy', { locale: es });
  }

  extraerNumeroFactura(numeroCompleto: string): number {
    if (numeroCompleto.includes('-')) {
      const partes = numeroCompleto.split('-');
      return parseInt(partes[partes.length - 1], 10);
    }

    return parseInt(numeroCompleto.replace(/^0+/, '') || '0', 10);
  }

  esNotaCredito(factura: Factura): boolean {
    return factura.tipo_comprobante.includes('NOTA DE CREDITO');
  }

  facturaEstaAnulada(factura: Factura): boolean {
    return factura.estado === 'anulada';
  }

  obtenerNotaCreditoQueAnula(factura: Factura): string | null {
    if (factura.estado !== 'anulada') return null;

    if (factura.nota_credito_anuladora) {
      return this.obtenerNumeroSinCeros(factura.nota_credito_anuladora);
    }

    return this.mapaFacturasAnuladas().get(factura.numero_factura) || null;
  }

  limpiarCacheFecha(fecha: string): void {
    for (const key of this.cacheFacturasPorFecha.keys()) {
      if (key.endsWith(`:${fecha}`)) {
        this.cacheFacturasPorFecha.delete(key);
      }
    }
  }

  limpiarTodoElCache(): void {
    this.cacheFacturasPorFecha.clear();
    this.cacheUltimaFechaConFacturas.clear();
    this.ultimaFechaConFacturas.set(null);
  }

  private async actualizarUltimaFechaConFacturas(
    fecha: string,
    comprobantes: Factura[],
  ): Promise<void> {
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
      const ultimaFecha = await this.comprobantesService.cargarUltimaFechaConComprobantes(
        contribuyente.id,
      );
      this.cacheUltimaFechaConFacturas.set(cacheKey, ultimaFecha);
      this.ultimaFechaConFacturas.set(ultimaFecha);
    } catch (error) {
      console.error('Error inesperado al buscar última fecha con facturas:', error);
      this.ultimaFechaConFacturas.set(null);
    }
  }

  private setMensajeAccion(message: string, tipo: 'success' | 'error'): void {
    if (this.mensajeAccionTimer !== null) {
      clearTimeout(this.mensajeAccionTimer);
    }

    this.mensajeAccion.set(message);
    this.mensajeAccionTipo.set(tipo);
    this.mensajeAccionTimer = setTimeout(() => {
      this.mensajeAccion.set(null);
      this.mensajeAccionTimer = null;
    }, 5000);
  }

  obtenerMontoMostrar(factura: Factura): number {
    return this.esNotaCredito(factura) ? -factura.monto : factura.monto;
  }

  obtenerNumeroSinCeros(numero: string): string {
    if (numero.includes('-')) {
      return numero.split('-')[1];
    }

    return numero.replace(/^0+/, '') || '0';
  }

  obtenerClaseEstado(estado: string): string {
    return estado === 'emitida' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  }

  obtenerClaseFilaFactura(factura: Factura): string {
    return this.esNotaCredito(factura) ? 'card-nota-credito' : 'card-factura';
  }

  obtenerClaseMonto(factura: Factura): string {
    const baseClass = 'col-span-3 text-right font-semibold text-sm';
    return this.esNotaCredito(factura) ? `${baseClass} monto-negativo` : `${baseClass} text-foreground`;
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

  formatearMoneda(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    }).format(monto);
  }

  async anularFactura(factura: Factura, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.facturaEstaAnulada(factura) || this.esAnulandoFactura(factura.id)) {
      return;
    }

    const confirmar = confirm(
      `¿Está seguro que desea anular la factura ${factura.numero_factura} por ${factura.monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}?\n\nEsto generará una Nota de Crédito automáticamente.`,
    );

    if (!confirmar) {
      return;
    }

    this.anulandoFacturaId.set(factura.id);

    try {
      const resultado = await this.facturacionService.crearNotaCredito(
        factura.id,
        factura.numero_factura,
        factura.monto,
      );

      if (resultado.success) {
        this.notaCreditoEmitida.set({
          numero: resultado.data?.numero,
          cae: resultado.data?.cae,
          vencimiento_cae: resultado.data?.vencimiento_cae,
          pdf_url: resultado.data?.pdf_url,
          monto: factura.monto,
          facturaOriginal: factura.numero_factura,
          tipo_comprobante: resultado.data?.comprobante.tipo_comprobante,
          notaCredito: resultado.data?.comprobante,
        });
        this.notaCreditoAccionesAbiertas.set(false);
        this.limpiarCacheFecha(this.fechaSeleccionada());
        await this.cargarFacturasPorFecha(this.fechaSeleccionada(), { silent: true, force: true });
        this.facturaExpandida.set(null);
        return;
      }

      const errorMessage = resultado.error || 'Error desconocido';

      if (resultado.shouldRetry) {
        const shouldRetry = confirm(
          `⚠️ ARCA está en mantenimiento\n\nEl sistema de facturación de ARCA/AFIP está temporalmente fuera de servicio.\n${errorMessage}\n\n¿Quieres intentar nuevamente en unos segundos?`,
        );

        if (shouldRetry) {
          setTimeout(() => {
            void this.anularFactura(factura);
          }, 3000);
          return;
        }
      }

      throw new Error(errorMessage);
    } catch (error) {
      console.error('Error al anular factura:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';

      if (errorMessage.includes('mantenimiento')) {
        alert(
          `⚠️ ARCA está en mantenimiento\n\nEl sistema de facturación de ARCA/AFIP está temporalmente fuera de servicio.\nPor favor, intenta nuevamente en unos minutos.\n\nError: ${errorMessage}`,
        );
      } else if (isLikelyNetworkErrorMessage(errorMessage)) {
        alert(
          `🌐 Error de conexión\n\nNo se pudo conectar con el servidor de facturación.\nVerifica tu conexión a internet e intenta nuevamente.\n\nError: ${errorMessage}`,
        );
      } else if (
        errorMessage.includes('autenticación') ||
        errorMessage.includes('credentials') ||
        errorMessage.includes('token')
      ) {
        alert(
          `🔐 Error de autenticación\n\nLas credenciales de ARCA parecen estar incorrectas.\nRevisa los certificados en la configuración del servidor.\n\nError: ${errorMessage}`,
        );
      } else {
        alert(
          `❌ Error al anular la factura\n\n${errorMessage}\n\nSi el problema persiste, contacta al soporte técnico.`,
        );
      }
    } finally {
      this.anulandoFacturaId.set(null);
    }
  }

  cerrarVisorPdf(): void {
    this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
    this.pdfViewing.set(null);
    this.pdfViewingInfo.set(null);
    this.pdfViewingBlobUrl.set(null);
  }
}
