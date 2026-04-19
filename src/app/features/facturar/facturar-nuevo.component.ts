import { Component, computed, effect, inject, signal } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  PdfViewerComponent,
  PdfViewerConfig,
} from '../../shared/components/ui/pdf-viewer.component';
import { ClienteLookupResult, FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { supabase } from '../../core/services/supabase.service';
import {
  resolveTipoComprobanteDetallado,
  sanitizeCuit,
} from '../../core/utils/factura-cliente.util';

interface FacturaReciente {
  id: string;
  fecha: string;
  tipo_comprobante: string;
  total: number;
  numero_comprobante: string;
  created_at?: string;
}

@Component({
  selector: 'app-facturar-nuevo',
  standalone: true,
  imports: [ReactiveFormsModule, PdfViewerComponent],
  template: `
    <div class="max-w-5xl mx-auto">
      <div
        class="grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(20rem,24rem)] lg:items-start lg:justify-center"
      >
        <section class="card-surface px-4 pb-5 pt-4 sm:p-6">
          <form
            [formGroup]="formFactura"
            (ngSubmit)="emitirFactura()"
            class="space-y-3 sm:space-y-4"
          >
            <div class="flex items-center justify-end">
              <button
                type="button"
                (click)="toggleCliente()"
                class="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:px-3 sm:py-2 sm:text-sm"
              >
                <span>{{ clienteExpandido() ? '- CUIT' : '+ CUIT' }}</span>
              </button>
            </div>

            @if (clienteExpandido()) {
              <div class="rounded-2xl border border-border bg-card/70 p-3 sm:p-4 space-y-3">
                <div class="flex items-end gap-2 sm:gap-3">
                  <div class="flex-1">
                    <label class="block text-sm font-medium text-foreground mb-1.5"
                      >CUIT del cliente</label
                    >
                    <input
                      type="text"
                      inputmode="numeric"
                      maxlength="11"
                      formControlName="cliente_cuit"
                      (input)="onClienteCuitInput()"
                      placeholder="Ingresar CUIT"
                      class="form-input w-full"
                    />
                  </div>
                  <button
                    type="button"
                    (click)="buscarCliente()"
                    [disabled]="buscandoCliente() || !clienteCuitValido()"
                    class="btn-primary inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    [attr.aria-label]="buscandoCliente() ? 'Buscando cliente' : 'Buscar cliente'"
                    [attr.title]="buscandoCliente() ? 'Buscando cliente' : 'Buscar cliente'"
                  >
                    @if (buscandoCliente()) {
                      <svg
                        class="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          stroke-width="2"
                          class="opacity-30"
                        />
                        <path
                          d="M21 12a9 9 0 0 0-9-9"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      </svg>
                    } @else {
                      <svg
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle
                          cx="11"
                          cy="11"
                          r="6"
                          stroke="currentColor"
                          stroke-width="2"
                        />
                        <path
                          d="m20 20-4.35-4.35"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                        />
                      </svg>
                    }
                  </button>
                </div>

                @if (clienteSeleccionado()) {
                  <div class="rounded-xl border border-border bg-background/80 p-3 sm:p-4 space-y-3">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="text-sm font-semibold text-foreground">
                          {{ clienteSeleccionado()!.nombre || 'Cliente identificado' }}
                        </div>
                        <div class="mt-1 text-xs text-muted-foreground">
                          CUIT {{ formatearCuit(clienteSeleccionado()!.cuit || '') }}
                        </div>
                      </div>
                      <button
                        type="button"
                        (click)="limpiarCliente()"
                        class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Quitar cliente
                      </button>
                    </div>

                    <div class="flex flex-wrap gap-2">
                      <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                        {{ condicionClienteLabel() }}
                      </span>
                      <span
                        class="rounded-full px-2.5 py-1 text-xs font-medium"
                        [class]="
                          tipoComprobanteResolution().requiereRevision
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                        "
                      >
                        {{ tipoComprobanteResueltoLabel() }}
                      </span>
                    </div>
                  </div>
                }

                @if (mostrarAlertaCliente()) {
                  <div
                    class="rounded-lg border px-3 py-2 text-sm"
                    [class]="
                      mensajeClienteTipo() === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
                        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                    "
                  >
                    {{ alertaClienteTexto() }}
                  </div>
                }
              </div>
            }

            <div>
              <label class="block text-sm font-medium text-foreground mb-4"> Monto Total </label>
              <input
                id="monto"
                type="text"
                inputmode="decimal"
                pattern="[0-9]+([.,][0-9]{0,2})?"
                autocomplete="off"
                placeholder="0"
                [value]="displayMonto()"
                (beforeinput)="onMontoBeforeInput($event)"
                (input)="onMontoInput($event)"
                class="form-input w-full text-2xl sm:text-3xl text-center py-2 sm:py-4 px-3"
                [class.border-red-500]="
                  formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched
                "
              />
              @if (formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched) {
                <p class="text-red-500 text-sm mt-1">El monto es requerido y debe ser mayor a 0</p>
              }
            </div>

            <div>
              <label class="block text-sm font-medium text-foreground mb-4">
                Fecha de Facturación
              </label>
              <input
                type="date"
                formControlName="fecha"
                class="form-input w-full py-2 px-3"
                [min]="minFecha()"
                [max]="maxFecha()"
                [class.border-red-500]="
                  formFactura.get('fecha')?.invalid && formFactura.get('fecha')?.touched
                "
              />
              @if (formFactura.get('fecha')?.invalid && formFactura.get('fecha')?.touched) {
                <p class="text-red-500 text-sm mt-1">La fecha es requerida</p>
              }
            </div>

            <button
              type="submit"
              [disabled]="isSubmitting() || formFactura.invalid"
              class="btn-primary w-full py-3 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (isSubmitting()) {
                <span>Procesando...</span>
              } @else {
                <span>Emitir {{ tipoComprobanteResueltoLabel() }}</span>
              }
            </button>
          </form>

          @if (facturaEmitida()) {
            <div class="mt-4 p-4 card-factura-emitida">
              <div class="text-center mb-4">
                <h3 class="text-lg font-semibold mb-2">Factura emitida:</h3>
                <div class="text-xl font-bold text-primary">
                  {{ obtenerTipoComprobante(facturaEmitida()!) }}
                  {{ obtenerNumeroSinCeros(obtenerNumeroComprobante(facturaEmitida()!)) }}
                  {{ formatearMonto(obtenerMontoComprobante(facturaEmitida()!)) }}
                </div>
                @if (facturaEmitida()?.cliente_nombre) {
                  <div class="mt-2 text-sm text-muted-foreground">
                    {{ facturaEmitida()?.cliente_nombre }} -
                    {{ facturaEmitida()?.cliente_condicion_iva }}
                  </div>
                }
              </div>
              <div class="grid grid-cols-2 gap-2 mb-3">
                <button
                  (click)="verPDF()"
                  class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Ver
                </button>
                <button
                  (click)="compartir()"
                  class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Compartir
                </button>
                <button
                  (click)="descargar()"
                  class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Descargar
                </button>
                <button
                  (click)="imprimir()"
                  class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Imprimir
                </button>
              </div>
              <button
                (click)="volver()"
                class="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium py-2 px-3 rounded-lg transition-colors text-sm"
              >
                Volver
              </button>
            </div>
          }

          @if (mensaje() && !esExito()) {
            <div class="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div class="text-destructive text-center">
                {{ mensaje() }}
              </div>
            </div>
          }
        </section>

        <aside class="card-surface p-4 sm:p-5">
          <div class="mb-4">
            <h3 class="text-base font-semibold text-foreground">Últimas facturas</h3>
          </div>

          @if (cargandoFacturasRecientes()) {
            <div class="space-y-2">
              @for (skeleton of [1, 2, 3]; track skeleton) {
                <div class="rounded-lg border border-border/60 bg-muted/30 p-3 animate-pulse">
                  <div class="h-4 w-24 bg-muted rounded mb-2"></div>
                  <div class="h-4 w-full bg-muted rounded"></div>
                </div>
              }
            </div>
          } @else if (facturasRecientes().length === 0) {
            <div
              class="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground"
            >
              Todavía no hay facturas recientes.
            </div>
          } @else {
            <div class="space-y-2">
              @for (factura of facturasRecientes(); track factura.id) {
                <div class="rounded-lg border border-border bg-card/70 px-3 py-3">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-foreground">
                        {{ obtenerTipoComprobante(factura) }}
                        {{ obtenerNumeroSinCeros(factura.numero_comprobante) }}
                      </div>
                      <div class="text-xs text-muted-foreground mt-1">
                        {{ formatearFechaCorta(factura.fecha) }}
                      </div>
                    </div>
                    <div class="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                      {{ formatearMonto(factura.total) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </aside>
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
            ></app-pdf-viewer>
          </div>
        </div>
      }
    </div>
  `,
})
export class FacturarNuevoComponent {
  private readonly fb = inject(FormBuilder);
  private readonly facturacionService = inject(FacturacionService);
  private readonly pdfService = inject(PdfService);
  private readonly contribuyenteService = inject(ContribuyenteService);

  formFactura: FormGroup;
  isSubmitting = signal(false);
  mensaje = signal<string | null>(null);
  esExito = signal(false);
  facturaEmitida = signal<any>(null);

  pdfViewing = signal<any>(null);
  pdfViewingConfig = signal<PdfViewerConfig | null>(null);
  pdfViewingBlobUrl = signal<string | null>(null);

  actividad = signal<'bienes' | 'servicios' | null>(null);
  clienteExpandido = signal(false);
  buscandoCliente = signal(false);
  mensajeCliente = signal<string | null>(null);
  mensajeClienteTipo = signal<'success' | 'warning' | 'error'>('success');
  clienteSeleccionado = signal<ClienteLookupResult | null>(null);
  clienteCuitIngresado = signal('');
  _minFecha = signal<string>('');
  _maxFecha = signal<string>('');

  rawMonto = signal('');
  displayMonto = signal('');
  facturasRecientes = signal<FacturaReciente[]>([]);
  cargandoFacturasRecientes = signal(false);

  readonly clienteCuitValido = computed(
    () => sanitizeCuit(this.clienteCuitIngresado()).length === 11,
  );
  readonly tipoComprobanteResolution = computed(() => {
    const contribuyente = this.contribuyenteService.contribuyente();
    return resolveTipoComprobanteDetallado(
      contribuyente?.condicion_iva,
      this.clienteSeleccionado()?.condicion_iva_normalizada,
      contribuyente?.tipo_comprobante_default || 'FACTURA C',
      this.clienteSeleccionado()?.fiscal_profile,
    );
  });
  readonly tipoComprobanteResuelto = computed(() => this.tipoComprobanteResolution().tipo);
  readonly tipoComprobanteResueltoLabel = computed(() =>
    this.tipoComprobanteResuelto().replace('FACTURA', 'FC'),
  );
  readonly condicionClienteLabel = computed(
    () => this.clienteSeleccionado()?.condicion_iva_normalizada || 'Consumidor Final',
  );
  readonly mostrarAlertaCliente = computed(() => {
    const mensaje = this.mensajeCliente();
    const tipoMensaje = this.mensajeClienteTipo();

    if (tipoMensaje === 'error') {
      return Boolean(mensaje);
    }

    if (!this.clienteSeleccionado()) {
      return tipoMensaje === 'warning' && Boolean(mensaje);
    }

    return this.tipoComprobanteResolution().requiereRevision || tipoMensaje === 'warning';
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

  minFecha() {
    return this._minFecha();
  }

  maxFecha() {
    return this._maxFecha();
  }

  constructor() {
    this.formFactura = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01)]],
      fecha: [this.obtenerFechaHoy(), Validators.required],
      cliente_cuit: [''],
    });
    this.clienteCuitIngresado.set(this.formFactura.get('cliente_cuit')?.value || '');

    effect(() => {
      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        this.actualizarLimitesFecha(contribuyente.actividad === 'bienes' ? 'bienes' : 'servicios');
        this.cargarFacturasRecientes();
      } else {
        this.facturasRecientes.set([]);
      }
    });
  }

  toggleCliente() {
    this.clienteExpandido.update((value) => !value);
  }

  async buscarCliente(): Promise<void> {
    const cuit = sanitizeCuit(this.formFactura.get('cliente_cuit')?.value);
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
          ? 'Datos fiscales obtenidos desde Constancia de Inscripcion.'
          : 'Se obtuvo la constancia, pero conviene revisar el resultado automatico.',
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
    const rawValue = this.formFactura.get('cliente_cuit')?.value || '';
    this.clienteCuitIngresado.set(rawValue);
    const cuitIngresado = sanitizeCuit(rawValue);
    if (cuitIngresado !== (this.clienteSeleccionado()?.cuit || '')) {
      this.clienteSeleccionado.set(null);
    }

    if (this.mensajeClienteTipo() === 'error') {
      this.setMensajeCliente(null, 'success');
    }
  }

  private setMensajeCliente(message: string | null, tipo: 'success' | 'warning' | 'error') {
    this.mensajeCliente.set(message);
    this.mensajeClienteTipo.set(tipo);
  }

  private actualizarLimitesFecha(actividad: 'bienes' | 'servicios') {
    this.actividad.set(actividad);

    const hoy = new Date();
    const max = this.formatDateInput(hoy);
    const minDate = new Date(hoy);
    minDate.setDate(hoy.getDate() - (actividad === 'bienes' ? 5 : 10));
    const min = this.formatDateInput(minDate);
    this._maxFecha.set(max);
    this._minFecha.set(min);

    const fechaActual = this.formFactura.get('fecha')?.value;
    if (fechaActual) {
      if (fechaActual > max) {
        this.formFactura.get('fecha')?.setValue(max);
      } else if (fechaActual < min) {
        this.formFactura.get('fecha')?.setValue(min);
      }
    }
  }

  private formatDateInput(date: Date): string {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  }

  private obtenerFechaHoy(): string {
    return this.formatDateInput(new Date());
  }

  private convertirFechaADDMMYYYY(fechaISO: string): string {
    const [anio, mes, dia] = fechaISO.split('-');
    return `${dia}/${mes}/${anio}`;
  }

  async emitirFactura(): Promise<void> {
    if (this.formFactura.invalid) {
      this.formFactura.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.mensaje.set(null);
    this.facturaEmitida.set(null);

    try {
      const { monto, fecha } = this.formFactura.value;
      const fechaFormateada = this.convertirFechaADDMMYYYY(fecha);
      const resultado = await this.facturacionService.emitirFactura({
        monto: Number(monto),
        fecha: fechaFormateada,
        cliente_cuit: this.clienteSeleccionado()?.cuit,
        cliente_nombre: this.clienteSeleccionado()?.nombre,
        cliente_domicilio: this.clienteSeleccionado()?.domicilio,
        cliente_condicion_iva: this.clienteSeleccionado()?.condicion_iva_normalizada,
        cliente_fiscal_profile: this.clienteSeleccionado()?.fiscal_profile,
        tipo_comprobante_resuelto: this.tipoComprobanteResuelto(),
      });

      if (resultado.success) {
        this.esExito.set(true);
        this.mensaje.set(
          `Factura emitida exitosamente. Numero: ${resultado.comprobante.numero_comprobante}`,
        );
        this.facturaEmitida.set(resultado.comprobante);
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
        this.setMensajeCliente(null, 'success');
      } else {
        throw new Error('Error al emitir factura');
      }
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

  obtenerTipoComprobante(factura: any): string {
    if (factura.tipo_comprobante === 'FACTURA A') return 'FC A';
    if (factura.tipo_comprobante === 'FACTURA B') return 'FC B';
    if (factura.tipo_comprobante === 'FACTURA C') return 'FC C';
    return factura.tipo_comprobante || 'FC C';
  }

  obtenerNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1];
    }
    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  obtenerNumeroComprobante(factura: any): string {
    return factura?.numero_comprobante || factura?.numero_factura || '0000-00000000';
  }

  obtenerMontoComprobante(factura: any): number {
    return Number(factura?.total ?? factura?.monto ?? 0);
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

  async cargarFacturasRecientes(): Promise<void> {
    const contribuyente = this.contribuyenteService.contribuyente();
    if (!contribuyente) {
      this.facturasRecientes.set([]);
      return;
    }

    this.cargandoFacturasRecientes.set(true);

    try {
      const { data, error } = await supabase
        .from('comprobantes')
        .select('id, fecha, tipo_comprobante, total, numero_comprobante, created_at')
        .eq('contribuyente_id', contribuyente.id)
        .eq('estado', 'emitida')
        .in('tipo_comprobante', ['FACTURA A', 'FACTURA B', 'FACTURA C'])
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) {
        console.error('Error al cargar facturas recientes:', error);
        this.facturasRecientes.set([]);
        return;
      }

      this.facturasRecientes.set(
        (data || []).map((factura) => ({
          id: factura.id,
          fecha: factura.fecha,
          tipo_comprobante: factura.tipo_comprobante,
          total: Number(factura.total ?? 0),
          numero_comprobante: factura.numero_comprobante,
          created_at: factura.created_at,
        })),
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
    this.formFactura.get('monto')?.setValue(parsedValue ?? '');

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

    return `${formattedIntegerPart},${decimalPart}`;
  }

  async verPDF(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;

    try {
      const asset = await this.pdfService.createPdfAsset(factura);
      this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
      this.pdfViewing.set(factura);
      this.pdfViewingBlobUrl.set(asset.blobUrl);
      this.pdfViewingConfig.set({
        url: asset.blobUrl,
        filename: asset.info.filename,
        title: `Factura ${this.obtenerTipoComprobante(factura)} N ${this.obtenerNumeroSinCeros(this.obtenerNumeroComprobante(factura))}`,
      });
    } catch (error) {
      console.error('Error al generar PDF para visualizacion:', error);
      this.cerrarVisorPdf();
      alert('Hubo un error al generar el ticket.');
    }
  }

  cerrarVisorPdf() {
    this.pdfService.revokeBlobUrl(this.pdfViewingBlobUrl());
    this.pdfViewing.set(null);
    this.pdfViewingBlobUrl.set(null);
    this.pdfViewingConfig.set(null);
  }

  async compartir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    await this.pdfService.sharePdf(this.pdfService.createPdfInfo(factura));
  }

  async imprimir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    await this.pdfService.printFactura(factura);
  }

  async descargar(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;
    await this.pdfService.downloadPdf(this.pdfService.createPdfInfo(factura));
  }

  volver(): void {
    this.facturaEmitida.set(null);
    this.mensaje.set(null);
    this.esExito.set(false);

    setTimeout(() => {
      const montoInput = document.querySelector('#monto') as HTMLInputElement | null;
      montoInput?.focus();
    }, 100);
  }
}
