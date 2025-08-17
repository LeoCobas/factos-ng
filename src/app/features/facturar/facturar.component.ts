import { Component, OnInit, inject, signal, effect, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FacturacionService } from '../../core/services/facturacion.service';
import { ComprobanteEmitido, EstadoFacturacion } from '../../core/types/facturacion.types';

@Component({
  selector: 'app-facturar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 p-4">
      <div class="max-w-md mx-auto">
        <!-- Título -->
        <h1 class="text-3xl font-bold text-gray-900 mb-8 text-center">Facturar</h1>
        
        <!-- Formulario de facturación -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6" 
             [class.opacity-50]="isLoading()">
          <form [formGroup]="facturacionForm" (ngSubmit)="onSubmit()">
            <!-- Campo Monto -->
            <div class="mb-6">
              <label for="monto" class="block text-sm font-medium text-gray-700 mb-2">
                Monto
              </label>
              <div class="relative">
                <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">$</span>
                <input
                  #montoInput
                  id="monto"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="999999.99"
                  formControlName="monto"
                  class="w-full pl-8 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="0,00"
                  [disabled]="isLoading()"
                />
              </div>
              <div class="text-xs text-gray-500 mt-1">
                Máximo 2 decimales
              </div>
            </div>

            <!-- Campo Fecha -->
            <div class="mb-6">
              <label for="fecha" class="block text-sm font-medium text-gray-700 mb-2">
                Fecha
              </label>
              <input
                id="fecha"
                type="date"
                formControlName="fecha"
                class="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                [disabled]="isLoading()"
              />
            </div>

            <!-- Botón Facturar -->
            <button
              type="submit"
              [disabled]="facturacionForm.invalid || isLoading()"
              class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors text-lg"
            >
              @if (isLoading()) {
                <div class="flex items-center justify-center">
                  <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Emitiendo factura...
                </div>
              } @else {
                Emitir Factura
              }
            </button>
          </form>
        </div>

        <!-- Card de Éxito -->
        @if (mostrarExito()) {
          <div class="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 animate-fade-in">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0">
                <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="ml-3 text-lg font-semibold text-green-900">Factura emitida</h3>
            </div>
            
            @if (facturaEmitida()) {
              <div class="bg-white rounded-lg p-4 mb-4">
                <div class="text-center">
                  <div class="text-2xl font-bold text-gray-900 mb-1">
                    {{ formatearTipoYNumero(facturaEmitida()!) }}
                  </div>
                  <div class="text-3xl font-bold text-green-600">
                    {{ formatearMonto(facturaEmitida()!.total) }}
                  </div>
                  <div class="text-sm text-gray-600 mt-1">
                    CAE: {{ facturaEmitida()!.cae }}
                  </div>
                </div>
              </div>

              <!-- Botones de acción -->
              <div class="grid grid-cols-2 gap-3">
                <button
                  (click)="verPDF()"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Ver PDF
                </button>
                <button
                  (click)="compartir()"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Compartir
                </button>
                <button
                  (click)="imprimir()"
                  class="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Imprimir
                </button>
                <button
                  (click)="volver()"
                  class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Volver
                </button>
              </div>
            }
          </div>
        }

        <!-- Card de Error -->
        @if (mostrarError()) {
          <div class="bg-red-50 border border-red-200 rounded-xl p-6 mb-6 animate-fade-in">
            <div class="flex items-center mb-4">
              <div class="flex-shrink-0">
                <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 class="ml-3 text-lg font-semibold text-red-900">Error en la emisión</h3>
            </div>
            
            <div class="bg-white rounded-lg p-4 mb-4">
              <p class="text-red-800 text-center">
                {{ mensajeError() }}
              </p>
            </div>

            <!-- Botones de error -->
            <div class="grid grid-cols-2 gap-3">
              <button
                (click)="reintentar()"
                class="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Reintentar
              </button>
              <button
                (click)="volver()"
                class="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Volver
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    @keyframes fade-in {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .animate-fade-in {
      animation: fade-in 0.3s ease-out;
    }
  `]
})
export class FacturarComponent implements OnInit {
  @ViewChild('montoInput') montoInput!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  private facturacionService = inject(FacturacionService);
  
  // Señales para el estado del componente
  public isLoading = signal(false);
  public facturaEmitida = signal<ComprobanteEmitido | null>(null);
  public mensajeError = signal<string>('');
  
  // Estados computados
  public mostrarExito = signal(false);
  public mostrarError = signal(false);
  
  // Formulario reactivo
  public facturacionForm: FormGroup;

  constructor() {
    // Crear formulario con validaciones
    this.facturacionForm = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01), Validators.max(999999.99)]],
      fecha: [this.obtenerFechaHoy(), [Validators.required]]
    });

    // Effect para sincronizar con el servicio de facturación
    effect(() => {
      const estado = this.facturacionService.estadoFacturacion();
      const resultado = this.facturacionService.ultimoResultado();
      
      this.isLoading.set(estado === 'loading');
      
      if (estado === 'success' && resultado?.factura) {
        this.facturaEmitida.set(resultado.factura);
        this.mostrarExito.set(true);
        this.mostrarError.set(false);
        this.mensajeError.set('');
      } else if (estado === 'error' && resultado?.error) {
        this.facturaEmitida.set(null);
        this.mostrarExito.set(false);
        this.mostrarError.set(true);
        this.mensajeError.set(resultado.error);
      }
    });
  }

  ngOnInit(): void {
    // Enfocar el campo monto al cargar
    setTimeout(() => {
      this.montoInput?.nativeElement?.focus();
    }, 100);
  }

  /**
   * Maneja el envío del formulario
   */
  async onSubmit(): Promise<void> {
    if (this.facturacionForm.invalid || this.isLoading()) {
      return;
    }

    const formValues = this.facturacionForm.value;
    
    // Validar monto con máximo 2 decimales
    const monto = parseFloat(formValues.monto);
    if (isNaN(monto) || monto <= 0) {
      this.mostrarErrorPersonalizado('El monto debe ser mayor a 0');
      return;
    }

    // Verificar decimales
    const montoStr = monto.toString();
    const decimales = montoStr.includes('.') ? montoStr.split('.')[1] : '';
    if (decimales.length > 2) {
      this.mostrarErrorPersonalizado('El monto no puede tener más de 2 decimales');
      return;
    }

    // Preparar datos para facturación
    const datosFacturacion = {
      monto: Math.round(monto * 100) / 100, // Asegurar 2 decimales máximo
      fecha: formValues.fecha
    };

    // Emitir factura
    await this.facturacionService.emitirFactura(datosFacturacion);
  }

  /**
   * Muestra un error personalizado
   */
  private mostrarErrorPersonalizado(mensaje: string): void {
    this.mensajeError.set(mensaje);
    this.mostrarError.set(true);
    this.mostrarExito.set(false);
    this.facturaEmitida.set(null);
  }

  /**
   * Abre el PDF de la factura
   */
  async verPDF(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura || !factura.url_pdf) {
      return;
    }

    try {
      // Abrir PDF usando pdf-proxy
      const pdfUrl = `/functions/v1/pdf-proxy?url=${encodeURIComponent(factura.url_pdf)}`;
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error abriendo PDF:', error);
      this.mostrarErrorPersonalizado('Error al abrir el PDF');
    }
  }

  /**
   * Comparte la factura
   */
  async compartir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura) return;

    const texto = `Factura ${this.formatearTipoYNumero(factura)} por ${this.formatearMonto(factura.total)}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Factura Electrónica',
          text: texto,
          url: factura.url_pdf || ''
        });
      } catch (error) {
        console.log('Compartir cancelado por el usuario');
      }
    } else {
      // Fallback para navegadores sin Web Share API
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        alert('Información copiada al portapapeles');
      }
    }
  }

  /**
   * Imprime la factura
   */
  async imprimir(): Promise<void> {
    const factura = this.facturaEmitida();
    if (!factura || !factura.url_pdf) {
      return;
    }

    try {
      // Crear iframe oculto para imprimir
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = `/functions/v1/pdf-proxy?url=${encodeURIComponent(factura.url_pdf)}`;
      
      document.body.appendChild(iframe);
      
      iframe.onload = () => {
        try {
          iframe.contentWindow?.print();
        } catch (error) {
          console.error('Error imprimiendo:', error);
          // Fallback: abrir en nueva ventana
          window.open(iframe.src, '_blank');
        }
        // Remover iframe después de un tiempo
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      };
    } catch (error) {
      console.error('Error en imprimir:', error);
      this.mostrarErrorPersonalizado('Error al imprimir');
    }
  }

  /**
   * Vuelve al formulario y resetea estados
   */
  volver(): void {
    this.facturacionService.resetearEstado();
    this.mostrarExito.set(false);
    this.mostrarError.set(false);
    this.facturaEmitida.set(null);
    this.mensajeError.set('');
    
    // Limpiar monto y enfocar
    this.facturacionForm.patchValue({ monto: '' });
    setTimeout(() => {
      this.montoInput?.nativeElement?.focus();
    }, 100);
  }

  /**
   * Reintenta la facturación con los mismos datos
   */
  async reintentar(): Promise<void> {
    this.mostrarError.set(false);
    this.mensajeError.set('');
    await this.onSubmit();
  }

  /**
   * Obtiene la fecha de hoy en formato YYYY-MM-DD
   */
  private obtenerFechaHoy(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Formatea el tipo y número de comprobante
   */
  formatearTipoYNumero(factura: ComprobanteEmitido): string {
    const numero = this.facturacionService.formatearNumeroComprobante(factura.numero);
    return `${factura.tipo} ${numero}`;
  }

  /**
   * Formatea el monto como moneda argentina
   */
  formatearMonto(monto: number): string {
    return this.facturacionService.formatearMonto(monto);
  }
}
