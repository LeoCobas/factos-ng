import { Component, signal } from '@angular/core';
import { PdfViewerComponent, PdfViewerConfig } from '../../shared/components/ui/pdf-viewer.component';
import { supabase } from '../../core/services/supabase.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { PdfJsPrintService } from '../../core/services/pdfjs-print.service';

@Component({
  selector: 'app-facturar-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PdfViewerComponent],
  template: `
    <div class="max-w-md mx-auto">
      <div class="card-surface p-6">
        
        <form [formGroup]="formFactura" (ngSubmit)="emitirFactura()" class="space-y-4 sm:space-y-6">
            <!-- Campo Monto -->
            <div>
              <label class="block text-sm font-medium text-foreground mb-4">
                Monto Total
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                formControlName="monto"
                class="form-input w-full text-2xl sm:text-3xl text-center py-2 sm:py-4 px-3"
                [class.border-red-500]="formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched"
              />
              @if (formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched) {
                <p class="text-red-500 text-sm mt-1">El monto es requerido y debe ser mayor a 0</p>
              }
            </div>

            <!-- Campo Fecha -->
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
                [class.border-red-500]="formFactura.get('fecha')?.invalid && formFactura.get('fecha')?.touched"
              />
              @if (formFactura.get('fecha')?.invalid && formFactura.get('fecha')?.touched) {
                <p class="text-red-500 text-sm mt-1">La fecha es requerida</p>
              }
            </div>

            <!-- Botón Enviar -->
            <button
              type="submit"
              [disabled]="isSubmitting() || formFactura.invalid"
              class="btn-primary w-full py-3 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (isSubmitting()) {
                <span>Procesando...</span>
              } @else {
                <span>Emitir Factura</span>
              }
            </button>
          </form>

          <!-- Card de Factura Emitida -->
          @if (facturaEmitida()) {
            <div class="mt-4 p-4 card-factura-emitida">
              <div class="text-center mb-4">
                <h3 class="text-lg font-semibold mb-2">Factura emitida:</h3>
                <div class="text-xl font-bold text-primary">
                  {{ obtenerTipoComprobante(facturaEmitida()!) }} {{ obtenerNumeroSinCeros(facturaEmitida()!.numero_factura) }} {{ formatearMonto(facturaEmitida()!.monto) }}
                </div>
              </div>
              <!-- Botones de acción - Grid completo con 4 botones -->
              <div class="grid grid-cols-2 gap-2 mb-3">
                <button (click)="verPDF()" class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">Ver</button>
                <button (click)="compartir()" class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">Compartir</button>
                <button (click)="descargar()" class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">Descargar</button>
                <button (click)="imprimir()" class="btn-primary font-medium py-2 px-3 rounded-lg transition-colors text-sm">Imprimir</button>
              </div>
              <!-- Botón Volver -->
              <button (click)="volver()" class="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium py-2 px-3 rounded-lg transition-colors text-sm">Volver</button>
            </div>
          }

          <!-- Modal visor PDF -->
          @if (pdfViewing() && pdfViewingConfig()) {
            <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" (click)="cerrarVisorPdf()">
              <div class="bg-card rounded-lg w-full max-w-2xl h-full max-h-[95vh] flex flex-col shadow-2xl overflow-hidden" (click)="$event.stopPropagation()">
                <app-pdf-viewer [config]="pdfViewingConfig()!" (closeRequested)="cerrarVisorPdf()"></app-pdf-viewer>
              </div>
            </div>
          }

          <!-- Mensaje de Error -->
          @if (mensaje() && !esExito()) {
            <div class="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <div class="text-destructive text-center">
                {{ mensaje() }}
              </div>
            </div>
          }
        </div>
      </div>
  `
})
export class FacturarNuevoComponent {
  formFactura: FormGroup;
  isSubmitting = signal(false);
  mensaje = signal<string | null>(null);
  esExito = signal(false);
  facturaEmitida = signal<any>(null);

  // Signals para visor PDF
  pdfViewing = signal<any>(null);
  pdfViewingConfig = signal<PdfViewerConfig | null>(null);

  // Signals para actividad y límites de fecha
  actividad = signal<'bienes' | 'servicios' | null>(null);
  _minFecha = signal<string>('');
  _maxFecha = signal<string>('');

  minFecha() { return this._minFecha(); }
  maxFecha() { return this._maxFecha(); }

