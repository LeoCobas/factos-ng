import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FacturacionService } from '../../core/services/facturacion.service';

@Component({
  selector: 'app-facturar-nuevo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="max-w-md mx-auto">
      <div class="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        
        <form [formGroup]="formFactura" (ngSubmit)="emitirFactura()" class="space-y-4 sm:space-y-6">
            <!-- Campo Monto -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-4">
                Monto Total
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                formControlName="monto"
                class="w-full text-2xl sm:text-3xl text-center py-2 sm:py-4 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                [class.border-red-500]="formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched"
              />
              @if (formFactura.get('monto')?.invalid && formFactura.get('monto')?.touched) {
                <p class="text-red-500 text-sm mt-1">El monto es requerido y debe ser mayor a 0</p>
              }
            </div>

            <!-- Campo Fecha -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-4">
                Fecha de Facturación
              </label>
              <input
                type="date"
                formControlName="fecha"
                class="w-full py-2 px-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <div class="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div class="text-center mb-4">
                <h3 class="text-lg font-semibold text-green-900 mb-2">Factura emitida:</h3>
                <div class="text-xl font-bold text-green-800">
                  {{ obtenerTipoComprobante(facturaEmitida()!) }} {{ obtenerNumeroSinCeros(facturaEmitida()!.numero_factura) }} {{ formatearMonto(facturaEmitida()!.monto) }}
                </div>
              </div>
              
              <!-- Botones de acción -->
              <div class="grid grid-cols-2 gap-2">
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
                  (click)="imprimir()"
                  class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Imprimir
                </button>
                <button
                  (click)="volver()"
                  class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
                >
                  Volver
                </button>
              </div>
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
    private facturacionService: FacturacionService
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
    console.log('🆕 USANDO EL NUEVO COMPONENTE - facturar-nuevo.component.ts');
    
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
      window.open(factura.pdf_url, '_blank');
    } else {
      alert('PDF no disponible');
    }
  }

  compartir(): void {
    const factura = this.facturaEmitida();
    if (!factura) return;

    const texto = `Factura ${this.obtenerTipoComprobante(factura)} ${this.obtenerNumeroSinCeros(factura.numero_factura)} - ${this.formatearMonto(factura.monto)}`;
    
    // Verificar si Web Share API está disponible
    if (navigator.share) {
      if (factura.pdf_url) {
        // Intentar compartir la URL del PDF
        navigator.share({
          title: 'Factura Emitida',
          text: texto,
          url: factura.pdf_url
        }).catch((error) => {
          console.log('Error sharing:', error);
          this.fallbackShare(texto, factura.pdf_url);
        });
      } else {
        navigator.share({
          title: 'Factura Emitida',
          text: texto
        }).catch((error) => {
          console.log('Error sharing:', error);
          this.fallbackShare(texto);
        });
      }
    } else if (navigator.share) {
      // Web Share API disponible pero sin canShare
      navigator.share({
        title: 'Factura Emitida',
        text: texto,
        url: factura.pdf_url || window.location.href
      }).catch((error) => {
        console.log('Error sharing:', error);
        this.fallbackShare(texto, factura.pdf_url);
      });
    } else {
      this.fallbackShare(texto, factura.pdf_url);
    }
  }

  private fallbackShare(texto: string, url?: string): void {
    // Fallback: copiar al portapapeles
    const textoCompleto = url ? `${texto}\n${url}` : texto;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textoCompleto).then(() => {
        alert('Información copiada al portapapeles');
      }).catch(() => {
        this.showShareInfo(textoCompleto);
      });
    } else {
      this.showShareInfo(textoCompleto);
    }
  }

  private showShareInfo(texto: string): void {
    // Mostrar información en un modal o alert simple
    alert('Información de la factura:\n' + texto);
  }

  imprimir(): void {
    const factura = this.facturaEmitida();
    if (!factura?.pdf_url) {
      alert('PDF no disponible para imprimir');
      return;
    }

    // Detectar si estamos en Android
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    if (isAndroid) {
      // En Android, usar Web Share API para compartir con aplicaciones de impresión
      if (navigator.share) {
        navigator.share({
          title: 'Imprimir Factura',
          text: `Factura ${this.obtenerTipoComprobante(factura)} ${this.obtenerNumeroSinCeros(factura.numero_factura)}`,
          url: factura.pdf_url
        }).then(() => {
          console.log('PDF compartido para impresión');
        }).catch((error) => {
          console.log('Error al compartir para impresión:', error);
          // Fallback: abrir PDF en nueva pestaña
          this.abrirPDFParaImprimir(factura.pdf_url);
        });
      } else {
        // Fallback: abrir PDF en nueva pestaña con instrucciones
        this.abrirPDFParaImprimir(factura.pdf_url);
      }
    } else {
      // En desktop, usar el método tradicional con iframe
      this.imprimirEnDesktop(factura.pdf_url);
    }
  }

  private abrirPDFParaImprimir(pdfUrl: string): void {
    window.open(pdfUrl, '_blank');
    // Mostrar instrucciones para Android
    setTimeout(() => {
      alert('PDF abierto. Usa el menú de 3 puntos en Chrome y selecciona "Imprimir" o "Compartir" para enviar a una impresora.');
    }, 1000);
  }

  private imprimirEnDesktop(pdfUrl: string): void {
    // Crear iframe oculto para imprimir PDF en desktop
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = pdfUrl;
    document.body.appendChild(iframe);
    
    iframe.onload = () => {
      try {
        // Intentar imprimir directamente
        iframe.contentWindow?.print();
      } catch (error) {
        console.log('No se pudo imprimir automáticamente:', error);
        // Fallback: abrir en nueva ventana
        window.open(pdfUrl, '_blank');
      }
      // Remover iframe después de un tiempo
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    iframe.onerror = () => {
      // Si hay error cargando el iframe, abrir en nueva ventana
      window.open(pdfUrl, '_blank');
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    };
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
