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

          <!-- Mensajes de estado -->
          @if (mensaje()) {
            <div class="mt-4 p-4 rounded-md"
                 [class.bg-green-50]="esExito()"
                 [class.text-green-800]="esExito()"
                 [class.bg-red-50]="!esExito()"
                 [class.text-red-800]="!esExito()">
              {{ mensaje() }}
            </div>
          }

          <!-- Detalles de factura exitosa -->
          @if (facturaEmitida()) {
            <div class="mt-6 p-4 bg-gray-50 rounded-md">
              <h3 class="text-lg font-semibold mb-2">✅ Factura Emitida</h3>
              <div class="space-y-1 text-sm">
                <p><strong>Número:</strong> {{ facturaEmitida()?.numero_factura }}</p>
                <p><strong>CAE:</strong> {{ facturaEmitida()?.cae }}</p>
                <p><strong>Vencimiento CAE:</strong> {{ facturaEmitida()?.cae_vto }}</p>
                <p><strong>Monto:</strong> \${{ facturaEmitida()?.monto }}</p>
                @if (facturaEmitida()?.pdf_url) {
                  <div class="mt-2">
                    <a [href]="facturaEmitida()?.pdf_url" target="_blank" 
                       class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                      Ver PDF
                    </a>
                  </div>
                }
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
}
