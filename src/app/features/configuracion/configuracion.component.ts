import { Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TusFacturasService, TusFacturasConfig, ConfiguracionEmpresa } from '../../core/services/tusfacturas.service';

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Configuración</h1>
        <p class="text-gray-600 mt-1">
          Configuración de la aplicación y datos de la empresa
        </p>
      </div>

      <!-- Estado de conexión -->
      @if (tusFacturasService.estaConfigurado()) {
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-3 h-3 rounded-full" 
                   [class]="tusFacturasService.conectado() ? 'bg-green-500' : 'bg-red-500'">
              </div>
              <span class="text-sm font-medium">
                {{ tusFacturasService.conectado() ? 'Conectado a TusFacturas' : 'Sin conexión' }}
              </span>
            </div>
            @if (tusFacturasService.ultimaVerificacion()) {
              <span class="text-xs text-gray-500">
                Última verificación: {{ tusFacturasService.ultimaVerificacion() | date:'short' }}
              </span>
            }
          </div>
        </div>
      }

      <!-- Configuración de TusFacturas -->
      <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 class="text-xl font-semibold text-gray-900 mb-4">TusFacturas API</h2>
        
        <form [formGroup]="apiForm" (ngSubmit)="guardarAPI()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Usuario
            </label>
            <input 
              type="text" 
              formControlName="usuario"
              placeholder="usuario@ejemplo.com"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              [class.border-red-500]="apiForm.get('usuario')?.invalid && apiForm.get('usuario')?.touched"
            >
            @if (apiForm.get('usuario')?.invalid && apiForm.get('usuario')?.touched) {
              <p class="text-red-500 text-xs mt-1">Usuario requerido</p>
            }
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input 
              type="password" 
              formControlName="password"
              placeholder="••••••••"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              [class.border-red-500]="apiForm.get('password')?.invalid && apiForm.get('password')?.touched"
            >
            @if (apiForm.get('password')?.invalid && apiForm.get('password')?.touched) {
              <p class="text-red-500 text-xs mt-1">Contraseña requerida</p>
            }
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Endpoint
            </label>
            <input 
              type="url" 
              formControlName="endpoint"
              placeholder="https://www.tusfacturas.app/api/v2"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              [class.border-red-500]="apiForm.get('endpoint')?.invalid && apiForm.get('endpoint')?.touched"
            >
            @if (apiForm.get('endpoint')?.invalid && apiForm.get('endpoint')?.touched) {
              <p class="text-red-500 text-xs mt-1">URL válida requerida</p>
            }
          </div>

          @if (mensajeApi()) {
            <div class="p-3 rounded-lg" 
                 [class]="mensajeApi()?.tipo === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'">
              {{ mensajeApi()?.texto }}
            </div>
          }

          <div class="flex gap-2">
            <button 
              type="button"
              (click)="verificarConexion()"
              [disabled]="verificandoConexion() || apiForm.invalid"
              class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {{ verificandoConexion() ? 'Verificando...' : 'Verificar Conexión' }}
            </button>
            
            <button 
              type="submit"
              [disabled]="apiForm.invalid || guardandoApi()"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {{ guardandoApi() ? 'Guardando...' : 'Guardar API' }}
            </button>

            @if (tusFacturasService.estaConfigurado()) {
              <button 
                type="button"
                (click)="limpiarConfiguracion()"
                class="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                Limpiar
              </button>
            }
          </div>
        </form>
      </div>

      <!-- Configuración de empresa (solo si está conectado) -->
      @if (tusFacturasService.conectado() && configuracionEmpresa()) {
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-4">Datos de la Empresa</h2>
          
          <div class="space-y-4">
            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  CUIT
                </label>
                <input 
                  type="text" 
                  [value]="configuracionEmpresa()?.cuit || ''"
                  readonly
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Razón Social
                </label>
                <input 
                  type="text" 
                  [value]="configuracionEmpresa()?.razonSocial || ''"
                  readonly
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                >
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Domicilio
              </label>
              <input 
                type="text" 
                [value]="configuracionEmpresa()?.domicilio || ''"
                readonly
                class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              >
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Condición IVA
                </label>
                <input 
                  type="text" 
                  [value]="configuracionEmpresa()?.condicionIva || ''"
                  readonly
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                >
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Punto de Venta
                </label>
                <input 
                  type="text" 
                  [value]="configuracionEmpresa()?.puntoVenta || ''"
                  readonly
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                >
              </div>
            </div>

            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div class="flex">
                <div class="text-blue-600 mr-3">
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                  </svg>
                </div>
                <div class="text-sm text-blue-700">
                  <p class="font-medium">Información sincronizada</p>
                  <p>Estos datos se obtienen automáticamente de TusFacturas y no se pueden modificar desde aquí.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  imports: [ReactiveFormsModule, DatePipe]
})
export class ConfiguracionComponent {
  private fb = inject(FormBuilder);
  tusFacturasService = inject(TusFacturasService);

