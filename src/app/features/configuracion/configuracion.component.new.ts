import { Component, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { supabase } from '../../core/services/supabase.service';

interface ConfigForm {
  concepto: string;
  actividad: 'bienes' | 'servicios';
  iva_porcentaje: string;
  punto_venta: string;
  cuit: string;
  razon_social: string;
  api_token: string;
  api_key: string;
  user_token: string;
  tipo_comprobante_default: 'FACTURA B' | 'FACTURA C';
}

interface ConfiguracionRow {
  id: string;
  concepto: string;
  actividad: 'bienes' | 'servicios';
  iva_porcentaje: number;
  punto_venta: number;
  cuit: string;
  razon_social: string;
  api_token: string;
  api_key: string;
  user_token: string;
  tipo_comprobante_default?: 'FACTURA B' | 'FACTURA C';
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
        <h2 class="text-2xl font-bold text-gray-900">Configuración de Facturación</h2>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="text-gray-500 ml-4">Cargando configuración...</p>
        </div>
      } @else {
        <form [formGroup]="configForm" (ngSubmit)="onSubmit()" class="space-y-6">
          
          <!-- Configuración de Facturación -->
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Configuración de Facturación</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <!-- Concepto a facturar -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Concepto a facturar</label>
                <input
                  type="text"
                  formControlName="concepto"
                  placeholder="Honorarios Profesionales"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-500]="configForm.get('concepto')?.invalid && configForm.get('concepto')?.touched"
                >
                @if (configForm.get('concepto')?.invalid && configForm.get('concepto')?.touched) {
                  <p class="text-sm text-red-500">El concepto es requerido</p>
                }
              </div>

              <!-- IVA -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">IVA</label>
                <select 
                  formControlName="iva_porcentaje"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleccionar IVA</option>
                  <option value="21.00">21%</option>
                  <option value="10.50">10.5%</option>
                </select>
              </div>

              <!-- Actividad -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Actividad</label>
                <select 
                  formControlName="actividad"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleccionar actividad</option>
                  <option value="bienes">Bienes (-5 días)</option>
                  <option value="servicios">Servicios (-10 días)</option>
                </select>
                <p class="text-xs text-gray-500">
                  Determina cuántos días hacia atrás se pueden emitir facturas
                </p>
              </div>

            </div>
          </div>

          <!-- Datos del Negocio -->
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Datos del Negocio</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <!-- Punto de Venta -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Punto de Venta</label>
                <input
                  type="number"
                  formControlName="punto_venta"
                  min="1"
                  max="99"
                  placeholder="4"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-500]="configForm.get('punto_venta')?.invalid && configForm.get('punto_venta')?.touched"
                >
                @if (configForm.get('punto_venta')?.invalid && configForm.get('punto_venta')?.touched) {
                  <p class="text-sm text-red-500">El punto de venta es requerido</p>
                }
              </div>

              <!-- CUIT -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">CUIT</label>
                <input
                  type="text"
                  formControlName="cuit"
                  maxlength="11"
                  placeholder="27332731667"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-500]="configForm.get('cuit')?.invalid && configForm.get('cuit')?.touched"
                >
                @if (configForm.get('cuit')?.invalid && configForm.get('cuit')?.touched) {
                  <p class="text-sm text-red-500">El CUIT debe tener exactamente 11 dígitos</p>
                }
              </div>

              <!-- Razón Social -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Razón Social</label>
                <input
                  type="text"
                  formControlName="razon_social"
                  placeholder="PAULA GUADALUPE PIZARRO SALGUEI"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  [class.border-red-500]="configForm.get('razon_social')?.invalid && configForm.get('razon_social')?.touched"
                >
                @if (configForm.get('razon_social')?.invalid && configForm.get('razon_social')?.touched) {
                  <p class="text-sm text-red-500">La razón social es requerida</p>
                }
              </div>

            </div>
          </div>

          <!-- Datos API TusFacturas.app -->
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900">Datos API TusFacturas.app</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <!-- Tipo de Comprobante -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">Tipo de Comprobante</label>
                <select 
                  formControlName="tipo_comprobante_default"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Seleccionar tipo</option>
                  <option value="FACTURA B">Factura C / Nota de Crédito C (Responsable Inscripto)</option>
                  <option value="FACTURA C">Factura C / Nota de Crédito C (Monotributista)</option>
                </select>
              </div>

              <!-- API Token -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">API Token</label>
                <div class="relative">
                  <input
                    [type]="mostrarApiToken() ? 'text' : 'password'"
                    formControlName="api_token"
                    placeholder="Token alfanumérico"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    [class.border-red-500]="configForm.get('api_token')?.invalid && configForm.get('api_token')?.touched"
                  >
                  <button
                    type="button"
                    (click)="mostrarApiToken.set(!mostrarApiToken())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarApiToken()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('api_token')?.invalid && configForm.get('api_token')?.touched) {
                  <p class="text-sm text-red-500">El API Token es requerido</p>
                }
              </div>

              <!-- API Key -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">API Key</label>
                <div class="relative">
                  <input
                    [type]="mostrarApiKey() ? 'text' : 'password'"
                    formControlName="api_key"
                    placeholder="Clave numérica"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    [class.border-red-500]="configForm.get('api_key')?.invalid && configForm.get('api_key')?.touched"
                  >
                  <button
                    type="button"
                    (click)="mostrarApiKey.set(!mostrarApiKey())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarApiKey()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('api_key')?.invalid && configForm.get('api_key')?.touched) {
                  <p class="text-sm text-red-500">La API Key es requerida</p>
                }
              </div>

              <!-- User Token -->
              <div class="space-y-2">
                <label class="block text-sm font-medium text-gray-700">User Token</label>
                <div class="relative">
                  <input
                    [type]="mostrarUserToken() ? 'text' : 'password'"
                    formControlName="user_token"
                    placeholder="Token alfanumérico del usuario"
                    class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    [class.border-red-500]="configForm.get('user_token')?.invalid && configForm.get('user_token')?.touched"
                  >
                  <button
                    type="button"
                    (click)="mostrarUserToken.set(!mostrarUserToken())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarUserToken()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('user_token')?.invalid && configForm.get('user_token')?.touched) {
                  <p class="text-sm text-red-500">El User Token es requerido</p>
                }
              </div>

            </div>
          </div>

          <!-- Mensaje de estado -->
          @if (mensaje()) {
            <div class="p-4 rounded-lg border" 
                 [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'">
              {{ mensaje()?.texto }}
            </div>
          }

          <!-- Botón guardar -->
          <button 
            type="submit"
            [disabled]="configForm.invalid || guardando()"
            class="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            {{ guardando() ? 'Guardando...' : 'Guardar Configuración' }}
          </button>

        </form>
      }
    </div>
  `,
  imports: [ReactiveFormsModule]
})
export class ConfiguracionComponent implements OnInit {
  private fb = inject(FormBuilder);

  // Estados
  cargando = signal(false);
  guardando = signal(false);
  mensaje = signal<{ texto: string; tipo: 'success' | 'error' } | null>(null);
  mostrarApiToken = signal(false);
  mostrarApiKey = signal(false);
  mostrarUserToken = signal(false);

  // Formulario
  configForm: FormGroup;

  constructor() {
    this.configForm = this.fb.group({
      concepto: ['', Validators.required],
      iva_porcentaje: ['', Validators.required],
      actividad: ['', Validators.required],
      punto_venta: ['', [Validators.required, Validators.min(1), Validators.max(99)]],
      cuit: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
      razon_social: ['', Validators.required],
      tipo_comprobante_default: ['', Validators.required],
      api_token: ['', Validators.required],
      api_key: ['', Validators.required],
      user_token: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  async cargarConfiguracion(): Promise<void> {
    this.cargando.set(true);
    
    try {
      const { data, error } = await supabase
        .from('configuracion')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) {
        this.mostrarMensaje('No se pudo cargar la configuración.', 'error');
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as ConfiguracionRow;
      if (row) {
        this.configForm.patchValue({
          concepto: row.concepto,
          iva_porcentaje: Number(row.iva_porcentaje).toFixed(2),
          actividad: row.actividad,
          punto_venta: row.punto_venta.toString(),
          cuit: row.cuit,
          razon_social: row.razon_social,
          tipo_comprobante_default: row.tipo_comprobante_default || 'FACTURA B',
          api_token: row.api_token,
          api_key: row.api_key,
          user_token: row.user_token
        });
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
      this.mostrarMensaje('Ocurrió un error inesperado.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.configForm.invalid) return;

    this.guardando.set(true);
    
    try {
      // Obtener configuración existente
      const { data: existentes, error: readErr } = await supabase
        .from('configuracion')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (readErr) {
        throw readErr;
      }

      const formData = this.configForm.value;
      const payload = {
        concepto: formData.concepto,
        actividad: formData.actividad,
        iva_porcentaje: parseFloat(formData.iva_porcentaje),
        punto_venta: parseInt(formData.punto_venta),
        cuit: formData.cuit,
        razon_social: formData.razon_social,
        api_token: formData.api_token,
        api_key: formData.api_key,
        user_token: formData.user_token,
        tipo_comprobante_default: formData.tipo_comprobante_default
      };

      let error;
      if (existentes && existentes.length > 0) {
        // Actualizar configuración existente
        const id = existentes[0].id;
        const { error: updErr } = await supabase
          .from('configuracion')
          .update(payload)
          .eq('id', id);
        error = updErr;
      } else {
        // Insertar nueva configuración
        const { error: insErr } = await supabase
          .from('configuracion')
          .insert(payload);
        error = insErr;
      }

      if (error) {
        this.mostrarMensaje('No se pudo guardar la configuración.', 'error');
        return;
      }

      this.mostrarMensaje('Configuración guardada correctamente.', 'success');
      await this.cargarConfiguracion();

    } catch (error) {
      console.error('Error al guardar configuración:', error);
      this.mostrarMensaje('Ocurrió un error inesperado.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrarMensaje(texto: string, tipo: 'success' | 'error'): void {
    this.mensaje.set({ texto, tipo });
    setTimeout(() => this.mensaje.set(null), 5000);
  }
}
