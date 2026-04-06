import { Component, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';

interface MensajeEstado {
  texto: string;
  tipo: 'success' | 'error';
}

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-6">
      <!-- Preferencia de tema -->
      <div class="bg-card text-card-foreground p-4 sm:p-6 rounded-lg border border-border">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-muted">
              <svg class="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
            </div>
            <div>
              <h3 class="text-lg font-semibold text-foreground">Tema</h3>
              <p class="text-sm text-muted-foreground">Personaliza la apariencia de la interfaz</p>
            </div>
          </div>
          
          <div class="flex bg-muted rounded-lg p-1">
            <button type="button" (click)="setTheme('light')"
              [class]="themeService.theme() === 'light' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
              </svg>
              Claro
            </button>
            <button type="button" (click)="setTheme('dark')"
              [class]="themeService.theme() === 'dark' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path>
              </svg>
              Oscuro
            </button>
            <button type="button" (click)="setTheme('auto')"
              [class]="themeService.theme() === 'auto' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
              class="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
              Auto
            </button>
          </div>
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p class="text-zinc-500 dark:text-zinc-400 ml-4">Cargando configuración...</p>
        </div>
      } @else {
        <form [formGroup]="configForm" (ngSubmit)="onSubmit()" class="space-y-6">
          
          <!-- Datos del Negocio -->
          <div class="card-surface">
            <div class="card-header">
              <h3 class="card-title">Datos del Negocio</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <div class="space-y-2">
                <label class="form-label">CUIT</label>
                <input type="text" formControlName="cuit" maxlength="11" placeholder="27332731667" class="form-input"
                  [class.border-red-500]="configForm.get('cuit')?.invalid && configForm.get('cuit')?.touched">
                @if (configForm.get('cuit')?.invalid && configForm.get('cuit')?.touched) {
                  <p class="form-error">El CUIT debe tener exactamente 11 dígitos</p>
                }
              </div>

              <div class="space-y-2">
                <label class="form-label">Razón Social</label>
                <input type="text" formControlName="razon_social" placeholder="NOMBRE DEL CONTRIBUYENTE" class="form-input"
                  [class.border-red-500]="configForm.get('razon_social')?.invalid && configForm.get('razon_social')?.touched">
                @if (configForm.get('razon_social')?.invalid && configForm.get('razon_social')?.touched) {
                  <p class="form-error">La razón social es requerida</p>
                }
              </div>

              <div class="space-y-2">
                <label class="form-label">Punto de Venta</label>
                <input type="number" formControlName="punto_venta" min="1" max="99" placeholder="4" class="form-input"
                  [class.border-red-500]="configForm.get('punto_venta')?.invalid && configForm.get('punto_venta')?.touched">
                @if (configForm.get('punto_venta')?.invalid && configForm.get('punto_venta')?.touched) {
                  <p class="form-error">El punto de venta es requerido</p>
                }
              </div>

            </div>
          </div>

          <!-- Configuración de Facturación -->
          <div class="card-surface">
            <div class="card-header">
              <h3 class="card-title">Configuración de Facturación</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <div class="space-y-2">
                <label class="form-label">Concepto a facturar</label>
                <input type="text" formControlName="concepto" placeholder="Honorarios Profesionales" class="form-input"
                  [class.border-red-500]="configForm.get('concepto')?.invalid && configForm.get('concepto')?.touched">
                @if (configForm.get('concepto')?.invalid && configForm.get('concepto')?.touched) {
                  <p class="form-error">El concepto es requerido</p>
                }
              </div>

              <div class="space-y-2">
                <label class="form-label">IVA</label>
                <select formControlName="iva_porcentaje" class="form-select">
                  <option value="" disabled>Seleccionar IVA</option>
                  <option value="21.00">21%</option>
                  <option value="10.50">10.5%</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="form-label">Actividad</label>
                <select formControlName="actividad" class="form-select">
                  <option value="" disabled>Seleccionar actividad</option>
                  <option value="bienes">Bienes (-5 días)</option>
                  <option value="servicios">Servicios (-10 días)</option>
                </select>
                <p class="form-help">Determina cuántos días hacia atrás se pueden emitir facturas</p>
              </div>

            </div>
          </div>

          <!-- Datos API TusFacturas.app -->
          <div class="card-surface">
            <div class="card-header">
              <h3 class="card-title">Datos API TusFacturas.app</h3>
            </div>
            <div class="p-6 space-y-4">
              
              <div class="space-y-2">
                <label class="form-label">Tipo de Comprobante</label>
                <select formControlName="tipo_comprobante_default" class="form-select">
                  <option value="" disabled>Seleccionar tipo</option>
                  <option value="FACTURA B">Factura B / Nota de Crédito B (Responsable Inscripto)</option>
                  <option value="FACTURA C">Factura C / Nota de Crédito C (Monotributista)</option>
                </select>
              </div>

              <div class="space-y-2">
                <label class="form-label">API Token</label>
                <div class="relative">
                  <input [type]="mostrarApiToken() ? 'text' : 'password'" formControlName="api_token" placeholder="Token alfanumérico" class="form-input pr-10"
                    [class.border-red-500]="configForm.get('api_token')?.invalid && configForm.get('api_token')?.touched">
                  <button type="button" (click)="mostrarApiToken.set(!mostrarApiToken())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-200">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarApiToken()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 11-4.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('api_token')?.invalid && configForm.get('api_token')?.touched) {
                  <p class="form-error">El API Token es requerido</p>
                }
              </div>

              <div class="space-y-2">
                <label class="form-label">API Key</label>
                <div class="relative">
                  <input [type]="mostrarApiKey() ? 'text' : 'password'" formControlName="api_key" placeholder="Clave numérica" class="form-input pr-10"
                    [class.border-red-500]="configForm.get('api_key')?.invalid && configForm.get('api_key')?.touched">
                  <button type="button" (click)="mostrarApiKey.set(!mostrarApiKey())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-200">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarApiKey()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 11-4.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('api_key')?.invalid && configForm.get('api_key')?.touched) {
                  <p class="form-error">La API Key es requerida</p>
                }
              </div>

              <div class="space-y-2">
                <label class="form-label">User Token</label>
                <div class="relative">
                  <input [type]="mostrarUserToken() ? 'text' : 'password'" formControlName="user_token" placeholder="Token alfanumérico del usuario" class="form-input pr-10"
                    [class.border-red-500]="configForm.get('user_token')?.invalid && configForm.get('user_token')?.touched">
                  <button type="button" (click)="mostrarUserToken.set(!mostrarUserToken())"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors duration-200">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      @if (mostrarUserToken()) {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 11-4.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"></path>
                      } @else {
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                      }
                    </svg>
                  </button>
                </div>
                @if (configForm.get('user_token')?.invalid && configForm.get('user_token')?.touched) {
                  <p class="form-error">El User Token es requerido</p>
                }
              </div>

            </div>
          </div>

          <!-- Mensaje de estado -->
          @if (mensaje()) {
            <div class="p-4 rounded-lg border" 
                 [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'">
              {{ mensaje()?.texto }}
            </div>
          }

          <!-- Botón guardar -->
          <button 
            type="submit"
            [disabled]="configForm.invalid || guardando()"
            class="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
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
  readonly themeService = inject(ThemeService);
  readonly contribuyenteService = inject(ContribuyenteService);

  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly mensaje = signal<MensajeEstado | null>(null);
  readonly mostrarApiToken = signal(false);
  readonly mostrarApiKey = signal(false);
  readonly mostrarUserToken = signal(false);

  readonly configForm: FormGroup;

  constructor() {
    this.configForm = this.fb.group({
      cuit: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
      razon_social: ['', Validators.required],
      punto_venta: ['', [Validators.required, Validators.min(1), Validators.max(99)]],
      concepto: ['', Validators.required],
      iva_porcentaje: ['', Validators.required],
      actividad: ['', Validators.required],
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
      // Esperar a que el contribuyente se cargue si aún no
      if (!this.contribuyenteService.inicializado()) {
        await this.contribuyenteService.cargarContribuyente();
      }

      const contribuyente = this.contribuyenteService.contribuyente();
      if (contribuyente) {
        this.configForm.patchValue({
          cuit: contribuyente.cuit,
          razon_social: contribuyente.razon_social,
          punto_venta: contribuyente.punto_venta?.toString() || '4',
          concepto: contribuyente.concepto || '',
          iva_porcentaje: Number(contribuyente.iva_porcentaje).toFixed(2),
          actividad: contribuyente.actividad || 'servicios',
          tipo_comprobante_default: contribuyente.tipo_comprobante_default || 'FACTURA C',
          api_token: contribuyente.api_token || '',
          api_key: contribuyente.api_key || '',
          user_token: contribuyente.user_token || ''
        });
      }
    } catch (error) {
      this.mostrarMensaje('Ocurrió un error al cargar la configuración.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.configForm.invalid) return;

    this.guardando.set(true);

    try {
      const formData = this.configForm.value;
      const payload = {
        cuit: formData.cuit,
        razon_social: formData.razon_social,
        punto_venta: parseInt(formData.punto_venta),
        concepto: formData.concepto,
        iva_porcentaje: parseFloat(formData.iva_porcentaje),
        actividad: formData.actividad as 'bienes' | 'servicios',
        tipo_comprobante_default: formData.tipo_comprobante_default,
        api_token: formData.api_token,
        api_key: formData.api_key,
        user_token: formData.user_token
      };

      const contribuyente = this.contribuyenteService.contribuyente();

      if (contribuyente) {
        // Actualizar existente
        const result = await this.contribuyenteService.actualizarContribuyente(payload);
        if (result.success) {
          this.mostrarMensaje('Configuración guardada correctamente.', 'success');
        } else {
          this.mostrarMensaje(result.error || 'Error al guardar.', 'error');
        }
      } else {
        // Crear nuevo contribuyente (primera vez)
        const result = await this.contribuyenteService.crearContribuyente(payload);
        if (result.success) {
          this.mostrarMensaje('Contribuyente creado correctamente. ¡Ya podés facturar!', 'success');
        } else {
          this.mostrarMensaje(result.error || 'Error al crear.', 'error');
        }
      }

    } catch (error) {
      this.mostrarMensaje('Ocurrió un error inesperado al guardar.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrarMensaje(texto: string, tipo: 'success' | 'error'): void {
    this.mensaje.set({ texto, tipo });
    setTimeout(() => this.mensaje.set(null), 5000);
  }

  setTheme(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
  }
}