  // Estados del componente
  guardandoApi = signal(false);
  verificandoConexion = signal(false);
  configuracionEmpresa = signal<ConfiguracionEmpresa | null>(null);
  mensajeApi = signal<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  // Formularios
  apiForm: FormGroup;

  constructor() {
    // Inicializar formulario API
    this.apiForm = this.fb.group({
      usuario: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
      endpoint: ['https://www.tusfacturas.app/api/v2', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]]
    });

    // Cargar configuración existente
    this.tusFacturasService.cargarConfiguracion();
  }

  guardarAPI(): void {
    if (this.apiForm.invalid) return;

    this.guardandoApi.set(true);
    this.mensajeApi.set(null);

    const config: TusFacturasConfig = this.apiForm.value;
    
    try {
      this.tusFacturasService.configurar(config);
      this.mensajeApi.set({
        texto: 'Configuración guardada correctamente',
        tipo: 'success'
      });
    } catch (error) {
      this.mensajeApi.set({
        texto: 'Error al guardar la configuración',
        tipo: 'error'
      });
    } finally {
      this.guardandoApi.set(false);
    }

    // Limpiar mensaje después de 3 segundos
    setTimeout(() => this.mensajeApi.set(null), 3000);
  }

  verificarConexion(): void {
    if (this.apiForm.invalid) return;

    this.verificandoConexion.set(true);
    this.mensajeApi.set(null);

    // Primero guardar la configuración temporalmente
    const config: TusFacturasConfig = this.apiForm.value;
    this.tusFacturasService.configurar(config);

    this.tusFacturasService.verificarConexion().subscribe({
      next: () => {
        this.mensajeApi.set({
          texto: 'Conexión exitosa con TusFacturas',
          tipo: 'success'
        });
        this.cargarConfiguracionEmpresa();
      },
      error: (error) => {
        console.error('Error de conexión:', error);
        this.mensajeApi.set({
          texto: 'Error de conexión. Verifica las credenciales.',
          tipo: 'error'
        });
      },
      complete: () => {
        this.verificandoConexion.set(false);
        setTimeout(() => this.mensajeApi.set(null), 5000);
      }
    });
  }

  cargarConfiguracionEmpresa(): void {
    this.tusFacturasService.obtenerConfiguracionEmpresa().subscribe({
      next: (config) => {
        this.configuracionEmpresa.set(config);
      },
      error: (error) => {
        console.error('Error al cargar configuración de empresa:', error);
      }
    });
  }

  limpiarConfiguracion(): void {
    this.tusFacturasService.limpiarConfiguracion();
    this.configuracionEmpresa.set(null);
    this.apiForm.reset();
    this.apiForm.patchValue({
      endpoint: 'https://www.tusfacturas.app/api/v2'
    });
    this.mensajeApi.set({
      texto: 'Configuración eliminada',
      tipo: 'success'
    });
    setTimeout(() => this.mensajeApi.set(null), 3000);
  }
}

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Configuración</h2>
        <p class="text-gray-600">
          Configura tu aplicación y integración con TusFacturas
        </p>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="p-6">
          <h3 class="text-lg font-semibold">Configuración de API</h3>
        </div>
        <div class="p-6 pt-0">
          <div class="text-center py-8 text-gray-600">
            Configura tu API key de TusFacturas
          </div>
        </div>
      </div>

