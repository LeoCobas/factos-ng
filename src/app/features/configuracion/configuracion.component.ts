import { Component, signal, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { supabase } from '../../core/services/supabase.service';
import { environment } from '../../../environments/environment';

type TabId = 'facturacion' | 'certificado' | 'cuenta';

interface MensajeEstado {
  texto: string;
  tipo: 'success' | 'error';
}

@Component({
  selector: 'app-configuracion',
  template: `
    <div class="space-y-5">
      <div class="config-tabs">
        <div class="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3">
          <button
            type="button"
            (click)="tabActiva.set('facturacion')"
            class="config-tab"
            [class.config-tab-active]="tabActiva() === 'facturacion'"
            [class.config-tab-inactive]="tabActiva() !== 'facturacion'">
            <span class="config-tab-eyebrow">Configuraci&oacute;n</span>
            <span class="config-tab-label">Facturaci&oacute;n</span>
          </button>
          <button
            type="button"
            (click)="tabActiva.set('certificado')"
            class="config-tab"
            [class.config-tab-active]="tabActiva() === 'certificado'"
            [class.config-tab-inactive]="tabActiva() !== 'certificado'">
            <span class="config-tab-eyebrow">Seguridad</span>
            <span class="config-tab-label">Certificado ARCA</span>
          </button>
          <button
            type="button"
            (click)="tabActiva.set('cuenta')"
            class="config-tab"
            [class.config-tab-active]="tabActiva() === 'cuenta'"
            [class.config-tab-inactive]="tabActiva() !== 'cuenta'">
            <span class="config-tab-eyebrow">Perfil</span>
            <span class="config-tab-label">Cuenta</span>
          </button>
        </div>
      </div>

      @if (cargando()) {
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-muted-foreground ml-4">Cargando configuraci&oacute;n...</p>
        </div>
      } @else {
        @if (tabActiva() === 'facturacion') {
          <form [formGroup]="facturacionForm" (ngSubmit)="guardarFacturacion()" class="space-y-5">
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Datos del Emisor</h3>
                <p class="form-section-description">Estos datos aparecen en tus comprobantes. Los campos con badge son obligatorios.</p>
              </div>
              <div class="p-4 sm:p-6 space-y-5">
                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">CUIT</label>
                    <span class="form-required-badge">Obligatorio</span>
                  </div>
                  <div class="flex flex-col gap-3 sm:flex-row">
                    <input type="text" formControlName="cuit" maxlength="11" placeholder="20332398181" class="form-input flex-1"
                      [class.error]="facturacionForm.get('cuit')?.invalid && facturacionForm.get('cuit')?.touched">
                    <button type="button" (click)="buscarCuit()"
                      [disabled]="buscandoCuit() || facturacionForm.get('cuit')?.invalid"
                      class="btn-primary min-w-[8.5rem] rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                      {{ buscandoCuit() ? 'Buscando...' : 'Buscar CUIT' }}
                    </button>
                  </div>
                  <p class="form-help">Us&aacute; la constancia de inscripci&oacute;n ARCA para autocompletar raz&oacute;n social, domicilio fiscal y condici&oacute;n frente al IVA.</p>
                  @if (facturacionForm.get('cuit')?.invalid && facturacionForm.get('cuit')?.touched) {
                    <p class="form-error">El CUIT debe tener 11 d&iacute;gitos.</p>
                  }
                  @if (mensajePadron()) {
                    <p class="form-help" [class]="mensajePadron()!.tipo === 'success' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'">
                      {{ mensajePadron()!.texto }}
                    </p>
                  }
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Raz&oacute;n Social</label>
                    <span class="form-required-badge">Obligatorio</span>
                  </div>
                  <input type="text" formControlName="razon_social" placeholder="APELLIDO NOMBRE" class="form-input">
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Nombre de Fantas&iacute;a</label>
                    <span class="form-optional-text">Opcional</span>
                  </div>
                  <input type="text" formControlName="nombre_fantasia" placeholder="Mi Negocio" class="form-input">
                  <p class="form-help">Si se completa, aparece destacado en el ticket con mayor tama&ntilde;o visual.</p>
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Domicilio Comercial</label>
                  </div>
                  <input type="text" formControlName="domicilio" placeholder="Av. Siempre Viva 742, Springfield" class="form-input">
                  <p class="form-help">Obligatorio en el comprobante. Pod&eacute;s modificarlo si ten&eacute;s varios puntos de venta.</p>
                </div>

                <div class="grid gap-5 lg:grid-cols-2">
                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">Condici&oacute;n frente al IVA</label>
                    </div>
                    <select formControlName="condicion_iva" class="form-select">
                      <option value="Responsable Monotributo">Responsable Monotributo</option>
                      <option value="IVA Responsable Inscripto">IVA Responsable Inscripto</option>
                      <option value="IVA Sujeto Exento">IVA Sujeto Exento</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">Ingresos Brutos</label>
                    </div>
                    <input type="text" formControlName="ingresos_brutos" placeholder="20332398181" class="form-input">
                    <p class="form-help">Generalmente coincide con el CUIT en Convenio Multilateral.</p>
                  </div>
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Fecha de Inicio de Actividades</label>
                  </div>
                  <input type="date" formControlName="inicio_actividades" class="form-input">
                </div>
              </div>
            </div>

            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Preferencias de Facturaci&oacute;n</h3>
                <p class="form-section-description">Defin&iacute; c&oacute;mo se completa cada comprobante por defecto.</p>
              </div>
              <div class="p-4 sm:p-6 space-y-5">
                <div class="grid gap-5 lg:grid-cols-2">
                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">Punto de Venta</label>
                      <span class="form-required-badge">Obligatorio</span>
                    </div>
                    <input type="number" formControlName="punto_venta" min="1" max="9999" placeholder="4" class="form-input">
                    <p class="form-help">Se usa como valor inicial al emitir comprobantes.</p>
                  </div>

                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">Tipo de Comprobante</label>
                    </div>
                    <select formControlName="tipo_comprobante_default" class="form-select">
                      <option value="FACTURA B">Factura B / NC B (Responsable Inscripto)</option>
                      <option value="FACTURA C">Factura C / NC C (Monotributista)</option>
                    </select>
                  </div>
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Concepto a Facturar</label>
                    <span class="form-required-badge">Obligatorio</span>
                  </div>
                  <input type="text" formControlName="concepto" placeholder="Honorarios Profesionales" class="form-input">
                  <p class="form-help">Se propone autom&aacute;ticamente al iniciar una nueva factura.</p>
                </div>

                <div class="grid gap-5 lg:grid-cols-2">
                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">IVA</label>
                    </div>
                    <select formControlName="iva_porcentaje" class="form-select">
                      <option value="21.00">21%</option>
                      <option value="10.50">10.5%</option>
                    </select>
                  </div>

                  <div class="form-field">
                    <div class="form-label-row">
                      <label class="form-label">Actividad</label>
                    </div>
                    <select formControlName="actividad" class="form-select">
                      <option value="bienes">Bienes (-5 d&iacute;as)</option>
                      <option value="servicios">Servicios (-10 d&iacute;as)</option>
                    </select>
                    <p class="form-help">Define cu&aacute;ntos d&iacute;as hacia atr&aacute;s se pueden emitir facturas.</p>
                  </div>
                </div>
              </div>
            </div>

            @if (mensaje()) {
              <div class="p-3 rounded-lg border text-sm"
                   [class]="mensaje()?.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700'">
                {{ mensaje()?.texto }}
              </div>
            }

            <button type="submit" [disabled]="facturacionForm.invalid || guardando()"
              class="btn-primary w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {{ guardando() ? 'Guardando...' : 'Guardar Datos de Facturaci&oacute;n' }}
            </button>
          </form>
        }

        @if (tabActiva() === 'certificado') {
          <form [formGroup]="certForm" (ngSubmit)="guardarCertificado()" class="space-y-5">
            <div class="card-surface">
              <div class="card-header">
                <div class="flex items-start gap-3">
                  <svg class="mt-1 h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
                  </svg>
                  <div>
                    <h3 class="card-title">Certificados ARCA (AFIP)</h3>
                    <p class="form-section-description">Necesarios para emitir comprobantes electr&oacute;nicos desde tu cuenta.</p>
                  </div>
                </div>
              </div>
              <div class="p-4 sm:p-6 space-y-5">
                <div class="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-sm text-amber-700 dark:text-amber-300">
                  <p class="font-medium mb-1">Archivos sensibles</p>
                  <p>Los certificados se almacenan de forma segura asociados a tu cuenta.</p>
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Certificado (.crt)</label>
                  </div>
                  <div class="flex items-center gap-3">
                    <label
                      class="file-dropzone flex-1"
                      [class]="tieneCert()
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-border text-muted-foreground hover:text-foreground'">
                      <input type="file" accept=".crt,.pem,.cer" class="hidden" (change)="onCertFileSelected($event)">
                      @if (tieneCert()) {
                        <span class="text-sm font-medium">Certificado cargado</span>
                      } @else {
                        <span class="text-sm">Seleccionar archivo .crt</span>
                      }
                    </label>
                    @if (tieneCert()) {
                      <button type="button" (click)="borrarCert()" class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                        &times;
                      </button>
                    }
                  </div>
                  <p class="form-help">Sub&iacute; el certificado p&uacute;blico emitido para tu CUIT.</p>
                  @if (certFileName()) {
                    <p class="form-help">{{ certFileName() }}</p>
                  }
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Clave Privada (.key)</label>
                  </div>
                  <div class="flex items-center gap-3">
                    <label
                      class="file-dropzone flex-1"
                      [class]="tieneKey()
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                        : 'border-border text-muted-foreground hover:text-foreground'">
                      <input type="file" accept=".key,.pem" class="hidden" (change)="onKeyFileSelected($event)">
                      @if (tieneKey()) {
                        <span class="text-sm font-medium">Clave privada cargada</span>
                      } @else {
                        <span class="text-sm">Seleccionar archivo .key</span>
                      }
                    </label>
                    @if (tieneKey()) {
                      <button type="button" (click)="borrarKey()" class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Eliminar">
                        &times;
                      </button>
                    }
                  </div>
                  <p class="form-help">Sub&iacute; la clave privada asociada al certificado anterior.</p>
                  @if (keyFileName()) {
                    <p class="form-help">{{ keyFileName() }}</p>
                  }
                </div>

                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Entorno ARCA</label>
                  </div>
                  <select formControlName="arca_production" class="form-select">
                    <option [ngValue]="false">Testing / Homologaci&oacute;n</option>
                    <option [ngValue]="true">Producci&oacute;n</option>
                  </select>
                  <p class="form-help">Us&aacute; Testing para validar la integraci&oacute;n antes de pasar a producci&oacute;n.</p>
                </div>

                @if (tieneCert() && tieneKey()) {
                  <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                    <span class="text-sm font-medium text-green-700 dark:text-green-300">Certificados configurados. Ya pod&eacute;s facturar.</span>
                  </div>
                } @else {
                  <div class="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700">
                    <span class="text-sm text-yellow-700 dark:text-yellow-300">Sub&iacute; ambos archivos para poder facturar.</span>
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
              class="btn-primary w-full rounded-lg px-4 py-3 font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {{ guardando() ? 'Guardando...' : 'Guardar Certificado' }}
            </button>
          </form>
        }

        @if (tabActiva() === 'cuenta') {
          <div class="space-y-5">
            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Apariencia</h3>
                <p class="form-section-description">Eleg&iacute; c&oacute;mo quer&eacute;s ver la aplicaci&oacute;n en este dispositivo.</p>
              </div>
              <div class="p-4 sm:p-6">
                <div class="flex flex-col gap-2 rounded-xl bg-muted/60 p-2 sm:flex-row">
                  <button type="button" (click)="setTheme('light')"
                    [class]="themeService.theme() === 'light' ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'"
                    class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200">
                    Claro
                  </button>
                  <button type="button" (click)="setTheme('dark')"
                    [class]="themeService.theme() === 'dark' ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'"
                    class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200">
                    Oscuro
                  </button>
                  <button type="button" (click)="setTheme('auto')"
                    [class]="themeService.theme() === 'auto' ? 'bg-background text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground border border-transparent'"
                    class="flex-1 rounded-lg px-3 py-3 text-sm font-semibold transition-all duration-200">
                    Auto
                  </button>
                </div>
              </div>
            </div>

            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Cambiar Email</h3>
                <p class="form-section-description">Actualiz&aacute; el correo principal asociado a tu cuenta.</p>
              </div>
              <div class="p-4 sm:p-6 space-y-5">
                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Email actual</label>
                  </div>
                  <input type="email" [value]="emailActual()" readonly class="form-input bg-muted/50 cursor-not-allowed">
                  <p class="form-help">Este valor es s&oacute;lo lectura hasta confirmar el cambio.</p>
                </div>
                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Nuevo email</label>
                  </div>
                  <input type="email" [(ngModel)]="nuevoEmail" placeholder="nuevo@email.com" class="form-input">
                  <p class="form-help">Se enviar&aacute; un correo de confirmaci&oacute;n a ambas direcciones.</p>
                </div>
                <button type="button" (click)="cambiarEmail()"
                  [disabled]="!nuevoEmail || guardando()"
                  class="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ guardando() ? 'Enviando...' : 'Cambiar Email' }}
                </button>
              </div>
            </div>

            <div class="card-surface">
              <div class="card-header">
                <h3 class="card-title">Cambiar Contrase&ntilde;a</h3>
                <p class="form-section-description">Eleg&iacute; una contrase&ntilde;a nueva para el acceso a tu cuenta.</p>
              </div>
              <div class="p-4 sm:p-6 space-y-5">
                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Nueva contrase&ntilde;a</label>
                  </div>
                  <input type="password" [(ngModel)]="nuevaPassword" placeholder="M&iacute;nimo 6 caracteres" class="form-input">
                  <p class="form-help">Us&aacute; al menos 6 caracteres para continuar.</p>
                </div>
                <div class="form-field">
                  <div class="form-label-row">
                    <label class="form-label">Confirmar contrase&ntilde;a</label>
                  </div>
                  <input type="password" [(ngModel)]="confirmarPassword" placeholder="Repetir contrase&ntilde;a" class="form-input">
                </div>
                <button type="button" (click)="cambiarPassword()"
                  [disabled]="!nuevaPassword || !confirmarPassword || guardando()"
                  class="btn-primary w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ guardando() ? 'Cambiando...' : 'Cambiar Contrase&ntilde;a' }}
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
  private readonly supabaseUrl = environment.supabase.url;
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

  private async getFreshAccessToken(): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('Sesion no activa');
    }

    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : null;
    const shouldRefresh = expiresAtMs !== null && (expiresAtMs - Date.now()) < 60_000;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        throw new Error('No se pudo refrescar la sesion');
      }

      const refreshedToken = data.session?.access_token;
      if (refreshedToken) {
        return refreshedToken;
      }
    }

    if (!session.access_token) {
      throw new Error('No se pudo obtener un token valido');
    }

    return session.access_token;
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
    } catch {
      this.mostrarMensaje('Error al cargar la configuraci\u00f3n.', 'error');
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
      const accessToken = await this.getFreshAccessToken();

      await this.contribuyenteService.cargarContribuyente();
      if (!this.contribuyenteService.contribuyente()) {
        this.mensajePadron.set({
          texto:
            'Primero toc\u00e1 "Guardar Datos de Facturaci\u00f3n" para crear tu perfil. Sin ese registro no podemos usar tu certificado para consultar la constancia.',
          tipo: 'error',
        });
        return;
      }

      const response = await fetch(`${this.supabaseUrl}/functions/v1/padron-lookup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: environment.supabase.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cuit }),
      });

      const result = await response.json();
      if (result && result.success) {
        const datos = result.data;
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

        this.mensajePadron.set({
          texto: '\u2714 Datos obtenidos desde Constancia de Inscripci\u00f3n ARCA',
          tipo: 'success',
        });
      } else {
        this.mensajePadron.set({ texto: result?.error || 'No se pudo obtener datos del CUIT', tipo: 'error' });
      }
    } catch (error: any) {
      this.mensajePadron.set({
        texto: error.message || 'Error al consultar la constancia de inscripci\u00f3n',
        tipo: 'error',
      });
    } finally {
      this.buscandoCuit.set(false);
    }
  }

  // ==================== GUARDAR FACTURACION ====================
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
        this.mostrarMensaje(result.success ? '\u2714 Datos de facturaci\u00f3n guardados.' : (result.error || 'Error al guardar.'), result.success ? 'success' : 'error');
      } else {
        const result = await this.contribuyenteService.crearContribuyente(payload);
        this.mostrarMensaje(result.success ? '\u2714 Contribuyente creado correctamente.' : (result.error || 'Error al crear.'), result.success ? 'success' : 'error');
      }
    } catch {
      this.mostrarMensaje('Error inesperado al guardar.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  // ==================== GUARDAR CERTIFICADO ====================
  async guardarCertificado() {
    this.guardando.set(true);

    try {
      const nextArcaProduction = this.certForm.get('arca_production')?.value ?? false;
      const payload: any = {
        arca_production: nextArcaProduction,
      };
      if (this.certModified) payload.arca_cert = this.certContent;
      if (this.keyModified) payload.arca_key = this.keyContent;

      let contribuyente = this.contribuyenteService.contribuyente();
      if (!contribuyente) {
        if (this.facturacionForm.invalid) {
          this.mostrarMensaje(
            'Complet\u00e1 los datos obligatorios en Facturaci\u00f3n (CUIT, raz\u00f3n social, punto de venta, concepto) o toc\u00e1 "Guardar Datos de Facturaci\u00f3n" antes de guardar el certificado.',
            'error',
          );
          return;
        }
        const f = this.facturacionForm.value;
        const createPayload: any = {
          cuit: f.cuit,
          razon_social: f.razon_social,
          nombre_fantasia: f.nombre_fantasia || null,
          domicilio: f.domicilio || null,
          condicion_iva: f.condicion_iva || 'Responsable Monotributo',
          ingresos_brutos: f.ingresos_brutos || null,
          inicio_actividades: f.inicio_actividades || null,
          punto_venta: parseInt(f.punto_venta, 10),
          tipo_comprobante_default: f.tipo_comprobante_default,
          concepto: f.concepto,
          iva_porcentaje: parseFloat(f.iva_porcentaje),
          actividad: f.actividad as 'bienes' | 'servicios',
        };
        const created = await this.contribuyenteService.crearContribuyente(createPayload);
        if (!created.success) {
          this.mostrarMensaje(created.error || 'No se pudo crear el perfil de contribuyente.', 'error');
          return;
        }
        contribuyente = this.contribuyenteService.contribuyente();
      }
      if (!contribuyente) {
        this.mostrarMensaje('No se pudo cargar el contribuyente.', 'error');
        return;
      }

      const environmentChanged = (contribuyente.arca_production ?? false) !== nextArcaProduction;
      if (this.certModified || this.keyModified || environmentChanged) {
        // El ticket WSAA cacheado depende del certificado y del entorno.
        payload.arca_ticket = null;
      }

      const result = await this.contribuyenteService.actualizarContribuyente(payload);
      if (result.success) {
        this.certModified = false;
        this.keyModified = false;
        this.mostrarMensaje(
          `\u2714 Certificado guardado correctamente (${nextArcaProduction ? 'Producci\u00f3n' : 'Testing / Homologaci\u00f3n'}).`,
          'success',
        );
      } else {
        this.mostrarMensaje(result.error || 'Error al guardar certificado.', 'error');
      }
    } catch {
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
        this.mostrarMensaje('\u2714 Se envi\u00f3 un email de confirmaci\u00f3n a ambas direcciones.', 'success');
        this.nuevoEmail = '';
      }
    } catch {
      this.mostrarMensaje('Error al cambiar email.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPassword() {
    if (!this.nuevaPassword || !this.confirmarPassword) return;
    if (this.nuevaPassword !== this.confirmarPassword) {
      this.mostrarMensaje('Las contrase\u00f1as no coinciden.', 'error');
      return;
    }
    if (this.nuevaPassword.length < 6) {
      this.mostrarMensaje('La contrase\u00f1a debe tener al menos 6 caracteres.', 'error');
      return;
    }

    this.guardando.set(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: this.nuevaPassword });
      if (error) {
        this.mostrarMensaje(error.message, 'error');
      } else {
        this.mostrarMensaje('\u2714 Contrase\u00f1a cambiada correctamente.', 'success');
        this.nuevaPassword = '';
        this.confirmarPassword = '';
      }
    } catch {
      this.mostrarMensaje('Error al cambiar contrase\u00f1a.', 'error');
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
