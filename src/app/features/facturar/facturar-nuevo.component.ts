import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';

@Component({
  selector: 'app-facturar-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-md mx-auto">
      <div class="card-surface p-6">
        
        <form [formGroup]="formFactura" (ngSubmit)="emitirFactura()" class="space-y-4 sm:space-y-6">
            <!-- Campo Monto -->
            <div>
              <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
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
              <label class="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Fecha de Facturación
              </label>
              <input
                type="date"
                formControlName="fecha"
                class="form-input w-full py-2 px-3"
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
              class="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            <div class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div class="text-center mb-4">
                <h3 class="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">Factura emitida:</h3>
                <div class="text-xl font-bold text-green-800 dark:text-green-200">
                  {{ obtenerTipoComprobante(facturaEmitida()!) }} {{ obtenerNumeroSinCeros(facturaEmitida()!.numero_factura) }} {{ formatearMonto(facturaEmitida()!.monto) }}
                </div>
              </div>
              
              <!-- Botones de acción -->
              <div class="grid grid-cols-2 gap-2 mb-3">
                <button
                  (click)="verPDF()"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Ver
                </button>
                <button
                  (click)="compartir()"
                  class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Compartir
                </button>
                <button
                  (click)="descargar()"
                  class="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Descargar
                </button>
                <button
                  (click)="imprimir()"
                  class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Imprimir
                </button>
              </div>
              
              <!-- Botón Volver -->
              <button
                (click)="volver()"
                class="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
              >
                Volver
              </button>
            </div>
          }

          <!-- Mensaje de Error -->
          @if (mensaje() && !esExito()) {
            <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="text-red-800 text-center">
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

  constructor(
    private fb: FormBuilder,
    private facturacionService: FacturacionService,
    private pdfService: PdfService
  ) {
    // Inicializar formulario
    this.formFactura = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01)]],
      fecha: [this.obtenerFechaHoy(), Validators.required]
    });
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
    console.log('🆕 COMPONENTE ACTUALIZADO - facturar-nuevo.component.ts - BUILD: ' + Date.now());
    
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
      
      console.log('� Fecha original del input:', fecha);
      console.log('📅 Fecha convertida para API:', fechaFormateada);
      console.log('📅 Fecha actual Argentina:', new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }));
      
      console.log('�📋 Datos del formulario:', { monto: parseFloat(monto), fecha: fechaFormateada });

      const resultado = await this.facturacionService.emitirFactura({
        monto: parseFloat(monto),
        fecha: fechaFormateada
      });

      if (resultado.success) {
        console.log('✅ DEBUG - Resultado completo:', resultado);
        console.log('✅ DEBUG - Factura object:', resultado.factura);
        console.log('✅ DEBUG - PDF URL en factura:', resultado.factura?.pdf_url);
        
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
      this.pdfService.openPdf(factura.pdf_url);
    } else {
      alert('PDF no disponible');
    }
  }

  async compartir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura?.pdf_url) {
      alert('PDF no disponible para compartir');
      return;
    }

    try {
      await this.pdfService.sharePdf({
        url: factura.pdf_url,
        filename: `Factura_${this.obtenerTipoComprobante(factura).replace(' ', '')}_${this.obtenerNumeroSinCeros(factura.numero_factura)}.pdf`,
        title: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`,
        text: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)} - ${this.formatearMonto(factura.monto)}`
      });
    } catch (error) {
      console.error('❌ Error compartiendo:', error);
      alert('Error al compartir el PDF');
    }
  }

  async imprimir(): Promise<void> {
    const factura = this.facturaEmitida();
    console.log('🖨️ DEBUG - Factura completa:', factura);
    console.log('🖨️ DEBUG - PDF URL:', factura?.pdf_url);
    console.log('🖨️ DEBUG - Todas las propiedades de factura:', Object.keys(factura || {}));
    console.log('🖨️ DEBUG - Valores de propiedades PDF-related:', {
      pdf_url: factura?.pdf_url,
      comprobante_pdf_url: factura?.comprobante_pdf_url,
      pdf_ticket_url: factura?.pdf_ticket_url,
      comprobante_ticket_url: factura?.comprobante_ticket_url
    });
    
    if (!factura?.pdf_url) {
      alert('PDF no disponible para imprimir');
      return;
    }

    const pdfInfo = {
      url: factura.pdf_url,
      filename: `Factura_${this.obtenerTipoComprobante(factura).replace(' ', '')}_${this.obtenerNumeroSinCeros(factura.numero_factura)}.pdf`,
      title: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`,
      text: `Imprimir Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`
    };
    
    console.log('🖨️ DEBUG - PdfInfo objeto:', pdfInfo);

    try {
      await this.pdfService.printPdf(pdfInfo);
    } catch (error) {
      console.error('❌ Error imprimiendo:', error);
      // Fallback - abrir en nueva ventana
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
      await this.pdfService.downloadPdf({
        url: factura.pdf_url,
        filename: `Factura_${this.obtenerTipoComprobante(factura).replace(' ', '')}_${this.obtenerNumeroSinCeros(factura.numero_factura)}.pdf`,
        title: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`,
        text: `Factura ${this.obtenerTipoComprobante(factura)} N° ${this.obtenerNumeroSinCeros(factura.numero_factura)}`
      });
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
