import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import {
  ComprobanteListadoItem,
  NotaCreditoEmitida,
  ResumenComprobantesPorFecha,
} from '../../core/types/comprobantes.types';
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
import {
  PdfViewerComponent,
  PdfViewerConfig,
} from '../../shared/components/ui/pdf-viewer.component';

const PAGE_INITIAL_SIZE = 10;
const PAGE_MORE_SIZE = 10;

type Factura = ComprobanteListadoItem;

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
      <div class="card-surface px-2.5 py-3 sm:p-4">
        <label class="form-label mb-4">Seleccionar fecha</label>

        <div class="flex items-center gap-2 sm:gap-3">
          <input
            type="date"
            [value]="fechaSeleccionada() ?? ''"
            (change)="cambiarFecha($event)"
            class="form-input min-w-0 flex-1 py-2 px-3"
          />

          @if (modoFechaActivo()) {
            <button
              type="button"
              (click)="verUltimasFacturas()"
              class="inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:px-4"
            >
              Ver últimas
            </button>
          }
        </div>
      </div>

      <div class="card-surface px-2.5 py-3 sm:p-4">
        <h3 class="form-label mb-4">{{ nombreFechaSeleccionada() }}</h3>

        @if (mensajeCarga()) {
          <div
            class="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {{ mensajeCarga() }}
          </div>
        }

        @if (mensajeAccion()) {
          <div
            class="mb-4 rounded-lg px-4 py-3 text-sm"
            [class]="
              mensajeAccionTipo() === 'success'
                ? 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-700'
                : mensajeAccionTipo() === 'warning'
                  ? 'border border-amber-500/25 bg-amber-500/10 text-amber-800'
                  : 'border border-destructive/25 bg-destructive/10 text-destructive'
            "
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>{{ mensajeAccion() }}</span>

              @if (mensajeAccionTipo() === 'warning' && facturaPendienteReintento()) {
                <button
                  type="button"
                  class="inline-flex items-center justify-center rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-amber-500/10"
                  (click)="reintentarAnulacion($event)"
                  [disabled]="esAnulandoFactura(facturaPendienteReintento()!.id)"
                >
                  Reintentar
                </button>
              }
            </div>
          </div>
        }

        @if (notaCreditoEmitida()) {
          <app-comprobante-resultado-panel
            eyebrow="Nota de crédito emitida"
            [title]="notaCreditoPanelTitle()"
            [subtitle]="notaCreditoPanelSubtitle()"
            [meta]="notaCreditoPanelMeta()"
            [actions]="accionesComprobante"
            closeLabel="Cerrar"
            (actionSelected)="onNotaCreditoAction($event)"
            (closeRequested)="cerrarNotaCredito()"
          />
        }

        @if (cargando()) {
          <div class="text-center py-8">
            <div
              class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
            ></div>
            <p class="text-muted-foreground mt-4">Cargando facturas...</p>
          </div>
        } @else if (facturas().length === 0) {
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
          </div>
        } @else {
          <div class="space-y-2">
            @for (factura of facturas(); track factura.id; let idx = $index) {
              @if (!modoFechaActivo() && (idx === 0 || facturas()[idx - 1].fecha !== factura.fecha)) {
                <div class="text-[0.78rem] uppercase tracking-wider font-semibold text-muted-foreground pt-3 pb-0 px-1 first:pt-0">
                  {{ formatearFechaDivider(factura.fecha) }}
                </div>
              }

              <div
                class="border border-border rounded-lg overflow-hidden transition-all duration-200"
                [class]="obtenerClaseContenedorFactura(factura)"
              >
                <div
                  [class]="
                    obtenerClaseFilaFactura(factura) +
                    ' px-2 py-2.5 sm:p-3 cursor-pointer hover:bg-muted'
                  "
                  (click)="toggleExpansion(factura.id, $event)"
                  role="button"
                  tabindex="0"
                >
                  <div
                    class="grid grid-cols-[3.2rem_3rem_minmax(0,1fr)_7rem_1rem] items-center gap-x-1.5 sm:grid-cols-[3.5rem_3.4rem_minmax(0,1fr)_8.2rem_1rem] sm:gap-x-3"
                  >
                    <div
                      class="text-[1.05rem] sm:text-[1.1rem] font-semibold text-foreground min-w-0 justify-self-start text-left"
                    >
                      {{ obtenerTipoComprobanteVista(factura) }}
                    </div>
                    <div
                      class="pl-1 text-[1.05rem] sm:text-[1.1rem] font-medium min-w-0 justify-self-end text-right text-foreground sm:pl-1.5"
                    >
                      {{ obtenerNumeroSinCeros(factura.numero_factura) }}
                    </div>
                    <div class="min-w-0 w-full justify-self-stretch text-center">
                      <span
                        class="px-2 py-1 rounded text-[0.82rem] sm:text-[0.85rem] font-semibold"
                        [class]="obtenerClaseEstado(factura.estado)"
                      >
                        {{ obtenerTextoEstado(factura.estado) }}
                      </span>
                    </div>
                    <div
                      class="text-right font-bold text-[1.05rem] sm:text-[1.1rem] min-w-0 justify-self-end"
                      [class]="obtenerClaseMonto(factura)"
                    >
                      {{
                        obtenerMontoMostrar(factura)
                          | currency: 'ARS' : 'symbol' : '1.2-2' : 'es-AR'
                      }}
                    </div>
                    <div class="ml-1 sm:ml-2 justify-self-end text-muted-foreground">
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
                    <div class="receipt-card-actions mb-3">
                      <div class="receipt-card-actions-primary">
                        <button
                          type="button"
                          class="receipt-action-btn receipt-action-btn--more"
                          title="Más opciones"
                          aria-label="Más opciones"
                          [attr.aria-expanded]="accionesSecundariasFacturaId() === factura.id"
                          (click)="toggleAccionesSecundarias(factura.id, $event)"
                        >
                          <span class="receipt-action-btn__icon" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 12h.01M12 12h.01M19 12h.01"
                              ></path>
                            </svg>
                          </span>
                          <span class="receipt-action-btn__label">Más</span>
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

                      @if (accionesSecundariasFacturaId() === factura.id) {
                        <div class="receipt-card-actions-secondary">
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
                                  <span class="receipt-danger-btn__icon" aria-hidden="true">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-8 0h10"
                                      ></path>
                                    </svg>
                                  </span>
                                  <span>Anular</span>
                                }
                              </span>
                            </button>
                          }

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
                        </div>
                      }
                    </div>

                    @if (
                      mostrandoConfirmacionAnulacion() &&
                      facturaPendienteAnulacion()?.id === factura.id
                    ) {
                      <div
                        class="mb-4 rounded-2xl border border-amber-500/25 bg-card px-4 py-4 shadow-sm"
                      >
                        <div
                          class="mb-2 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700"
                        >
                          Confirmar anulación
                        </div>
                        <div class="space-y-2">
                          <h4 class="text-sm font-semibold text-foreground">
                            ¿Seguro que querés anular la factura
                            {{ facturaPendienteAnulacion()!.numero_factura }}?
                          </h4>
                          <p class="text-sm leading-6 text-muted-foreground">
                            Se emitirá una nota de crédito automática por
                            {{ formatearMoneda(facturaPendienteAnulacion()!.monto) }} para dejarla
                            anulada.
                          </p>
                        </div>

                        <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            class="rounded-lg border border-border bg-background px-4 py-2 font-medium text-foreground transition-colors hover:bg-muted"
                            (click)="cancelarConfirmacionAnulacion($event)"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            class="receipt-danger-btn btn-loading justify-center"
                            [disabled]="esAnulandoFactura(factura.id)"
                            [class.btn-loading--active]="esAnulandoFactura(factura.id)"
                            [attr.aria-busy]="esAnulandoFactura(factura.id)"
                            (click)="confirmarAnulacionFactura($event)"
                          >
                            <span class="btn-loading__content">
                              @if (esAnulandoFactura(factura.id)) {
                                <span class="btn-loading__spinner" aria-hidden="true"></span>
                                <span>Anulando...</span>
                              } @else {
                                <span>Confirmar anulación</span>
                              }
                            </span>
                          </button>
                        </div>
                      </div>
                    }

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

          @if (hayMasFacturas()) {
            <div class="mt-4 flex justify-center">
              <button
                type="button"
                (click)="cargarMasFacturas()"
                [disabled]="cargandoMas()"
                class="inline-flex min-w-36 items-center justify-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                @if (cargandoMas()) {
                  Cargando...
                } @else {
                  Cargar más
                }
              </button>
            </div>
          }
        }
      </div>

      @if (modoFechaActivo() && resumenDia()) {
        <div class="bg-blue-50 rounded-lg border border-blue-200 p-2">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-blue-800">
              Total del día ({{ resumenDia()!.cantidad }} facturas)
            </span>
            <span class="text-lg font-bold text-blue-900">
              {{ resumenDia()!.total | currency: 'ARS' : 'symbol' : '1.2-2' : 'es-AR' }}
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
                  <div
                    class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"
                  ></div>
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

  fechaSeleccionada = signal<string | null>(null);
  facturas = signal<Factura[]>([]);
  cargando = signal(false);
  cargandoMas = signal(false);
  hayMasFacturas = signal(false);
  facturaExpandida = signal<string | null>(null);
  accionesSecundariasFacturaId = signal<string | null>(null);
  anulandoFacturaId = signal<string | null>(null);
  notaCreditoEmitida = signal<NotaCreditoEmitida | null>(null);
  resumenDia = signal<ResumenComprobantesPorFecha | null>(null);
  mensajeCarga = signal<string | null>(null);
  mensajeAccion = signal<string | null>(null);
  mensajeAccionTipo = signal<'success' | 'warning' | 'error'>('success');
  facturaPendienteAnulacion = signal<Factura | null>(null);
  mostrandoConfirmacionAnulacion = signal(false);
  facturaPendienteReintento = signal<Factura | null>(null);

  private mensajeAccionTimer: ReturnType<typeof setTimeout> | null = null;
  private ultimoToggleExpansion: { facturaId: string; timestamp: number } | null = null;
  private ultimoToggleAccionesSecundarias: { facturaId: string; timestamp: number } | null = null;

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

  readonly modoFechaActivo = computed(() => Boolean(this.fechaSeleccionada()));

  readonly nombreFechaSeleccionada = computed(() => {
    const fechaSeleccionada = this.fechaSeleccionada();
    if (!fechaSeleccionada) return 'Últimas facturas';

    const fecha = new Date(`${fechaSeleccionada}T00:00:00`);
    return `Facturas del ${format(fecha, 'dd/MM/yyyy', { locale: es })}`;
  });

  readonly mensajeEstadoVacio = computed(() =>
    this.modoFechaActivo() ? 'No hay facturas para esta fecha' : 'Todavía no hay facturas emitidas',
  );

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
        void this.cargarFacturasIniciales();
      }
    });
  }

  toggleExpansion(facturaId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const ahora = Date.now();
    if (
      this.ultimoToggleExpansion?.facturaId === facturaId &&
      ahora - this.ultimoToggleExpansion.timestamp < 300
    ) {
      return;
    }

    this.ultimoToggleExpansion = { facturaId, timestamp: ahora };
    this.facturaExpandida.set(this.facturaExpandida() === facturaId ? null : facturaId);
    this.accionesSecundariasFacturaId.set(null);
  }

  toggleAccionesSecundarias(facturaId: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const ahora = Date.now();
    if (
      this.ultimoToggleAccionesSecundarias?.facturaId === facturaId &&
      ahora - this.ultimoToggleAccionesSecundarias.timestamp < 300
    ) {
      return;
    }

    this.ultimoToggleAccionesSecundarias = { facturaId, timestamp: ahora };
    this.accionesSecundariasFacturaId.update((actual) => (actual === facturaId ? null : facturaId));
  }

  puedeAnularFactura(factura: Factura): boolean {
    return !this.esNotaCredito(factura) && factura.estado === 'emitida';
  }

  esAnulandoFactura(facturaId: string): boolean {
    return this.anulandoFacturaId() === facturaId;
  }

  cancelarConfirmacionAnulacion(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.facturaPendienteAnulacion.set(null);
    this.mostrandoConfirmacionAnulacion.set(false);
  }

  async confirmarAnulacionFactura(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const factura = this.facturaPendienteAnulacion();
    if (!factura) return;

    await this.ejecutarAnulacionFactura(factura);
  }

  async reintentarAnulacion(event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const factura = this.facturaPendienteReintento();
    if (!factura || this.esAnulandoFactura(factura.id)) return;

    await this.ejecutarAnulacionFactura(factura);
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
      const result = await this.pdfService.sharePdf(pdfInfo);
      this.setMensajeAccion(result.message, result.type);
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
      const result = await this.pdfService.downloadPdf(pdfInfo);
      this.setMensajeAccion(result.message, result.type);
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
      const result = await this.pdfService.sharePdf(pdfInfo);
      this.setMensajeAccion(result.message, result.type);
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
      const result = await this.pdfService.downloadPdf(pdfInfo);
      this.setMensajeAccion(result.message, result.type);
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
  }

  async cargarFacturasIniciales(): Promise<void> {
    await this.cargarFacturasListado({ reset: true });
  }

  async cargarFacturasListado(options?: {
    reset?: boolean;
    append?: boolean;
    silent?: boolean;
  }): Promise<void> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) return;

    const reset = options?.reset ?? false;
    const append = options?.append ?? false;
    const silent = options?.silent ?? false;
    const offset = append ? this.facturas().length : 0;
    const limit = append ? PAGE_MORE_SIZE : PAGE_INITIAL_SIZE;
    const fecha = this.fechaSeleccionada() ?? undefined;

    if (reset) {
      this.facturas.set([]);
      this.hayMasFacturas.set(false);
      this.facturaExpandida.set(null);
      this.accionesSecundariasFacturaId.set(null);
    }

    if (!silent) {
      if (append) {
        this.cargandoMas.set(true);
      } else {
        this.cargando.set(true);
      }
    }
    this.mensajeCarga.set(null);

    try {
      const [listado] = await Promise.all([
        this.comprobantesService.cargarComprobantesListado(contribuyente.id, {
          fecha,
          offset,
          limit,
        }),
        !append && fecha ? this.cargarResumenDia(contribuyente.id, fecha) : Promise.resolve(),
      ]);

      this.facturas.set(append ? [...this.facturas(), ...listado.items] : listado.items);
      this.hayMasFacturas.set(listado.hasMore);
    } catch (error) {
      console.error('Error inesperado al cargar comprobantes:', error);
      if (!append) {
        this.facturas.set([]);
        this.hayMasFacturas.set(false);
        if (this.modoFechaActivo()) {
          this.resumenDia.set(null);
        }
      }
      this.mensajeCarga.set(
        getFriendlyNetworkErrorMessage(
          error,
          'No se pudieron cargar los comprobantes.',
          'No se pudieron cargar los comprobantes porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
        ),
      );
    } finally {
      if (!silent) {
        if (append) {
          this.cargandoMas.set(false);
        } else {
          this.cargando.set(false);
        }
      }
    }
  }

  async cargarMasFacturas(): Promise<void> {
    if (this.cargandoMas() || !this.hayMasFacturas()) return;
    await this.cargarFacturasListado({ append: true });
  }

  async cambiarFecha(event: Event): Promise<void> {
    const nuevaFecha = (event.target as HTMLInputElement).value || null;
    this.fechaSeleccionada.set(nuevaFecha);
    this.resumenDia.set(null);
    await this.cargarFacturasListado({ reset: true });
  }

  async verUltimasFacturas(): Promise<void> {
    this.fechaSeleccionada.set(null);
    this.resumenDia.set(null);
    await this.cargarFacturasListado({ reset: true });
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

    return null;
  }

  private async cargarResumenDia(contribuyenteId: string, fecha: string): Promise<void> {
    const resumen = await this.comprobantesService.cargarResumenComprobantesPorFecha(
      contribuyenteId,
      fecha,
    );
    this.resumenDia.set(resumen);
  }

  private clearMensajeAccion(): void {
    if (this.mensajeAccionTimer !== null) {
      clearTimeout(this.mensajeAccionTimer);
      this.mensajeAccionTimer = null;
    }

    this.mensajeAccion.set(null);
  }

  private setMensajeAccion(
    message: string,
    tipo: 'success' | 'warning' | 'error',
    options?: { persist?: boolean },
  ): void {
    this.clearMensajeAccion();

    this.mensajeAccion.set(message);
    this.mensajeAccionTipo.set(tipo);

    if (options?.persist) {
      return;
    }

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
      return numero.split('-').pop()?.replace(/^0+/, '') || '0';
    }

    return numero.replace(/^0+/, '') || '0';
  }

  obtenerClaseEstado(estado: string): string {
    return estado === 'emitida' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  }

  obtenerClaseFilaFactura(factura: Factura): string {
    return this.esNotaCredito(factura) ? 'card-nota-credito' : 'card-factura';
  }

  obtenerClaseContenedorFactura(factura: Factura): string {
    const expandedClass =
      this.facturaExpandida() === factura.id ? 'shadow-md receipt-expanded-frame' : 'shadow-sm';
    return this.esNotaCredito(factura) ? `${expandedClass} card-nota-credito-frame` : expandedClass;
  }

  obtenerClaseMonto(factura: Factura): string {
    const baseClass = 'text-right';
    return this.esNotaCredito(factura)
      ? `${baseClass} monto-negativo`
      : `${baseClass} text-foreground`;
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

  formatearFechaDivider(fechaStr: string): string {
    const fecha = new Date(`${fechaStr}T00:00:00`);
    const formatted = format(fecha, "EEEE d 'de' MMMM", { locale: es });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  async anularFactura(factura: Factura, event?: Event): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (this.facturaEstaAnulada(factura) || this.esAnulandoFactura(factura.id)) {
      return;
    }

    this.facturaPendienteReintento.set(null);
    this.facturaPendienteAnulacion.set(factura);
    this.mostrandoConfirmacionAnulacion.set(true);
  }

  private async ejecutarAnulacionFactura(factura: Factura): Promise<void> {
    if (this.facturaEstaAnulada(factura) || this.esAnulandoFactura(factura.id)) {
      return;
    }

    this.anulandoFacturaId.set(factura.id);
    this.facturaPendienteReintento.set(null);
    this.clearMensajeAccion();

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
        this.cancelarConfirmacionAnulacion();
        await this.cargarFacturasListado({ reset: true, silent: true });
        this.facturaExpandida.set(null);
        this.accionesSecundariasFacturaId.set(null);
        return;
      }

      const errorMessage = resultado.error || 'Error desconocido';

      if (resultado.shouldRetry) {
        this.cancelarConfirmacionAnulacion();
        this.facturaPendienteReintento.set(factura);
        this.setMensajeAccion(
          `ARCA está en mantenimiento. No se pudo emitir la nota de crédito ahora. ${errorMessage}`,
          'warning',
          { persist: true },
        );
        return;
      }

      throw new Error(errorMessage);
    } catch (error) {
      console.error('Error al anular factura:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      this.cancelarConfirmacionAnulacion();
      this.facturaPendienteReintento.set(null);

      if (this.isArcaMaintenanceError(errorMessage)) {
        this.facturaPendienteReintento.set(factura);
        this.setMensajeAccion(
          `ARCA está en mantenimiento. Intentá nuevamente en unos minutos. ${errorMessage}`,
          'warning',
          { persist: true },
        );
      } else if (isLikelyNetworkErrorMessage(errorMessage)) {
        this.setMensajeAccion(
          'No se pudo anular la factura porque no hay conexión con el servicio de facturación. Verificá tu red e intentá nuevamente.',
          'error',
        );
      } else if (this.isCredentialError(errorMessage)) {
        this.setMensajeAccion(
          'No se pudo anular la factura por un problema de autenticación con ARCA. Revisá credenciales, certificados o sesión vigente.',
          'error',
        );
      } else {
        this.setMensajeAccion(`No se pudo anular la factura. ${errorMessage}`, 'error');
      }
    } finally {
      this.anulandoFacturaId.set(null);
    }
  }

  private isArcaMaintenanceError(errorMessage: string): boolean {
    return errorMessage.toLowerCase().includes('mantenimiento');
  }

  private isCredentialError(errorMessage: string): boolean {
    const normalizedMessage = errorMessage.toLowerCase();
    return (
      normalizedMessage.includes('autenticación') ||
      normalizedMessage.includes('autenticacion') ||
      normalizedMessage.includes('credentials') ||
      normalizedMessage.includes('credenciales') ||
      normalizedMessage.includes('token') ||
      normalizedMessage.includes('sesión') ||
      normalizedMessage.includes('sesion')
    );
  }

  cerrarVisorPdf(): void {
    this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
    this.pdfViewing.set(null);
    this.pdfViewingInfo.set(null);
    this.pdfViewingBlobUrl.set(null);
  }
}