  constructor(
    private fb: FormBuilder,
    private facturacionService: FacturacionService,
    private pdfService: PdfService,
    private pdfJsPrintService: PdfJsPrintService
  ) {
    // Inicializar formulario
    this.formFactura = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01)]],
      fecha: [this.obtenerFechaHoy(), Validators.required]
    });

    // Obtener configuración y setear límites de fecha
    this.cargarConfiguracionYLimites();
  }

  private async cargarConfiguracionYLimites() {
    // Obtener configuración más reciente
    const { data: config, error } = await supabase
      .from('configuracion')
      .select('actividad')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let actividad: 'bienes' | 'servicios' = 'bienes';
    if (!error && config && (config.actividad === 'bienes' || config.actividad === 'servicios')) {
      actividad = config.actividad;
    }
    this.actividad.set(actividad);

    // Calcular límites
    const hoy = new Date();
    const max = this.formatDateInput(hoy);
    let minDate = new Date(hoy);
    minDate.setDate(hoy.getDate() - (actividad === 'bienes' ? 5 : 10));
    const min = this.formatDateInput(minDate);
    this._maxFecha.set(max);
    this._minFecha.set(min);

    // Si la fecha actual del form está fuera de rango, ajustarla
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
    const año = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const dia = String(date.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`;
  }

  private obtenerFechaHoy(): string {
    // Obtener fecha actual en zona horaria local (Argentina)
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${año}-${mes}-${dia}`; // formato YYYY-MM-DD para input date
  }

  private convertirFechaADDMMYYYY(fechaISO: string): string {
    // Crear fecha sin problemas de zona horaria
    const [año, mes, dia] = fechaISO.split('-');
    
    // Validar que tenemos una fecha válida
    const fecha = new Date(parseInt(año), parseInt(mes) - 1, parseInt(dia));
    
    // Formatear como DD/MM/YYYY
    const diaFormateado = String(fecha.getDate()).padStart(2, '0');
    const mesFormateado = String(fecha.getMonth() + 1).padStart(2, '0');
    const añoFormateado = fecha.getFullYear();
    
    return `${diaFormateado}/${mesFormateado}/${añoFormateado}`;
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
      // Convertir fecha a formato DD/MM/YYYY que espera la API
      const fechaFormateada = this.convertirFechaADDMMYYYY(fecha);
      const resultado = await this.facturacionService.emitirFactura({
        monto: parseFloat(monto),
        fecha: fechaFormateada
      });
      if (resultado.success) {
        this.esExito.set(true);
        this.mensaje.set(`¡Factura emitida exitosamente! Número: ${resultado.factura.numero_factura}`);
        this.facturaEmitida.set(resultado.factura);
        // Limpiar formulario
        this.formFactura.reset({
          monto: '',
          fecha: this.obtenerFechaHoy()
        });
      } else {
        throw new Error('Error al emitir factura');
      }
    } catch (error) {
      console.error('❌ Error al emitir factura:', error);
      this.esExito.set(false);
      this.mensaje.set(error instanceof Error ? error.message : 'Error desconocido al emitir factura');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // Métodos para formatear datos de la factura
  obtenerTipoComprobante(factura: any): string {
    if (factura.tipo_comprobante === 'FACTURA B') {
      return 'FC B';
    }
    if (factura.tipo_comprobante === 'FACTURA C') {
      return 'FC C';
    }
    return factura.tipo_comprobante || 'FC B';
  }

  obtenerNumeroSinCeros(numeroCompleto: string): string {
    if (numeroCompleto?.includes('-')) {
      return numeroCompleto.split('-')[1];
    }
    return numeroCompleto?.replace(/^0+/, '') || '0';
  }

  formatearMonto(monto: number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto);
  }

  // Métodos para los botones de acción
  verPDF(): void {
    const factura = this.facturaEmitida();
    if (factura?.pdf_url) {
      this.pdfViewing.set(factura);
      this.pdfViewingConfig.set({
        url: factura.pdf_url,
        filename: `Factura_${this.obtenerTipoComprobante(factura).replace(' ', '')}_${this.obtenerNumeroSinCeros(factura.numero_factura)}.pdf`,
        title: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`
      });
    } else {
      alert('PDF no disponible');
    }
  }

  cerrarVisorPdf() {
    this.pdfViewing.set(null);
    this.pdfViewingConfig.set(null);
  }


  async compartir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura?.pdf_url) {
      alert('PDF no disponible para compartir');
      return;
    }

    try {
      const pdfInfo = this.pdfService.createPdfInfo(factura);
      await this.pdfService.sharePdf(pdfInfo);
    } catch (error) {
      console.error('❌ Error compartiendo:', error);
      alert('Error al compartir el PDF');
    }
  }

  async imprimir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura?.pdf_url) {
      alert('PDF no disponible para imprimir');
      return;
    }
    
    try {
      const printOptions = {
        url: factura.pdf_url,
        filename: `Factura_${this.obtenerTipoComprobante(factura).replace(' ', '')}_${this.obtenerNumeroSinCeros(factura.numero_factura)}.pdf`,
        title: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`
      };
      await this.pdfJsPrintService.printPdfDirect(printOptions);
    } catch (error) {
      // Último recurso: abrir en nueva ventana
      window.open(factura.pdf_url, '_blank');
    }
  }

  async descargar(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura?.pdf_url) {
      alert('PDF no disponible');
      return;
    }

    try {
      const pdfInfo = this.pdfService.createPdfInfo(factura);
      await this.pdfService.downloadPdf(pdfInfo);
    } catch (error) {
      console.error('❌ Error descargando:', error);
      // Fallback - abrir URL original
      window.open(factura.pdf_url, '_blank');
    }
  }

  volver(): void {
    // Ocultar la card de éxito
    this.facturaEmitida.set(null);
    this.mensaje.set(null);
    this.esExito.set(false);
    
    // Enfocar el campo monto para continuar facturando
    setTimeout(() => {
      const montoInput = document.querySelector('#monto') as HTMLInputElement;
      if (montoInput) {
        montoInput.focus();
      }
    }, 100);
  }
}
