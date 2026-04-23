import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  PdfViewerComponent,
  PdfViewerConfig,
} from '../../shared/components/ui/pdf-viewer.component';
import {
  ClienteLookupResult,
  FacturacionService,
  FacturaReciente,
} from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { Comprobante } from '../../core/types/database.types';
import { PdfComprobanteData } from '../../core/types/pdf.types';
import { getFriendlyNetworkErrorMessage } from '../../core/utils/network-error.util';
import {
  resolveTipoComprobanteDetallado,
  sanitizeCuit,
} from '../../core/utils/factura-cliente.util';
import { FacturaClienteLookupSectionComponent } from './factura-cliente-lookup-section.component';
import { FacturaEmitidaPanelComponent } from './factura-emitida-panel.component';
import { FacturasRecientesPanelComponent } from './facturas-recientes-panel.component';

interface FacturaFormModel {
  monto: FormControl<number | ''>;
  fecha: FormControl<string>;
  cliente_cuit: FormControl<string>;
}

interface FacturaRecienteView {
  id: string;
  tipoLabel: string;
  numeroLabel: string;
  fechaLabel: string;
  total: number;
}

@Component({
  selector: 'app-facturar-nuevo',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PdfViewerComponent,
    FacturaClienteLookupSectionComponent,
    FacturaEmitidaPanelComponent,
    FacturasRecientesPanelComponent,
  ],
  template: `
    <div>
      <div
        class="grid gap-3 lg:grid-cols-[minmax(0,29rem)_minmax(18rem,22rem)] lg:items-start lg:justify-center"
      >
        <section class="card-surface card-surface--feature px-3 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
          <form
            [formGroup]="formFactura"
            (ngSubmit)="emitirFactura()"
            class="space-y-3.5 sm:space-y-4"
          >
            <div class="flex items-start justify-end">
              <button
                type="button"
                (click)="toggleCliente()"
                class="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/35 px-2.5 py-1.5 text-[0.72rem] font-semibold tracking-[0.08em] text-muted-foreground transition-all hover:border-primary/30 hover:bg-muted/55 hover:text-foreground sm:px-3 sm:text-xs"
              >
                <span>{{ clienteExpandido() ? '- CUIT' : '+ CUIT' }}</span>
              </button>
            </div>

            @if (clienteExpandido()) {
              <app-factura-cliente-lookup-section
                [clienteCuitControl]="formFactura.controls.cliente_cuit"
                [clienteCuitValido]="clienteCuitValido()"
                [buscandoCliente]="buscandoCliente()"
                [clienteSeleccionado]="clienteSeleccionado()"
                [clienteCuitFormateado]="clienteSeleccionado() ? formatearCuit(clienteSeleccionado()!.cuit || '') : ''"
                [condicionClienteLabel]="condicionClienteLabel()"
                [tipoComprobanteResueltoLabel]="tipoComprobanteResueltoLabel()"
                [requiereRevision]="tipoComprobanteResolution().requiereRevision"
                [mostrarAlertaCliente]="mostrarAlertaCliente()"
                [alertaClienteTexto]="alertaClienteTexto()"
                [mensajeClienteTipo]="mensajeClienteTipo()"
                (buscarCliente)="buscarCliente()"
                (limpiarCliente)="limpiarCliente()"
                (clienteCuitInput)="onClienteCuitInput()"
              />
            }

            <div>
              <label class="mb-2 block text-sm font-semibold tracking-[-0.01em] text-foreground">
                Monto total
              </label>
              <div
                class="premium-money-field"
                [class.premium-money-field--error]="
                  formFactura.controls.monto.invalid && formFactura.controls.monto.touched
                "
              >
                <span class="premium-money-field__prefix" aria-hidden="true">$</span>
                <input
                  #montoInput
                  id="monto"
                  type="text"
                  inputmode="decimal"
                  pattern="[0-9]+([.,][0-9]{0,2})?"
                  autocomplete="off"
                  placeholder="0"
                  [value]="displayMonto()"
                  (beforeinput)="onMontoBeforeInput($event)"
                  (input)="onMontoInput($event)"
                  class="premium-money-field__input"
                  [class.border-red-500]="
                    formFactura.controls.monto.invalid && formFactura.controls.monto.touched
                  "
                />
              </div>
              @if (formFactura.controls.monto.invalid && formFactura.controls.monto.touched) {
                <p class="text-red-500 text-sm mt-1">El monto es requerido y debe ser mayor a 0</p>
              }
            </div>

            <div>
              <label class="mb-2 block text-sm font-semibold tracking-[-0.01em] text-foreground">
                Fecha de facturación
              </label>
              <input
                type="date"
                formControlName="fecha"
                class="form-input w-full py-2.5 px-3.5"
                [min]="minFecha()"
                [max]="maxFecha()"
                [class.border-red-500]="
                  formFactura.controls.fecha.invalid && formFactura.controls.fecha.touched
                "
              />
              @if (formFactura.controls.fecha.invalid && formFactura.controls.fecha.touched) {
                <p class="text-red-500 text-sm mt-1">La fecha es requerida</p>
              }
            </div>

            <button
              type="submit"
              [disabled]="isSubmitting() || formFactura.invalid"
              [class.btn-loading--active]="isSubmitting()"
              [attr.aria-busy]="isSubmitting()"
              class="btn-primary btn-loading premium-submit-btn w-full rounded-xl px-4 py-3.5 text-sm font-semibold tracking-[0.01em] shadow-[0_12px_28px_rgba(29,78,216,0.18)] disabled:shadow-none"
            >
              <span class="btn-loading__content">
                @if (isSubmitting()) {
                  <span class="btn-loading__spinner" aria-hidden="true"></span>
                  <span>Procesando emisi&oacute;n...</span>
                } @else {
                  <span>Emitir {{ tipoComprobanteResueltoLabel() }}</span>
                }
              </span>
            </button>
          </form>

          <app-factura-emitida-panel
            [factura]="facturaEmitida()"
            [tipoComprobante]="facturaEmitida() ? obtenerTipoComprobante(facturaEmitida()!) : ''"
            [numeroComprobante]="facturaEmitida() ? obtenerNumeroSinCeros(facturaEmitida()!.numero_comprobante) : ''"
            [monto]="facturaEmitida() ? montoFacturaEmitida() : ''"
            [accionEnCurso]="accionComprobanteEnCurso()"
            [mensajeAccion]="mensajeAccionComprobante()"
            [mensajeAccionTipo]="mensajeAccionComprobanteTipo()"
            (ver)="verPDF()"
            (compartir)="compartir()"
            (descargar)="descargar()"
            (imprimir)="imprimir()"
            (volver)="volver()"
          />

          @if (mensaje() && !esExito()) {
            <div class="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div class="text-destructive text-center">
                {{ mensaje() }}
              </div>
            </div>
          }
        </section>

        <app-facturas-recientes-panel
          [facturas]="facturasRecientesView()"
          [cargando]="cargandoFacturasRecientes()"
        />
      </div>

      @if (pdfViewing() && pdfViewingConfig()) {
        <div
          class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          (click)="cerrarVisorPdf()"
        >
          <div
            class="bg-card rounded-lg w-full max-w-2xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
            (click)="$event.stopPropagation()"
          >
            <app-pdf-viewer
              [config]="pdfViewingConfig()!"
              (closeRequested)="cerrarVisorPdf()"
            />
          </div>
        </div>
      }

      @if (mostrandoConfirmacionMonto()) {
        <div
          class="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pb-4"
          [style.paddingTop.px]="confirmacionMontoTopOffset()"
          (click)="cancelarConfirmacionMonto()"
        >
          <div
            #confirmacionMontoCard
            class="w-full max-w-md rounded-2xl border border-amber-500/30 bg-card p-5 shadow-2xl"
            (click)="$event.stopPropagation()"
          >
            <div class="mb-4 inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
              Atenci&oacute;n
            </div>

            <div class="space-y-3">
              <h3 class="text-lg font-semibold text-foreground">
                El monto supera tu l&iacute;mite configurado
              </h3>
              <p class="text-sm leading-6 text-muted-foreground">
                Est&aacute;s por emitir una {{ tipoComprobanteResueltoLabel() }} por
                <span class="font-semibold text-foreground">
                  {{ formatearMonto(montoExcedidoPendiente() || 0) }}
                </span>
                y tu tope configurado es
                <span class="font-semibold text-foreground">
                  {{ formatearMonto(montoMaximoFacturaConfigurado()) }}
                </span>.
              </p>
              <p class="text-sm leading-6 text-muted-foreground">
                Revis&aacute; el importe. Si igual quer&eacute;s continuar, el bot&oacute;n se
                habilita en {{ confirmacionMontoCountdown() }} segundo{{
                  confirmacionMontoCountdown() === 1 ? '' : 's'
                }}.
              </p>
            </div>

            <div class="mt-5 flex flex-col gap-3 sm:flex-row-reverse">
              <button
                type="button"
                (click)="confirmarEmisionMontoExcedido()"
                [disabled]="confirmacionMontoCountdown() > 0 || isSubmitting()"
                class="btn-primary w-full rounded-lg px-4 py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (confirmacionMontoCountdown() > 0) {
                  <span>Emitir en {{ confirmacionMontoCountdown() }}s</span>
                } @else {
                  <span>Emitir igual</span>
                }
              </button>

              <button
                type="button"
                (click)="cancelarConfirmacionMonto()"
                class="w-full rounded-lg border border-border bg-background px-4 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class FacturarNuevoComponent implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly facturacionService = inject(FacturacionService);
  private readonly pdfService = inject(PdfService);
  private readonly contribuyenteService = inject(ContribuyenteService);
  private readonly montoInputRef = viewChild<HTMLInputElement>('montoInput');
  private readonly confirmacionMontoCardRef =
    viewChild<ElementRef<HTMLDivElement>>('confirmacionMontoCard');

  readonly formFactura: FormGroup<FacturaFormModel>;
  readonly isSubmitting = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly esExito = signal(false);
  readonly facturaEmitida = signal<Comprobante | null>(null);

  readonly pdfViewing = signal<Comprobante | null>(null);
  readonly pdfViewingConfig = signal<PdfViewerConfig | null>(null);
  readonly pdfViewingBlobUrl = signal<string | null>(null);
  readonly accionComprobanteEnCurso = signal<
    'ver' | 'compartir' | 'descargar' | 'imprimir' | null
  >(null);
  readonly mensajeAccionComprobante = signal<string | null>(null);
  readonly mensajeAccionComprobanteTipo = signal<'success' | 'warning' | 'error'>('success');

  readonly actividad = signal<'bienes' | 'servicios' | null>(null);
  readonly clienteExpandido = signal(false);
  readonly buscandoCliente = signal(false);
  readonly mensajeCliente = signal<string | null>(null);
  readonly mensajeClienteTipo = signal<'success' | 'warning' | 'error'>('success');
  readonly clienteSeleccionado = signal<ClienteLookupResult | null>(null);
  readonly clienteCuitIngresado = signal('');
  readonly minFecha = signal('');
  readonly maxFecha = signal('');

  readonly rawMonto = signal('');
  readonly displayMonto = signal('');
  readonly facturasRecientes = signal<FacturaReciente[]>([]);
  readonly cargandoFacturasRecientes = signal(false);
  readonly mostrandoConfirmacionMonto = signal(false);
  readonly confirmacionMontoCountdown = signal(0);
  readonly montoExcedidoPendiente = signal<number | null>(null);
  readonly montoExcedidoConfirmado = signal<number | null>(null);
  readonly confirmacionMontoTopOffset = signal(96);

  readonly clienteCuitValido = computed(
    () => sanitizeCuit(this.clienteCuitIngresado()).length === 11,
  );
  readonly tipoComprobanteResolution = computed(() => {
    const contribuyente = this.contribuyenteService.contribuyente();
    return resolveTipoComprobanteDetallado(
      contribuyente?.condicion_iva,
      this.clienteSeleccionado()?.condicion_iva_normalizada,
      this.clienteSeleccionado()?.fiscal_profile,
    );
  });
  readonly tipoComprobanteResueltoLabel = computed(() =>
    this.tipoComprobanteResolution().tipo.replace('FACTURA', 'FC'),
  );
  readonly condicionClienteLabel = computed(
    () => this.clienteSeleccionado()?.condicion_iva_normalizada || 'Consumidor Final',
  );
  readonly mostrarAlertaCliente = computed(() => {
    if (this.mensajeClienteTipo() === 'error') {
      return Boolean(this.mensajeCliente());
    }

    if (!this.clienteSeleccionado()) {
      return this.mensajeClienteTipo() === 'warning' && Boolean(this.mensajeCliente());
    }

    return this.tipoComprobanteResolution().requiereRevision || this.mensajeClienteTipo() === 'warning';
  });
  readonly alertaClienteTexto = computed(() => {
    if (this.mensajeClienteTipo() === 'error') {
      return this.mensajeCliente() || '';
    }

    if (this.tipoComprobanteResolution().requiereRevision) {
      return this.tipoComprobanteResolution().motivo;
    }

    if (this.mensajeClienteTipo() === 'warning') {
      return this.mensajeCliente() || this.clienteSeleccionado()?.fiscal_status_message || '';
    }

    return '';
  });
  readonly facturasRecientesView = computed<FacturaRecienteView[]>(() =>
    this.facturasRecientes().map((factura) => ({
      id: factura.id,
      tipoLabel: this.obtenerTipoComprobante(factura),
      numeroLabel: this.obtenerNumeroSinCeros(factura.numero_comprobante),
      fechaLabel: this.formatearFechaCorta(factura.fecha),
      total: factura.total,
    })),
  );
  readonly montoFacturaEmitida = computed(() =>
    this.facturaEmitida() ? this.formatearMonto(this.facturaEmitida()!.total) : '',
  );
  readonly montoMaximoFacturaConfigurado = computed(() => {
    const contribuyente = this.contribuyenteService.contribuyente();
    const monto = Number(contribuyente?.monto_maximo_factura ?? 0);
    return Number.isFinite(monto) && monto > 0 ? monto : 0;
  });

  constructor() {
    this.formFactura = this.fb.group({
      monto: this.fb.control<number | ''>('', [Validators.required, Validators.min(0.01)]),
      fecha: this.fb.control(this.obtenerFechaHoy(), Validators.required),
      cliente_cuit: this.fb.control(''),
    });
    this.clienteCuitIngresado.set(this.formFactura.controls.cliente_cuit.value);

    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        void this.cargarFacturasRecientes();
      } else {
        this.facturasRecientes.set([]);
      }
    });

    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      const tipoComprobante = this.tipoComprobanteResolution().tipo;
      if (!contribuyente) {
        return;
      }

      void this.actualizarLimitesFecha(
        contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios',
        tipoComprobante,
      );
    });
  }

  private confirmacionMontoTimer: ReturnType<typeof setInterval> | null = null;
  private mensajeAccionComprobanteTimer: ReturnType<typeof setTimeout> | null = null;
  private limitesFechaRequestId = 0;
  private readonly visualViewport =
    typeof window !== 'undefined' ? window.visualViewport : null;
  private readonly onViewportChange = () => this.actualizarPosicionConfirmacionMonto();

  ngOnDestroy(): void {
    this.clearConfirmacionMontoTimer();
    this.detachViewportListeners();
    this.clearMensajeAccionComprobante();
    this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
  }

  toggleCliente() {
    this.clienteExpandido.update((value) => !value);
  }

  async buscarCliente(): Promise<void> {
    const cuit = sanitizeCuit(this.formFactura.controls.cliente_cuit.value);
    if (cuit.length !== 11) {
      this.setMensajeCliente('Ingresá un CUIT válido de 11 dígitos.', 'error');
      return;
    }

    this.buscandoCliente.set(true);
    this.setMensajeCliente(null, 'success');

    try {
      const cliente = await this.facturacionService.buscarClientePorCuit(cuit);
      this.clienteSeleccionado.set(cliente);
      this.formFactura.patchValue({ cliente_cuit: cliente.cuit || cuit });
      this.clienteCuitIngresado.set(cliente.cuit || cuit);
      this.setMensajeCliente(
        cliente.fiscal_status_reliable
          ? 'Datos fiscales obtenidos desde Constancia de Inscripción.'
          : 'Se obtuvo la constancia, pero conviene revisar el resultado automático.',
        cliente.fiscal_status_reliable ? 'success' : 'warning',
      );
    } catch (error) {
      this.clienteSeleccionado.set(null);
      this.setMensajeCliente(
        error instanceof Error ? error.message : 'No se pudo obtener datos del cliente.',
        'error',
      );
    } finally {
      this.buscandoCliente.set(false);
    }
  }

  limpiarCliente() {
    this.clienteSeleccionado.set(null);
    this.formFactura.patchValue({ cliente_cuit: '' });
    this.clienteCuitIngresado.set('');
    this.setMensajeCliente(null, 'success');
  }

  onClienteCuitInput() {
    const rawValue = this.formFactura.controls.cliente_cuit.value || '';
    this.clienteCuitIngresado.set(rawValue);
    const cuitIngresado = sanitizeCuit(rawValue);
    if (cuitIngresado !== (this.clienteSeleccionado()?.cuit || '')) {
      this.clienteSeleccionado.set(null);
    }

    if (this.mensajeClienteTipo() === 'error') {
      this.setMensajeCliente(null, 'success');
    }
  }

  async emitirFactura(): Promise<void> {
    if (this.formFactura.invalid) {
      this.formFactura.markAllAsTouched();
      return;
    }

    const montoActual = Number(this.formFactura.controls.monto.value);
    if (this.requiereConfirmacionMontoExtra(montoActual)) {
      this.abrirConfirmacionMonto(montoActual);
      return;
    }

    this.isSubmitting.set(true);
    this.mensaje.set(null);
    this.facturaEmitida.set(null);

    try {
      const { monto, fecha } = this.formFactura.getRawValue();
      const resultado = await this.facturacionService.emitirFactura({
        monto: Number(monto),
        fecha: this.convertirFechaADDMMYYYY(fecha),
        cliente_cuit: this.clienteSeleccionado()?.cuit,
        cliente_nombre: this.clienteSeleccionado()?.nombre,
        cliente_domicilio: this.clienteSeleccionado()?.domicilio,
        cliente_condicion_iva: this.clienteSeleccionado()?.condicion_iva_normalizada,
        cliente_fiscal_profile: this.clienteSeleccionado()?.fiscal_profile,
        tipo_comprobante_resuelto: this.tipoComprobanteResolution().tipo,
      });

      if (!resultado.success || !resultado.comprobante) {
        throw new Error(resultado.error || 'Error al emitir factura');
      }

      this.esExito.set(true);
      this.mensaje.set(
        `Factura emitida exitosamente. Número: ${resultado.comprobante.numero_comprobante}`,
      );
      this.facturaEmitida.set(resultado.comprobante);
      this.clearMensajeAccionComprobante();
      void this.cargarFacturasRecientes();
      this.formFactura.reset({
        monto: '',
        fecha: this.obtenerFechaHoy(),
        cliente_cuit: '',
      });
      this.clienteCuitIngresado.set('');
      this.rawMonto.set('');
      this.displayMonto.set('');
      this.clienteSeleccionado.set(null);
      this.montoExcedidoConfirmado.set(null);
      this.montoExcedidoPendiente.set(null);
      this.setMensajeCliente(null, 'success');
    } catch (error) {
      console.error('Error al emitir factura:', error);
      this.esExito.set(false);
      this.mensaje.set(
        error instanceof Error ? error.message : 'Error desconocido al emitir factura',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  cancelarConfirmacionMonto(): void {
    this.clearConfirmacionMontoTimer();
    this.detachViewportListeners();
    this.mostrandoConfirmacionMonto.set(false);
    this.confirmacionMontoCountdown.set(0);
    this.montoExcedidoPendiente.set(null);
    this.confirmacionMontoTopOffset.set(96);
  }

  async confirmarEmisionMontoExcedido(): Promise<void> {
    if (this.confirmacionMontoCountdown() > 0 || this.isSubmitting()) {
      return;
    }

    const montoPendiente = this.montoExcedidoPendiente();
    if (montoPendiente === null) {
      return;
    }

    this.montoExcedidoConfirmado.set(montoPendiente);
    this.cancelarConfirmacionMonto();
    await this.emitirFactura();
  }

  async cargarFacturasRecientes(): Promise<void> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      this.facturasRecientes.set([]);
      return;
    }

    this.cargandoFacturasRecientes.set(true);

    try {
      this.facturasRecientes.set(
        await this.facturacionService.cargarFacturasRecientes(contribuyente.id),
      );
    } catch (error) {
      console.error('Error inesperado al cargar facturas recientes:', error);
      this.facturasRecientes.set([]);
    } finally {
      this.cargandoFacturasRecientes.set(false);
    }
  }

  onMontoInput(event: Event): void {
    const inputEvent = event as InputEvent;
    const input = event.target as HTMLInputElement;
    const nextRawValue = this.getNextMontoValue(this.rawMonto(), inputEvent, input.value);
    const parsedValue = this.parseMontoInput(nextRawValue);

    this.rawMonto.set(nextRawValue);
    this.displayMonto.set(this.formatMontoInput(nextRawValue));
    this.formFactura.controls.monto.setValue(parsedValue ?? '');
    this.resetMontoExcedidoConfirmado(parsedValue);

    queueMicrotask(() => {
      const cursorPosition = this.displayMonto().length;
      input.setSelectionRange(cursorPosition, cursorPosition);
    });
  }

  onMontoBeforeInput(event: InputEvent): void {
    if (event.inputType !== 'insertText') {
      return;
    }

    const inputData = event.data || '';
    if (!/[0-9.,]/.test(inputData)) {
      event.preventDefault();
      return;
    }

    const [, decimalPart = ''] = this.rawMonto().split('.');
    if (this.rawMonto().includes('.') && decimalPart.length >= 2 && /\d/.test(inputData)) {
      event.preventDefault();
    }
  }

  async verPDF(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    const comprobante = factura;

    await this.ejecutarAccionComprobante(
      'ver',
      async () => {
        const pdfData = this.mapComprobanteToPdfData(comprobante);
        const asset = await this.pdfService.createPdfAsset(pdfData);
        this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
        this.pdfViewing.set(comprobante);
        this.pdfViewingBlobUrl.set(asset.blobUrl);
        this.pdfViewingConfig.set({
          url: asset.blobUrl,
          filename: asset.info.filename,
          title: `Factura ${this.obtenerTipoComprobante(comprobante)} N ${this.obtenerNumeroSinCeros(comprobante.numero_comprobante)}`,
        });
      },
      'Vista previa lista.',
      'Hubo un error al generar el ticket.',
    );
  }

  async compartir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    const comprobante = factura;

    await this.ejecutarAccionComprobante(
      'compartir',
      async () => {
        const shared = await this.pdfService.sharePdf(
          this.pdfService.createPdfInfo(this.mapComprobanteToPdfData(comprobante)),
        );

        if (!shared) {
          throw new Error('No se pudo compartir el ticket.');
        }
      },
      'Comprobante listo para compartir.',
      'No se pudo compartir el ticket.',
    );
  }

  async imprimir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    const comprobante = factura;
    await this.ejecutarAccionComprobante(
      'imprimir',
      () => this.pdfService.printFactura(this.mapComprobanteToPdfData(comprobante)),
      'Comprobante enviado a impresión.',
      'Hubo un error enviando a imprimir.',
    );
  }

  async descargar(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    const comprobante = factura;
    await this.ejecutarAccionComprobante(
      'descargar',
      async () => {
        const downloaded = await this.pdfService.downloadPdf(
          this.pdfService.createPdfInfo(this.mapComprobanteToPdfData(comprobante)),
        );

        if (!downloaded) {
          throw new Error('No se pudo descargar el ticket.');
        }
      },
      'Descarga iniciada.',
      'No se pudo descargar el ticket.',
    );
  }

  cerrarVisorPdf() {
    this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
    this.pdfViewing.set(null);
    this.pdfViewingBlobUrl.set(null);
    this.pdfViewingConfig.set(null);
  }

  volver(): void {
    this.facturaEmitida.set(null);
    this.mensaje.set(null);
    this.esExito.set(false);
    this.clearMensajeAccionComprobante();
    this.accionComprobanteEnCurso.set(null);

    setTimeout(() => this.montoInputRef()?.focus(), 100);
  }

  obtenerTipoComprobante(factura: Pick<Comprobante, 'tipo_comprobante'> | FacturaReciente): string {
    if (factura.tipo_comprobante === 'FACTURA A') return 'FC A';
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    return factura.tipo_comprobante || 'FC C';
  }

  obtenerNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1] || '0';
    }
    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monto);
  }

  formatearFechaCorta(fechaISO: string): string {
    if (!fechaISO) return '-';
    const [anio, mes, dia] = fechaISO.split('-');
    if (!anio || !mes || !dia) return fechaISO;
    return `${dia}/${mes}/${anio}`;
  }

  formatearCuit(cuit: string): string {
    if (!cuit || cuit.length !== 11) return cuit;
    return `${cuit.substring(0, 2)}-${cuit.substring(2, 10)}-${cuit.substring(10)}`;
  }

  private setMensajeCliente(message: string | null, tipo: 'success' | 'warning' | 'error') {
    this.mensajeCliente.set(message);
    this.mensajeClienteTipo.set(tipo);
  }

  private clearMensajeAccionComprobante(): void {
    if (this.mensajeAccionComprobanteTimer !== null) {
      clearTimeout(this.mensajeAccionComprobanteTimer);
      this.mensajeAccionComprobanteTimer = null;
    }

    this.mensajeAccionComprobante.set(null);
  }

  private setMensajeAccionComprobante(
    message: string,
    tipo: 'success' | 'warning' | 'error',
  ): void {
    this.clearMensajeAccionComprobante();
    this.mensajeAccionComprobante.set(message);
    this.mensajeAccionComprobanteTipo.set(tipo);
    this.mensajeAccionComprobanteTimer = setTimeout(() => {
      this.mensajeAccionComprobante.set(null);
      this.mensajeAccionComprobanteTimer = null;
    }, 5000);
  }

  private async ejecutarAccionComprobante(
    action: 'ver' | 'compartir' | 'descargar' | 'imprimir',
    handler: () => Promise<void>,
    successMessage: string,
    fallbackErrorMessage: string,
  ): Promise<void> {
    if (this.accionComprobanteEnCurso()) {
      return;
    }

    this.accionComprobanteEnCurso.set(action);
    this.clearMensajeAccionComprobante();

    try {
      await handler();
      this.setMensajeAccionComprobante(successMessage, 'success');
    } catch (error) {
      console.error(`Error al ejecutar accion ${action}:`, error);

      if (action === 'ver') {
        this.cerrarVisorPdf();
      }

      this.setMensajeAccionComprobante(
        getFriendlyNetworkErrorMessage(
          error,
          fallbackErrorMessage,
          this.getOfflineActionMessage(action),
        ),
        'error',
      );
    } finally {
      this.accionComprobanteEnCurso.set(null);
    }
  }

  private getOfflineActionMessage(
    action: 'ver' | 'compartir' | 'descargar' | 'imprimir',
  ): string {
    if (action === 'ver') {
      return 'No se pudo generar el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.';
    }

    if (action === 'compartir') {
      return 'No se pudo compartir el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.';
    }

    if (action === 'descargar') {
      return 'No se pudo descargar el ticket porque no hay conexion a internet. Verifica la red e intenta nuevamente.';
    }

    return 'No se pudo enviar a imprimir porque no hay conexion a internet. Verifica la red e intenta nuevamente.';
  }

  private requiereConfirmacionMontoExtra(monto: number): boolean {
    const montoMaximo = this.montoMaximoFacturaConfigurado();
    if (!Number.isFinite(monto) || monto <= 0 || montoMaximo <= 0) {
      return false;
    }

    return monto > montoMaximo && this.montoExcedidoConfirmado() !== monto;
  }

  private abrirConfirmacionMonto(monto: number): void {
    this.clearConfirmacionMontoTimer();
    this.montoExcedidoPendiente.set(monto);
    this.mostrandoConfirmacionMonto.set(true);
    this.confirmacionMontoCountdown.set(5);
    this.attachViewportListeners();
    this.actualizarPosicionConfirmacionMonto();
    requestAnimationFrame(() => this.actualizarPosicionConfirmacionMonto());

    this.confirmacionMontoTimer = setInterval(() => {
      const nextValue = this.confirmacionMontoCountdown() - 1;
      if (nextValue <= 0) {
        this.confirmacionMontoCountdown.set(0);
        this.clearConfirmacionMontoTimer();
        return;
      }

      this.confirmacionMontoCountdown.set(nextValue);
    }, 1000);
  }

  private clearConfirmacionMontoTimer(): void {
    if (this.confirmacionMontoTimer !== null) {
      clearInterval(this.confirmacionMontoTimer);
      this.confirmacionMontoTimer = null;
    }
  }

  private attachViewportListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('resize', this.onViewportChange);
    window.addEventListener('orientationchange', this.onViewportChange);
    this.visualViewport?.addEventListener('resize', this.onViewportChange);
    this.visualViewport?.addEventListener('scroll', this.onViewportChange);
  }

  private detachViewportListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('resize', this.onViewportChange);
    window.removeEventListener('orientationchange', this.onViewportChange);
    this.visualViewport?.removeEventListener('resize', this.onViewportChange);
    this.visualViewport?.removeEventListener('scroll', this.onViewportChange);
  }

  private actualizarPosicionConfirmacionMonto(): void {
    if (typeof window === 'undefined') {
      this.confirmacionMontoTopOffset.set(96);
      return;
    }

    const topSafeMargin = 12;
    const bottomSafeMargin = 12;
    const viewport = this.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportBottom = viewportTop + viewportHeight;
    const headerBottom = this.obtenerHeaderBottom();
    const desiredTop = Math.max(topSafeMargin, headerBottom + 12);
    const cardHeight = this.confirmacionMontoCardRef()?.nativeElement.offsetHeight ?? 0;
    const maxTop = Math.max(topSafeMargin, Math.floor(viewportBottom - cardHeight - bottomSafeMargin));

    this.confirmacionMontoTopOffset.set(Math.min(desiredTop, maxTop));
  }

  private obtenerHeaderBottom(): number {
    if (typeof document === 'undefined') {
      return 72;
    }

    const header = document.querySelector<HTMLElement>('[data-app-header]');
    if (!header) {
      return 72;
    }

    return Math.round(header.getBoundingClientRect().bottom);
  }

  private resetMontoExcedidoConfirmado(parsedValue: number | null): void {
    const montoActual = parsedValue ?? null;
    if (this.montoExcedidoConfirmado() !== montoActual) {
      this.montoExcedidoConfirmado.set(null);
    }

    if (this.mostrandoConfirmacionMonto() && this.montoExcedidoPendiente() !== montoActual) {
      this.cancelarConfirmacionMonto();
    }
  }

  private async actualizarLimitesFecha(
    actividad: 'bienes' | 'servicios',
    tipoComprobante: 'FACTURA A' | 'FACTURA B' | 'FACTURA C',
  ): Promise<void> {
    const requestId = ++this.limitesFechaRequestId;
    this.actividad.set(actividad);

    const hoy = new Date();
    const max = this.formatDateInput(hoy);
    const minDate = new Date(hoy);
    minDate.setDate(hoy.getDate() - (actividad === 'bienes' ? 5 : 10));
    let min = this.formatDateInput(minDate);

    const contribuyente = this.contribuyenteService.contribuyente();
    if (contribuyente) {
      try {
        const ultimaFechaTipo =
          await this.facturacionService.cargarUltimaFechaComprobantePorTipo(
            contribuyente.id,
            tipoComprobante,
            contribuyente.punto_venta,
          );

        if (requestId !== this.limitesFechaRequestId) {
          return;
        }

        if (ultimaFechaTipo && ultimaFechaTipo > min) {
          min = ultimaFechaTipo;
        }
      } catch (error) {
        console.error('Error al consultar ultima fecha por tipo:', error);
      }
    }

    if (requestId !== this.limitesFechaRequestId) {
      return;
    }

    this.maxFecha.set(max);
    this.minFecha.set(min);

    const fechaActual = this.formFactura.controls.fecha.value;
    if (!fechaActual) {
      return;
    }

    if (fechaActual > max) {
      this.formFactura.controls.fecha.setValue(max);
    } else if (fechaActual < min) {
      this.formFactura.controls.fecha.setValue(min);
    }
  }

  private obtenerFechaHoy(): string {
    return this.formatDateInput(new Date());
  }

  private convertirFechaADDMMYYYY(fechaISO: string): string {
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  private formatDateInput(date: Date): string {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private getNextMontoValue(
    currentValue: string,
    inputEvent: InputEvent,
    fallbackValue: string,
  ): string {
    const inputType = inputEvent.inputType || '';
    const inputData = inputEvent.data || '';

    if (inputType === 'deleteContentBackward' || inputType === 'deleteContentForward') {
      return currentValue.slice(0, -1);
    }

    if (inputType === 'insertText') {
      return this.applyMontoInputCharacter(currentValue, inputData);
    }

    return this.sanitizeMontoInput(fallbackValue);
  }

  private applyMontoInputCharacter(currentValue: string, character: string): string {
    if (/\d/.test(character)) {
      if (!currentValue.includes('.')) {
        const integerPart = (currentValue + character).replace(/^0+(?=\d)/, '');
        return integerPart || '0';
      }

      const [integerPart, decimalPart = ''] = currentValue.split('.');
      if (decimalPart.length >= 2) {
        return currentValue;
      }

      return `${integerPart}.${decimalPart}${character}`;
    }

    if ((character === '.' || character === ',') && !currentValue.includes('.')) {
      return currentValue ? `${currentValue}.` : '0.';
    }

    return currentValue;
  }

  private sanitizeMontoInput(value: string): string {
    const cleanedValue = value.replace(/[^\d.,]/g, '');
    const lastCommaIndex = cleanedValue.lastIndexOf(',');
    const lastDotIndex = cleanedValue.lastIndexOf('.');
    const decimalSeparatorIndex = Math.max(lastCommaIndex, lastDotIndex);

    if (decimalSeparatorIndex === -1) {
      return cleanedValue.replace(/[.,]/g, '').replace(/^0+(?=\d)/, '');
    }

    const rawIntegerPart = cleanedValue.slice(0, decimalSeparatorIndex).replace(/[.,]/g, '');
    const rawDecimalPart = cleanedValue.slice(decimalSeparatorIndex + 1).replace(/[.,]/g, '');
    const integerPart = rawIntegerPart || '0';
    const decimalPart = rawDecimalPart.slice(0, 2);

    return `${integerPart}.${decimalPart}`;
  }

  private parseMontoInput(value: string): number | null {
    if (!value) return null;
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private formatMontoInput(value: string): string {
    if (!value) return '';

    const hasDecimalSeparator = value.includes('.');
    const [integerPart = '0', decimalPart = ''] = value.split('.');
    const formattedIntegerPart = Number(integerPart || '0').toLocaleString('es-AR');

    if (!hasDecimalSeparator) {
      return formattedIntegerPart;
    }

    if (!decimalPart || /^0*$/.test(decimalPart)) {
      return formattedIntegerPart;
    }

    return `${formattedIntegerPart},${decimalPart}`;
  }

  private mapComprobanteToPdfData(comprobante: Comprobante): PdfComprobanteData {
    return {
      tipo_comprobante: comprobante.tipo_comprobante,
      numero_comprobante: comprobante.numero_comprobante,
      fecha: comprobante.fecha,
      total: Number(comprobante.total ?? 0),
      cae: comprobante.cae,
      vencimiento_cae: comprobante.vencimiento_cae,
      cliente_cuit: comprobante.cliente_cuit,
      cliente_doc_tipo: comprobante.cliente_doc_tipo,
      cliente_doc_nro: comprobante.cliente_doc_nro,
      cliente_nombre: comprobante.cliente_nombre,
      cliente_domicilio: comprobante.cliente_domicilio,
      cliente_condicion_iva: comprobante.cliente_condicion_iva,
      punto_venta: comprobante.punto_venta,
      concepto: comprobante.concepto,
    };
  }
}

