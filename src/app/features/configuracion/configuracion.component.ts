import { Component, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { supabase } from '../../core/services/supabase.service';

type TabId = 'facturacion' | 'certificado' | 'cuenta';

interface MensajeEstado {
  texto: string;
  tipo: 'success' | 'error';
}

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-4">
      <!-- Tabs -->
      <div class="bg-card rounded-lg border border-border overflow-hidden">
        <div class="flex border-b border-border">
          <button type="button" 
            (click)="tabActiva.set('facturacion')"
            class="flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 border-b-2"
            [class]="tabActiva() === 'facturacion' 
              ? 'border-primary text-primary bg-primary/5' 
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'">
            📋 Facturación
          </button>
          <button type="button"
            (click)="tabActiva.set('certificado')"
            class="flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 border-b-2"
            [class]="tabActiva() === 'certificado' 
              ? 'border-primary text-primary bg-primary/5' 
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'">
            🔐 Certificado ARCA
          </button>
          <button type="button"
            (click)="tabActiva.set('cuenta')"
            class="flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 border-b-2"
            [class]="tabActiva() === 'cuenta' 
              ? 'border-primary text-primary bg-primary/5' 
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'">
            👤 Cuenta
          </button>
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-muted-foreground ml-4">Cargando configuración...</p>
        </div>
      } @else {

        <!-- ==================== PESTAÑA 1: FACTURACIÓN ==================== -->
        @if (tabActiva() === 'facturacion') {
          <form [formGroup]="facturacionForm" (ngSubmit)="guardarFacturacion()" class="space-y-4">

            <!-- CUIT + Buscar -->
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Datos del Emisor</h3>
                <p class="text-xs text-muted-foreground mt-1">Datos obligatorios que aparecen en tus comprobantes</p>
              </div>
              <div class="p-4 sm:p-6 space-y-4">

                <!-- CUIT con botón buscar -->
                <div class="space-y-2">
                  <label class="form-label">CUIT</label>
                  <div class="flex gap-2">
                    <input type="text" formControlName="cuit" maxlength="11" placeholder="20332398181" class="form-input flex-1"
                      [class.border-red-500]="facturacionForm.get('cuit')?.invalid && facturacionForm.get('cuit')?.touched">
                    <button type="button" (click)="buscarCuit()" 
                      [disabled]="buscandoCuit() || facturacionForm.get('cuit')?.invalid"
                      class="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                      {{ buscandoCuit() ? '...' : '🔍 Buscar' }}
                    </button>
                  </div>
                  @if (facturacionForm.get('cuit')?.invalid && facturacionForm.get('cuit')?.touched) {
                    <p class="form-error">El CUIT debe tener 11 dígitos</p>
                  }
                  @if (mensajePadron()) {
                    <p class="text-xs" [class]="mensajePadron()!.tipo === 'success' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">
                      {{ mensajePadron()!.texto }}
                    </p>
                  }
                </div>

                <!-- Razón Social -->
                <div class="space-y-2">
                  <label class="form-label">Razón Social</label>
                  <input type="text" formControlName="razon_social" placeholder="APELLIDO NOMBRE" class="form-input">
                </div>

                <!-- Nombre de Fantasía -->
                <div class="space-y-2">
                  <label class="form-label">Nombre de Fantasía <span class="text-muted-foreground font-normal">(opcional)</span></label>
                  <input type="text" formControlName="nombre_fantasia" placeholder="Mi Negocio" class="form-input">
                  <p class="form-help">Si se completa, aparece destacado en el ticket (letra grande)</p>
                </div>

                <!-- Domicilio -->
                <div class="space-y-2">
                  <label class="form-label">Domicilio Comercial</label>
                  <input type="text" formControlName="domicilio" placeholder="Av. Siempre Viva 742, Springfield" class="form-input">
                  <p class="form-help">Obligatorio en el comprobante. Podés modificarlo si tenés varios puntos de venta.</p>
                </div>

                <!-- Condición IVA -->
                <div class="space-y-2">
                  <label class="form-label">Condición frente al IVA</label>
                  <select formControlName="condicion_iva" class="form-select">
                    <option value="Responsable Monotributo">Responsable Monotributo</option>
                    <option value="IVA Responsable Inscripto">IVA Responsable Inscripto</option>
                    <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
                  </select>
                </div>

                <!-- Ingresos brutos -->
                <div class="space-y-2">
                  <label class="form-label">Ingresos Brutos</label>
                  <input type="text" formControlName="ingresos_brutos" placeholder="20332398181" class="form-input">
                  <p class="form-help">Generalmente es igual al CUIT (Convenio Multilateral)</p>
                </div>

                <!-- Inicio actividades -->
                <div class="space-y-2">
                  <label class="form-label">Fecha Inicio de Actividades</label>
                  <input type="date" formControlName="inicio_actividades" class="form-input">
                </div>

              </div>
            </div>

            <!-- Configuración de facturación -->
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Configuración de Facturación</h3>
              </div>
              <div class="p-4 sm:p-6 space-y-4">

                <div class="space-y-2">
                  <label class="form-label">Punto de Venta</label>
                  <input type="number" formControlName="punto_venta" min="1" max="9999" placeholder="4" class="form-input">
                </div>

                <div class="space-y-2">
                  <label class="form-label">Tipo de Comprobante</label>
                  <select formControlName="tipo_comprobante_default" class="form-select">
                    <option value="FACTURA B">Factura B / NC B (Responsable Inscripto)</option>
                    <option value="FACTURA C">Factura C / NC C (Monotributista)</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label class="form-label">Concepto a Facturar</label>
                  <input type="text" formControlName="concepto" placeholder="Honorarios Profesionales" class="form-input">
                </div>

                <div class="space-y-2">
                  <label class="form-label">IVA</label>
                  <select formControlName="iva_porcentaje" class="form-select">
                    <option value="21.00">21%</option>
                    <option value="10.50">10.5%</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label class="form-label">Actividad</label>
                  <select formControlName="actividad" class="form-select">
                    <option value="bienes">Bienes (-5 días)</option>
                    <option value="servicios">Servicios (-10 días)</option>
                  </select>
                  <p class="form-help">Cuántos días hacia atrás se pueden emitir facturas</p>
                </div>

              </div>
            </div>

            <!-- Mensaje + Guardar -->
            @if (mensaje()) {
              <div class="p-3 rounded-lg border text-sm" 
                   [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'">
                {{ mensaje()?.texto }}
              </div>
            }

            <button type="submit" [disabled]="facturacionForm.invalid || guardando()"
              class="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 shadow-sm">
              {{ guardando() ? 'Guardando...' : '💾 Guardar Datos de Facturación' }}
            </button>
          </form>
        }

        <!-- ==================== PESTAÑA 2: CERTIFICADO ARCA ==================== -->
        @if (tabActiva() === 'certificado') {
          <form [formGroup]="certForm" (ngSubmit)="guardarCertificado()" class="space-y-4">
            <div class="card-surface">
              <div class="card-header">
                <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                  <div>
                    <h3 class="card-title">Certificados ARCA (AFIP)</h3>
                    <p class="text-xs text-muted-foreground mt-1">Necesarios para emitir comprobantes electrónicos</p>
                  </div>
                </div>
              </div>
              <div class="p-4 sm:p-6 space-y-4">

                <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300">
                  <p class="font-medium mb-1">⚠️ Archivos sensibles</p>
                  <p>Los certificados se almacenan de forma segura asociados a tu cuenta.</p>
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
                      <input type="file" accept=".crt,.pem,.cer" class="hidden" (change)="onCertFileSelected($event)">
                      @if (tieneCert()) {
                        <span class="text-sm font-medium">✅ Certificado cargado</span>
                      } @else {
                        <span class="text-sm">📎 Seleccionar archivo .crt</span>
                      }
                    </label>
                    @if (tieneCert()) {
                      <button type="button" (click)="borrarCert()" class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                        🗑️
                      </button>
                    }
                  </div>
                  @if (certFileName()) {
                    <p class="text-xs text-muted-foreground">{{ certFileName() }}</p>
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
                      <input type="file" accept=".key,.pem" class="hidden" (change)="onKeyFileSelected($event)">
                      @if (tieneKey()) {
                        <span class="text-sm font-medium">✅ Clave privada cargada</span>
                      } @else {
                        <span class="text-sm">🔑 Seleccionar archivo .key</span>
                      }
                    </label>
                    @if (tieneKey()) {
                      <button type="button" (click)="borrarKey()" class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                        🗑️
                      </button>
                    }
                  </div>
                  @if (keyFileName()) {
                    <p class="text-xs text-muted-foreground">{{ keyFileName() }}</p>
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

                <!-- Estado -->
                @if (tieneCert() && tieneKey()) {
                  <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                    <span class="text-sm font-medium text-green-700 dark:text-green-300">✅ Certificados configurados — Listo para facturar</span>
                  </div>
                } @else {
                  <div class="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                    <span class="text-sm text-yellow-700 dark:text-yellow-300">⚠️ Subí ambos archivos para poder facturar</span>
                  </div>
                }
              </div>
            </div>

            @if (mensaje()) {
              <div class="p-3 rounded-lg border text-sm" 
                   [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'">
                {{ mensaje()?.texto }}
              </div>
            }

            <button type="submit" [disabled]="guardando()"
              class="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 shadow-sm">
              {{ guardando() ? 'Guardando...' : '💾 Guardar Certificado' }}
            </button>
          </form>
        }

        <!-- ==================== PESTAÑA 3: CUENTA ==================== -->
        @if (tabActiva() === 'cuenta') {
          <div class="space-y-4">
            <!-- Tema -->
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Apariencia</h3>
              </div>
              <div class="p-4 sm:p-6">
                <div class="flex bg-muted rounded-lg p-1">
                  <button type="button" (click)="setTheme('light')"
                    [class]="themeService.theme() === 'light' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
                    ☀️ Claro
                  </button>
                  <button type="button" (click)="setTheme('dark')"
                    [class]="themeService.theme() === 'dark' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
                    🌙 Oscuro
                  </button>
                  <button type="button" (click)="setTheme('auto')"
                    [class]="themeService.theme() === 'auto' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200">
                    🖥️ Auto
                  </button>
                </div>
              </div>
            </div>

            <!-- Email -->
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Cambiar Email</h3>
              </div>
              <div class="p-4 sm:p-6 space-y-4">
                <div class="space-y-2">
                  <label class="form-label">Email actual</label>
                  <input type="email" [value]="emailActual()" readonly class="form-input bg-muted/50 cursor-not-allowed">
                </div>
                <div class="space-y-2">
                  <label class="form-label">Nuevo email</label>
                  <input type="email" [(ngModel)]="nuevoEmail" placeholder="nuevo@email.com" class="form-input">
                </div>
                <button type="button" (click)="cambiarEmail()" 
                  [disabled]="!nuevoEmail || guardando()"
                  class="w-full bg-primary text-primary-foreground py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90">
                  {{ guardando() ? 'Enviando...' : 'Cambiar Email' }}
                </button>
              </div>
            </div>

            <!-- Contraseña -->
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Cambiar Contraseña</h3>
              </div>
              <div class="p-4 sm:p-6 space-y-4">
                <div class="space-y-2">
                  <label class="form-label">Nueva contraseña</label>
                  <input type="password" [(ngModel)]="nuevaPassword" placeholder="Mínimo 6 caracteres" class="form-input">
                </div>
                <div class="space-y-2">
                  <label class="form-label">Confirmar contraseña</label>
                  <input type="password" [(ngModel)]="confirmarPassword" placeholder="Repetir contraseña" class="form-input">
                </div>
                <button type="button" (click)="cambiarPassword()" 
                  [disabled]="!nuevaPassword || !confirmarPassword || guardando()"
                  class="w-full bg-primary text-primary-foreground py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90">
                  {{ guardando() ? 'Cambiando...' : 'Cambiar Contraseña' }}
                </button>
              </div>
            </div>

            @if (mensaje()) {
              <div class="p-3 rounded-lg border text-sm" 
                   [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'">
                {{ mensaje()?.texto }}
              </div>
            }
          </div>
        }

      }
    </div>
  `,
  imports: [ReactiveFormsModule, FormsModule],
  standalone: true
})
export class ConfiguracionComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly themeService = inject(ThemeService);
  readonly contribuyenteService = inject(ContribuyenteService);

  readonly tabActiva = signal<TabId>('facturacion');
  readonly cargando = signal(false);
  readonly guardando = signal(false);
  readonly buscandoCuit = signal(false);
  readonly mensaje = signal<MensajeEstado | null>(null);
  readonly mensajePadron = signal<MensajeEstado | null>(null);
  readonly emailActual = signal('');

  // Cert state
  readonly tieneCert = signal(false);
  readonly tieneKey = signal(false);
  readonly certFileName = signal<string | null>(null);
  readonly keyFileName = signal<string | null>(null);
  private certContent: string | null = null;
  private keyContent: string | null = null;
  private certModified = false;
  private keyModified = false;

  // Cuenta - ngModel bindings
  nuevoEmail = '';
  nuevaPassword = '';
  confirmarPassword = '';

  // Forms
  readonly facturacionForm: FormGroup;
  readonly certForm: FormGroup;

  constructor() {
    this.facturacionForm = this.fb.group({
      cuit: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
      razon_social: ['', Validators.required],
      nombre_fantasia: [''],
      domicilio: [''],
      condicion_iva: ['Responsable Monotributo'],
      ingresos_brutos: [''],
      inicio_actividades: [''],
      punto_venta: ['', [Validators.required, Validators.min(1), Validators.max(9999)]],
      tipo_comprobante_default: ['FACTURA C'],
      concepto: ['', Validators.required],
      iva_porcentaje: ['21.00'],
      actividad: ['servicios'],
    });

    this.certForm = this.fb.group({
      arca_production: [false],
    });
  }

  ngOnInit(): void {
    this.cargarConfiguracion();
    this.cargarEmail();
  }

  private async cargarEmail() {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.email) {
      this.emailActual.set(data.user.email);
    }
  }

  async cargarConfiguracion(): Promise<void> {
    this.cargando.set(true);
    try {
      if (!this.contribuyenteService.inicializado()) {
        await this.contribuyenteService.cargarContribuyente();
      }

      const c = this.contribuyenteService.contribuyente();
      if (c) {
        this.facturacionForm.patchValue({
          cuit: c.cuit,
          razon_social: c.razon_social,
          nombre_fantasia: c.nombre_fantasia || '',
          domicilio: c.domicilio || '',
          condicion_iva: c.condicion_iva || 'Responsable Monotributo',
          ingresos_brutos: c.ingresos_brutos || '',
          inicio_actividades: c.inicio_actividades || '',
          punto_venta: c.punto_venta?.toString() || '4',
          tipo_comprobante_default: c.tipo_comprobante_default || 'FACTURA C',
          concepto: c.concepto || '',
          iva_porcentaje: Number(c.iva_porcentaje).toFixed(2),
          actividad: c.actividad || 'servicios',
        });

        this.certForm.patchValue({
          arca_production: c.arca_production ?? false,
        });

        this.tieneCert.set(!!c.arca_cert);
        this.tieneKey.set(!!c.arca_key);
        if (c.arca_cert) this.certFileName.set('(certificado guardado)');
        if (c.arca_key) this.keyFileName.set('(clave guardada)');
      }
    } catch (error) {
      this.mostrarMensaje('Error al cargar la configuración.', 'error');
    } finally {
      this.cargando.set(false);
    }
  }

  // ==================== BUSCAR CUIT ====================
  async buscarCuit() {
    const cuit = this.facturacionForm.get('cuit')?.value;
    if (!cuit || cuit.length !== 11) return;

    this.buscandoCuit.set(true);
    this.mensajePadron.set(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        this.mensajePadron.set({ texto: 'Sesión no activa', tipo: 'error' });
        return;
      }

      const response = await supabase.functions.invoke('padron-lookup', {
        body: { cuit }
      });

      if (response.error) {
        this.mensajePadron.set({ texto: response.error.message || 'Error al consultar el padrón', tipo: 'error' });
        return;
      }

      const datos = response.data;
      if (datos) {
        // Autocompletar campos
        if (datos.razon_social) {
          this.facturacionForm.patchValue({ razon_social: datos.razon_social });
        }
        if (datos.domicilio) {
          this.facturacionForm.patchValue({ domicilio: datos.domicilio });
        }
        if (datos.condicion_iva) {
          this.facturacionForm.patchValue({ condicion_iva: datos.condicion_iva });
        }
        // Autocompletar IIBB = CUIT
        if (!this.facturacionForm.get('ingresos_brutos')?.value) {
          this.facturacionForm.patchValue({ ingresos_brutos: cuit });
        }

        this.mensajePadron.set({ texto: '✅ Datos obtenidos del padrón ARCA', tipo: 'success' });
      }
    } catch (error) {
      this.mensajePadron.set({ texto: 'No se pudo consultar el padrón. ¿Tenés los certificados ARCA cargados?', tipo: 'error' });
    } finally {
      this.buscandoCuit.set(false);
    }
  }

  // ==================== GUARDAR FACTURACIÓN ====================
  async guardarFacturacion() {
    if (this.facturacionForm.invalid) return;
    this.guardando.set(true);

    try {
      const f = this.facturacionForm.value;
      const payload: any = {
        cuit: f.cuit,
        razon_social: f.razon_social,
        nombre_fantasia: f.nombre_fantasia || null,
        domicilio: f.domicilio || null,
        condicion_iva: f.condicion_iva || 'Responsable Monotributo',
        ingresos_brutos: f.ingresos_brutos || null,
        inicio_actividades: f.inicio_actividades || null,
        punto_venta: parseInt(f.punto_venta),
        tipo_comprobante_default: f.tipo_comprobante_default,
        concepto: f.concepto,
        iva_porcentaje: parseFloat(f.iva_porcentaje),
        actividad: f.actividad as 'bienes' | 'servicios',
      };

      const contribuyente = this.contribuyenteService.contribuyente();

      if (contribuyente) {
        const result = await this.contribuyenteService.actualizarContribuyente(payload);
        this.mostrarMensaje(result.success ? '✅ Datos de facturación guardados.' : (result.error || 'Error al guardar.'), result.success ? 'success' : 'error');
      } else {
        const result = await this.contribuyenteService.crearContribuyente(payload);
        this.mostrarMensaje(result.success ? '✅ Contribuyente creado correctamente.' : (result.error || 'Error al crear.'), result.success ? 'success' : 'error');
      }
    } catch (error) {
      this.mostrarMensaje('Error inesperado al guardar.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  // ==================== GUARDAR CERTIFICADO ====================
  async guardarCertificado() {
    this.guardando.set(true);

    try {
      const payload: any = {
        arca_production: this.certForm.get('arca_production')?.value ?? false,
      };
      if (this.certModified) payload.arca_cert = this.certContent;
      if (this.keyModified) payload.arca_key = this.keyContent;

      const contribuyente = this.contribuyenteService.contribuyente();
      if (!contribuyente) {
        this.mostrarMensaje('Primero completá los datos de facturación.', 'error');
        return;
      }

      const result = await this.contribuyenteService.actualizarContribuyente(payload);
      if (result.success) {
        this.certModified = false;
        this.keyModified = false;
        this.mostrarMensaje('✅ Certificado guardado correctamente.', 'success');
      } else {
        this.mostrarMensaje(result.error || 'Error al guardar certificado.', 'error');
      }
    } catch (error) {
      this.mostrarMensaje('Error inesperado.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  // ==================== CUENTA ====================
  async cambiarEmail() {
    if (!this.nuevoEmail) return;
    this.guardando.set(true);

    try {
      const { error } = await supabase.auth.updateUser({ email: this.nuevoEmail });
      if (error) {
        this.mostrarMensaje(error.message, 'error');
      } else {
        this.mostrarMensaje('✅ Se envió un email de confirmación a ambas direcciones.', 'success');
        this.nuevoEmail = '';
      }
    } catch (err) {
      this.mostrarMensaje('Error al cambiar email.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPassword() {
    if (!this.nuevaPassword || !this.confirmarPassword) return;
    if (this.nuevaPassword !== this.confirmarPassword) {
      this.mostrarMensaje('Las contraseñas no coinciden.', 'error');
      return;
    }
    if (this.nuevaPassword.length < 6) {
      this.mostrarMensaje('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }

    this.guardando.set(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: this.nuevaPassword });
      if (error) {
        this.mostrarMensaje(error.message, 'error');
      } else {
        this.mostrarMensaje('✅ Contraseña cambiada correctamente.', 'success');
        this.nuevaPassword = '';
        this.confirmarPassword = '';
      }
    } catch (err) {
      this.mostrarMensaje('Error al cambiar contraseña.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  // ==================== ARCHIVOS ====================
  onCertFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.certFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.certContent = reader.result as string;
      this.tieneCert.set(true);
      this.certModified = true;
    };
    reader.readAsText(file);
  }

  onKeyFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.keyFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.keyContent = reader.result as string;
      this.tieneKey.set(true);
      this.keyModified = true;
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

  // ==================== HELPERS ====================
  private mostrarMensaje(texto: string, tipo: 'success' | 'error'): void {
    this.mensaje.set({ texto, tipo });
    setTimeout(() => this.mensaje.set(null), 5000);
  }

  setTheme(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
  }
}
