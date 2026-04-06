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
                <label class="form-label">Tipo de Comprobante</label>
                <select formControlName="tipo_comprobante_default" class="form-select">
                  <option value="" disabled>Seleccionar tipo</option>
                  <option value="FACTURA B">Factura B / Nota de Crédito B (Responsable Inscripto)</option>
                  <option value="FACTURA C">Factura C / Nota de Crédito C (Monotributista)</option>
                </select>
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

          <!-- Certificados ARCA -->
          <div class="card-surface">
            <div class="card-header">
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                </svg>
                <h3 class="card-title">Certificados ARCA (AFIP)</h3>
              </div>
            </div>
            <div class="p-6 space-y-4">

              <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300">
                <p class="font-medium mb-1">⚠️ Estos archivos son sensibles</p>
                <p>Los certificados se almacenan de forma segura asociados a tu cuenta. Nunca compartimos estos datos.</p>
              </div>

              <!-- Certificado .crt -->
              <div class="space-y-2">
                <label class="form-label">Certificado (.crt)</label>
                <div class="flex items-center gap-3">
                  <label 
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200"
                    [class]="tieneCert() 
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                      : 'border-border hover:border-blue-400 dark:hover:border-blue-500 text-muted-foreground hover:text-foreground'">
                    <input 
                      type="file" 
                      accept=".crt,.pem,.cer" 
                      class="hidden" 
                      (change)="onCertFileSelected($event)"
                      id="cert-upload">
                    @if (tieneCert()) {
                      <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span class="text-sm font-medium">Certificado cargado ✓</span>
                    } @else {
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                      </svg>
                      <span class="text-sm">Seleccionar archivo .crt</span>
                    }
                  </label>
                  @if (tieneCert()) {
                    <button type="button" (click)="borrarCert()"
                      class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar certificado">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  }
                </div>
                @if (certFileName()) {
                  <p class="text-xs text-muted-foreground">Archivo: {{ certFileName() }}</p>
                }
              </div>

              <!-- Clave privada .key -->
              <div class="space-y-2">
                <label class="form-label">Clave Privada (.key)</label>
                <div class="flex items-center gap-3">
                  <label 
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200"
                    [class]="tieneKey() 
                      ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                      : 'border-border hover:border-blue-400 dark:hover:border-blue-500 text-muted-foreground hover:text-foreground'">
                    <input 
                      type="file" 
                      accept=".key,.pem" 
                      class="hidden" 
                      (change)="onKeyFileSelected($event)"
                      id="key-upload">
                    @if (tieneKey()) {
                      <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span class="text-sm font-medium">Clave privada cargada ✓</span>
                    } @else {
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path>
                      </svg>
                      <span class="text-sm">Seleccionar archivo .key</span>
                    }
                  </label>
                  @if (tieneKey()) {
                    <button type="button" (click)="borrarKey()"
                      class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar clave privada">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                      </svg>
                    </button>
                  }
                </div>
                @if (keyFileName()) {
                  <p class="text-xs text-muted-foreground">Archivo: {{ keyFileName() }}</p>
                }
              </div>

              <!-- Entorno -->
              <div class="space-y-2">
                <label class="form-label">Entorno ARCA</label>
                <select formControlName="arca_production" class="form-select">
                  <option [ngValue]="false">🧪 Testing / Homologación</option>
                  <option [ngValue]="true">🏭 Producción</option>
                </select>
                <p class="form-help">Usá Testing para probar antes de pasar a producción</p>
              </div>

              <!-- Estado de certificados -->
              @if (tieneCert() && tieneKey()) {
                <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                  <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                  <span class="text-sm font-medium text-green-700 dark:text-green-300">Certificados configurados — Listo para facturar</span>
                </div>
              } @else {
                <div class="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                  <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                  </svg>
                  <span class="text-sm text-yellow-700 dark:text-yellow-300">Subí ambos archivos (certificado y clave) para poder facturar</span>
                </div>
              }

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

  // State para archivos de certificados
  readonly tieneCert = signal(false);
  readonly tieneKey = signal(false);
  readonly certFileName = signal<string | null>(null);
  readonly keyFileName = signal<string | null>(null);

  // Contenido de los archivos leídos (PEM text)
  private certContent: string | null = null;
  private keyContent: string | null = null;

  // Flags para trackear si se subió un archivo nuevo en esta sesión
  private certModified = false;
  private keyModified = false;

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
      arca_production: [false],
    });
  }

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  async cargarConfiguracion(): Promise<void> {
    this.cargando.set(true);

    try {
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
          arca_production: contribuyente.arca_production ?? false,
        });

        // Check if certs already exist in DB
        this.tieneCert.set(!!contribuyente.arca_cert);
        this.tieneKey.set(!!contribuyente.arca_key);
        if (contribuyente.arca_cert) {
          this.certFileName.set('(certificado guardado)');
        }
        if (contribuyente.arca_key) {
          this.keyFileName.set('(clave guardada)');
        }
      }
    } catch (error) {
      this.mostrarMensaje('Ocurrió un error al cargar la configuración.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  onCertFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.certFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      this.certContent = reader.result as string;
      this.tieneCert.set(true);
      this.certModified = true;
    };
    reader.onerror = () => {
      this.mostrarMensaje('Error al leer el archivo de certificado', 'error');
      this.tieneCert.set(false);
    };
    reader.readAsText(file);
  }

  onKeyFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.keyFileName.set(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      this.keyContent = reader.result as string;
      this.tieneKey.set(true);
      this.keyModified = true;
    };
    reader.onerror = () => {
      this.mostrarMensaje('Error al leer el archivo de clave privada', 'error');
      this.tieneKey.set(false);
    };
    reader.readAsText(file);
  }

  borrarCert(): void {
    this.certContent = null;
    this.tieneCert.set(false);
    this.certFileName.set(null);
    this.certModified = true;
  }

  borrarKey(): void {
    this.keyContent = null;
    this.tieneKey.set(false);
    this.keyFileName.set(null);
    this.keyModified = true;
  }

  async onSubmit(): Promise<void> {
    if (this.configForm.invalid) return;

    this.guardando.set(true);

    try {
      const formData = this.configForm.value;
      const payload: any = {
        cuit: formData.cuit,
        razon_social: formData.razon_social,
        punto_venta: parseInt(formData.punto_venta),
        concepto: formData.concepto,
        iva_porcentaje: parseFloat(formData.iva_porcentaje),
        actividad: formData.actividad as 'bienes' | 'servicios',
        tipo_comprobante_default: formData.tipo_comprobante_default,
        arca_production: formData.arca_production ?? false,
      };

      // Solo incluir certs si fueron modificados en esta sesión
      if (this.certModified) {
        payload.arca_cert = this.certContent;
      }
      if (this.keyModified) {
        payload.arca_key = this.keyContent;
      }

      const contribuyente = this.contribuyenteService.contribuyente();

      if (contribuyente) {
        const result = await this.contribuyenteService.actualizarContribuyente(payload);
        if (result.success) {
          this.certModified = false;
          this.keyModified = false;
          this.mostrarMensaje('Configuración guardada correctamente.', 'success');
        } else {
          this.mostrarMensaje(result.error || 'Error al guardar.', 'error');
        }
      } else {
        const result = await this.contribuyenteService.crearContribuyente(payload);
        if (result.success) {
          this.certModified = false;
          this.keyModified = false;
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
