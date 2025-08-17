import { Component, signal, effect, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TusFacturasService } from '../../core/services/tusfacturas.service';

@Component({
  selector: 'app-facturar',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <!-- Simplified design without duplicate navigation -->
    <div class="space-y-6">
      <!-- Main form -->
      <form [formGroup]="facturaForm" (ngSubmit)="onSubmit()" class="space-y-6">
        <!-- Monto Total Card -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label class="block text-sm font-medium text-gray-700 mb-4">
            Monto Total
          </label>
          
          <div class="relative">
            <input
              #montoInput
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              formControlName="monto"
              class="w-full text-center text-4xl font-light text-gray-500 bg-transparent border-none outline-none focus:text-gray-900 placeholder-gray-300"
              style="appearance: none; -moz-appearance: textfield;"
              inputmode="decimal"
              (focus)="onMontoFocus()"
              (blur)="onMontoBlur()"
            />
          </div>
          
          @if (facturaForm.get('monto')?.invalid && facturaForm.get('monto')?.touched) {
            <p class="mt-2 text-sm text-red-600 text-center">El monto es requerido</p>
          }
        </div>

        <!-- Fecha Card -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label class="block text-sm font-medium text-gray-700 mb-4">
            Fecha
          </label>
          
          <p class="text-sm text-gray-600 mb-4">
            Permitido hasta 10 días atrás según normativa ARCA.
          </p>
          
          <div class="relative">
            <input
              type="date"
              formControlName="fecha"
              class="w-full p-4 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pl-12"
            />
            <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
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
              <div>
                <p class="text-sm font-medium text-amber-800">Configuración requerida</p>
                <p class="text-sm text-amber-700 mt-1">Necesitas configurar tu API de TusFacturas antes de emitir facturas.</p>
              </div>
            </div>
          </div>
        }

        <!-- Errores -->
        @if (error()) {
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-sm text-red-600">{{ error() }}</p>
          </div>
        }

        <!-- Éxito -->
        @if (facturaEmitida()) {
          <div class="bg-green-50 border border-green-200 rounded-lg p-4">
            <div class="flex">
              <div class="text-green-600 mr-3">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
              </div>
              <div>
                <p class="text-sm font-medium text-green-800">¡Factura emitida exitosamente!</p>
                <p class="text-sm text-green-700 mt-1">{{ facturaEmitida()?.mensaje }}</p>
                @if (facturaEmitida()?.numeroComprobante) {
                  <p class="text-sm text-green-700 mt-1">Número: {{ facturaEmitida()?.numeroComprobante }}</p>
                }
              </div>
            </div>
          </div>
        }

        <!-- Botón de emisión -->
        <button
          type="submit"
          [disabled]="loading() || facturaForm.invalid || !tusFacturasService.estaConfigurado()"
          class="w-full h-14 bg-slate-700 text-white font-medium text-lg rounded-lg hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          @if (loading()) {
            <span class="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></span>
          }
          {{ loading() ? 'Emitiendo Factura...' : 'Emitir Factura' }}
        </button>
      </form>
    </div>
  `,
})
export class FacturarComponent implements AfterViewInit {
  @ViewChild('montoInput') montoInputRef!: ElementRef<HTMLInputElement>;
  
  private fb = inject(FormBuilder);
  tusFacturasService = inject(TusFacturasService);

  // Signals
  loading = signal(false);
  error = signal<string | null>(null);
  facturaEmitida = signal<any>(null);

  facturaForm: FormGroup;

  constructor() {
    this.facturaForm = this.fb.group({
      monto: [null, [Validators.required, Validators.min(0.01)]],
      fecha: [format(new Date(), 'yyyy-MM-dd'), Validators.required]
    });

    // Effect para auto-focus después de emitir factura
    effect(() => {
      if (this.facturaEmitida()) {
        setTimeout(() => {
          this.montoInputRef?.nativeElement?.focus();
        }, 100);
      }
    });
  }

  ngAfterViewInit() {
    // Auto-focus en el campo monto al cargar
    setTimeout(() => {
      this.montoInputRef?.nativeElement?.focus();
    }, 100);
  }

  // Eventos del input de monto
  onMontoFocus() {
    const input = this.montoInputRef?.nativeElement;
    if (input && input.value === '0') {
      input.value = '';
      this.facturaForm.get('monto')?.setValue(null);
    }
  }

  onMontoBlur() {
    const input = this.montoInputRef?.nativeElement;
    if (input && !input.value) {
      input.placeholder = '0.00';
    }
  }

  async onSubmit() {
    if (this.facturaForm.invalid || !this.tusFacturasService.estaConfigurado()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.facturaEmitida.set(null);

    try {
      const formData = this.facturaForm.value;
      
      // Usar el método correcto del servicio
      this.tusFacturasService.emitirFacturaConsumidorFinal(
        'Servicios profesionales',
        parseFloat(formData.monto),
        formData.fecha
      ).subscribe({
        next: (resultado) => {
          if (resultado.codigo === 200) {
            this.facturaEmitida.set({
              mensaje: resultado.mensaje,
              numeroComprobante: resultado.comprobante?.numero,
              pdf: resultado.comprobante?.urlPdf
            });
            
            // Limpiar formulario para nueva factura
            this.facturaForm.patchValue({
              monto: null,
              fecha: format(new Date(), 'yyyy-MM-dd')
            });
            
            // Auto-focus para siguiente factura
            setTimeout(() => {
              this.montoInputRef?.nativeElement?.focus();
            }, 1000);
            
          } else {
            this.error.set(resultado.mensaje || 'Error al emitir la factura');
          }
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Error inesperado al emitir la factura');
          this.loading.set(false);
        }
      });
    } catch (err: any) {
      this.error.set(err.message || 'Error inesperado al emitir la factura');
      this.loading.set(false);
    }
  }

  nuevaFactura() {
    this.facturaEmitida.set(null);
    this.error.set(null);
    this.facturaForm.patchValue({
      monto: null,
      fecha: format(new Date(), 'yyyy-MM-dd')
    });
    
    setTimeout(() => {
      this.montoInputRef?.nativeElement?.focus();
    }, 100);
  }

  verPDF() {
    const factura = this.facturaEmitida();
    if (factura?.pdf) {
      window.open(factura.pdf, '_blank');
    }
  }
}
