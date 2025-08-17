import { Component, signal, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TusFacturasService } from '../../core/services/tusfacturas.service';

@Component({
  selector: 'app-facturar',
  template: `
    <div class="max-w-2xl mx-auto space-y-6">
      <div class="text-center">
        <h1 class="text-3xl font-bold text-gray-900">Facturar</h1>
        <p class="text-gray-600 mt-2">
          Emisión de comprobantes a consumidor final
        </p>
      </div>

      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <form [formGroup]="facturaForm" (ngSubmit)="onSubmit()" class="space-y-6">
          <!-- Monto -->
          <div>
            <label for="monto" class="block text-sm font-medium text-gray-700 mb-2">
              Monto Total (IVA incluido)
            </label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
              <input
                #montoInput
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                formControlName="monto"
                class="w-full h-12 pl-8 pr-4 text-lg rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                [class.border-red-300]="facturaForm.get('monto')?.invalid && facturaForm.get('monto')?.touched"
                inputmode="decimal"
              />
            </div>
            @if (facturaForm.get('monto')?.invalid && facturaForm.get('monto')?.touched) {
              <p class="mt-1 text-sm text-red-600">El monto es requerido</p>
            }
          </div>

          <!-- Fecha -->
          <div>
            <label for="fecha" class="block text-sm font-medium text-gray-700 mb-2">
              Fecha de emisión
            </label>
            <input
              type="date"
              formControlName="fecha"
              class="w-full h-10 px-3 py-2 rounded-md border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- Concepto (readonly desde configuración) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Concepto a facturar
            </label>
            <div class="p-3 bg-gray-50 rounded-md border">
              <p class="text-gray-700">{{ conceptoActual() || 'Configurar concepto en Configuración' }}</p>
            </div>
          </div>

          <!-- Tipo de comprobante (readonly desde configuración) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Tipo de comprobante
            </label>
            <div class="p-3 bg-gray-50 rounded-md border">
              <p class="text-gray-700">{{ tipoComprobanteActual() || 'Configurar tipo en Configuración' }}</p>
            </div>
          </div>

          <!-- Estado de configuración -->
          @if (!tusFacturasService.estaConfigurado()) {
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div class="flex">
                <div class="text-amber-600 mr-3">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="text-sm text-amber-700">
                  <p class="font-medium">Configuración requerida</p>
                  <p>Necesitas configurar tu API de TusFacturas antes de emitir facturas.</p>
                </div>
              </div>
            </div>
          }

          <!-- Mensajes de operación -->
          @if (mensajeOperacion()) {
            <div class="p-4 rounded-lg" 
                 [class]="mensajeOperacion()?.tipo === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
              <div class="flex">
                <div class="mr-3">
                  @if (mensajeOperacion()?.tipo === 'success') {
                    <svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                    </svg>
                  } @else {
                    <svg class="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                    </svg>
                  }
                </div>
                <div class="text-sm">
                  <p class="font-medium">{{ mensajeOperacion()?.titulo }}</p>
                  <p>{{ mensajeOperacion()?.mensaje }}</p>
                  @if (mensajeOperacion()?.detalles) {
                    <ul class="mt-2 list-disc list-inside">
                      @for (detalle of mensajeOperacion()?.detalles; track detalle) {
                        <li>{{ detalle }}</li>
                      }
                    </ul>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Errores -->
          @if (error()) {
            <div class="p-4 rounded-md bg-red-50 border border-red-200">
              <p class="text-sm text-red-600">{{ error() }}</p>
            </div>
          }

          <!-- Botón de emisión -->
          <button
            type="submit"
            [disabled]="loading() || facturaForm.invalid || !tusFacturasService.estaConfigurado()"
            class="w-full h-12 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            @if (loading()) {
              <span class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
            }
            {{ loading() ? 'Emitiendo factura...' : 'Emitir Factura' }}
          </button>

          @if (!tusFacturasService.estaConfigurado()) {
            <p class="text-sm text-amber-600 text-center">
              ⚠️ Completar configuración antes de facturar
            </p>
          }
        </form>
      </div>

      <!-- Factura emitida -->
      @if (facturaEmitida()) {
        <div class="bg-green-50 rounded-lg border border-green-200 p-6">
          <div class="text-center space-y-4">
            <div class="text-green-600">
              <svg class="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            
            <div>
              <h3 class="text-lg font-semibold text-green-800">¡Factura emitida exitosamente!</h3>
              <p class="text-green-700">{{ facturaEmitida()?.mensaje }}</p>
            </div>

            @if (facturaEmitida()?.numeroComprobante) {
              <div class="bg-white rounded-md p-4 border">
                <p class="text-sm text-gray-600">Número de comprobante</p>
                <p class="text-lg font-mono font-bold">{{ facturaEmitida()?.numeroComprobante }}</p>
              </div>
            }

            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                (click)="verPDF()"
                class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Ver PDF
              </button>
              <button
                (click)="nuevaFactura()"
                class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Nueva Factura
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [ReactiveFormsModule]
})
export class FacturarComponent {
  private fb = inject(FormBuilder);
  tusFacturasService = inject(TusFacturasService);

  loading = signal(false);
  error = signal<string | null>(null);
  facturaEmitida = signal<any>(null);
  mensajeOperacion = signal<{
    tipo: 'success' | 'error';
    titulo: string;
    mensaje: string;
    detalles?: string[];
  } | null>(null);
  
  // Configuración (se obtendría de la base de datos)
  conceptoActual = signal('Venta de productos/servicios');
  tipoComprobanteActual = signal('Factura C - Monotributista');

  facturaForm: FormGroup;

  constructor() {
    this.facturaForm = this.fb.group({
      monto: ['', [Validators.required, Validators.min(0.01)]],
      fecha: [format(new Date(), 'yyyy-MM-dd'), Validators.required]
    });

    // Cargar configuración al inicio
    this.tusFacturasService.cargarConfiguracion();

    // Auto-focus en el campo monto al cargar
    effect(() => {
      setTimeout(() => {
        const montoInput = document.querySelector('input[formControlName="monto"]') as HTMLInputElement;
        if (montoInput) {
          montoInput.focus();
        }
      }, 100);
    });
  }

  async onSubmit() {
    if (this.facturaForm.invalid) {
      this.facturaForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { monto, fecha } = this.facturaForm.value;
      
      // Simular llamada a TusFacturas API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular respuesta exitosa
      this.facturaEmitida.set({
        mensaje: 'Comprobante emitido y enviado a AFIP',
        numeroComprobante: '0001-00000042',
        cae: '74830150816942',
        monto: monto,
        fecha: fecha
      });

      // Limpiar formulario
      this.facturaForm.patchValue({
        monto: '',
        fecha: format(new Date(), 'yyyy-MM-dd')
      });
      
    } catch (err) {
      this.error.set('Error al emitir la factura. Inténtalo de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  verPDF() {
    // Aquí se abriría el PDF en una nueva ventana o modal
    console.log('Ver PDF de la factura');
  }

  nuevaFactura() {
    this.facturaEmitida.set(null);
    this.error.set(null);
    
    // Re-enfocar el campo monto
    setTimeout(() => {
      const montoInput = document.querySelector('input[formControlName="monto"]') as HTMLInputElement;
      if (montoInput) {
        montoInput.focus();
      }
    }, 100);
  }
}
