import { Component, inject, OnInit, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import type { CreateContribuyentePayload } from '../../core/services/contribuyente.service';
import { ThemeService, ThemeMode } from '../../core/services/theme.service';
import { getRuntimeConfig } from '../../core/config/runtime-config';
import { supabase } from '../../core/services/supabase.service';
import { ContribuyenteUpdate } from '../../core/types/database.types';
import {
  AccountFormModel,
  Actividad,
  CertFormModel,
  FacturacionFormModel,
  MensajeEstado,
  TabId,
} from './configuracion.types';
import { ConfiguracionFacturacionFormComponent } from './configuracion-facturacion-form.component';
import { ConfiguracionCertificadoFormComponent } from './configuracion-certificado-form.component';
import { ConfiguracionCuentaFormComponent } from './configuracion-cuenta-form.component';
import { getFriendlyNetworkErrorMessage } from '../../core/utils/network-error.util';

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
          <app-configuracion-facturacion-form
            [form]="facturacionForm"
            [buscandoCuit]="buscandoCuit()"
            [guardando]="guardando()"
            [mensajePadron]="mensajePadron()"
            [mensaje]="mensaje()"
            (buscarCuit)="buscarCuit()"
            (guardar)="guardarFacturacion()"
          />
        }

        @if (tabActiva() === 'certificado') {
          <app-configuracion-certificado-form
            [form]="certForm"
            [tieneCert]="tieneCert()"
            [tieneKey]="tieneKey()"
            [certFileName]="certFileName()"
            [keyFileName]="keyFileName()"
            [guardando]="guardando()"
            [mensaje]="mensaje()"
            (guardar)="guardarCertificado()"
            (certSelected)="onCertFileSelected($event)"
            (keySelected)="onKeyFileSelected($event)"
            (borrarCert)="borrarCert()"
            (borrarKey)="borrarKey()"
          />
        }

        @if (tabActiva() === 'cuenta') {
          <app-configuracion-cuenta-form
            [form]="accountForm"
            [emailActual]="emailActual()"
            [theme]="themeService.theme()"
            [guardando]="guardando()"
            [mensaje]="mensaje()"
            (themeChange)="setTheme($event)"
            (changeEmail)="cambiarEmail()"
            (changePassword)="cambiarPassword()"
          />
        }
      }
    </div>
  `,
  imports: [
    ReactiveFormsModule,
    ConfiguracionFacturacionFormComponent,
    ConfiguracionCertificadoFormComponent,
    ConfiguracionCuentaFormComponent,
  ],
  standalone: true
})
export class ConfiguracionComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
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

  readonly facturacionForm: FormGroup<FacturacionFormModel>;
  readonly certForm: FormGroup<CertFormModel>;
  readonly accountForm: FormGroup<AccountFormModel>;

  constructor() {
    this.facturacionForm = this.fb.group({
      cuit: this.fb.control('', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]),
      razon_social: this.fb.control('', Validators.required),
      nombre_fantasia: this.fb.control(''),
      domicilio: this.fb.control(''),
      condicion_iva: this.fb.control('Responsable Monotributo'),
      ingresos_brutos: this.fb.control(''),
      inicio_actividades: this.fb.control(''),
      punto_venta: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1),
        Validators.max(9999),
      ]),
      concepto: this.fb.control('', Validators.required),
      iva_porcentaje: this.fb.control('21.00'),
      actividad: this.fb.control<Actividad>('servicios'),
      monto_maximo_factura: this.fb.control<number | null>(0, [Validators.min(0)]),
    });

    this.certForm = this.fb.group({
      arca_production: this.fb.control(false),
    });

    this.accountForm = this.fb.group({
      nuevoEmail: this.fb.control('', [Validators.email]),
      nuevaPassword: this.fb.control(''),
      confirmarPassword: this.fb.control(''),
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
          punto_venta: c.punto_venta ?? 4,
          concepto: c.concepto || '',
          iva_porcentaje: Number(c.iva_porcentaje).toFixed(2),
          actividad: (c.actividad as Actividad) || 'servicios',
          monto_maximo_factura: Number(c.monto_maximo_factura ?? 0),
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
    const cuit = this.facturacionForm.controls.cuit.value;
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
          apikey: getRuntimeConfig().supabase.anonKey,
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
        if (!this.facturacionForm.controls.ingresos_brutos.value) {
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
        texto: getFriendlyNetworkErrorMessage(
          error,
          error?.message || 'Error al consultar la constancia de inscripci\u00f3n',
        ),
        tipo: 'error',
      });
    } finally {
      this.buscandoCuit.set(false);
    }
  }

  private get supabaseUrl(): string {
    return getRuntimeConfig().supabase.url;
  }

  // ==================== GUARDAR FACTURACION ====================
  async guardarFacturacion() {
    if (this.facturacionForm.invalid) return;
    this.guardando.set(true);

    try {
      const payload = this.buildFacturacionPayload();

      const contribuyente = this.contribuyenteService.contribuyente();

      if (contribuyente) {
        const result = await this.contribuyenteService.actualizarContribuyente(payload);
        this.mostrarMensaje(result.success ? '\u2714 Datos de facturaci\u00f3n guardados.' : (result.error || 'Error al guardar.'), result.success ? 'success' : 'error');
      } else {
        const createPayload = this.buildCreateContribuyentePayload();
        const result = await this.contribuyenteService.crearContribuyente(createPayload);
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
      const nextArcaProduction = this.certForm.controls.arca_production.value;
      const payload: ContribuyenteUpdate = {
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
        const createPayload = this.buildCreateContribuyentePayload();
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
    const nuevoEmail = this.accountForm.controls.nuevoEmail.value.trim();
    if (!nuevoEmail || this.accountForm.controls.nuevoEmail.invalid) return;
    this.guardando.set(true);

    try {
      const { error } = await supabase.auth.updateUser({ email: nuevoEmail });
      if (error) {
        this.mostrarMensaje(error.message, 'error');
      } else {
        this.mostrarMensaje('\u2714 Se envi\u00f3 un email de confirmaci\u00f3n a ambas direcciones.', 'success');
        this.accountForm.controls.nuevoEmail.reset('');
      }
    } catch {
      this.mostrarMensaje('Error al cambiar email.', 'error');
    } finally {
      this.guardando.set(false);
    }
  }

  async cambiarPassword() {
    const { nuevaPassword, confirmarPassword } = this.accountForm.getRawValue();
    if (!nuevaPassword || !confirmarPassword) return;
    if (nuevaPassword !== confirmarPassword) {
      this.mostrarMensaje('Las contrase\u00f1as no coinciden.', 'error');
      return;
    }
    if (nuevaPassword.length < 6) {
      this.mostrarMensaje('La contrase\u00f1a debe tener al menos 6 caracteres.', 'error');
      return;
    }

    this.guardando.set(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
      if (error) {
        this.mostrarMensaje(error.message, 'error');
      } else {
        this.mostrarMensaje('\u2714 Contrase\u00f1a cambiada correctamente.', 'success');
        this.accountForm.patchValue({
          nuevaPassword: '',
          confirmarPassword: '',
        });
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

  private buildFacturacionPayload(): ContribuyenteUpdate {
    const raw = this.facturacionForm.getRawValue();

    return {
      cuit: raw.cuit,
      razon_social: raw.razon_social,
      nombre_fantasia: raw.nombre_fantasia || null,
      domicilio: raw.domicilio || null,
      condicion_iva: raw.condicion_iva || 'Responsable Monotributo',
      ingresos_brutos: raw.ingresos_brutos || null,
      inicio_actividades: raw.inicio_actividades || null,
      punto_venta: raw.punto_venta ?? null,
      concepto: raw.concepto,
      iva_porcentaje: Number.parseFloat(raw.iva_porcentaje),
      actividad: raw.actividad,
      monto_maximo_factura: raw.monto_maximo_factura && raw.monto_maximo_factura > 0
        ? raw.monto_maximo_factura
        : 0,
    };
  }

  private buildCreateContribuyentePayload(): CreateContribuyentePayload {
    const raw = this.facturacionForm.getRawValue();

    return {
      cuit: raw.cuit,
      razon_social: raw.razon_social,
      nombre_fantasia: raw.nombre_fantasia || null,
      domicilio: raw.domicilio || null,
      condicion_iva: raw.condicion_iva || 'Responsable Monotributo',
      ingresos_brutos: raw.ingresos_brutos || null,
      inicio_actividades: raw.inicio_actividades || null,
      punto_venta: raw.punto_venta ?? null,
      concepto: raw.concepto,
      iva_porcentaje: Number.parseFloat(raw.iva_porcentaje),
      actividad: raw.actividad,
      monto_maximo_factura: raw.monto_maximo_factura && raw.monto_maximo_factura > 0
        ? raw.monto_maximo_factura
        : 0,
      arca_cert: null,
      arca_key: null,
      arca_production: false,
      arca_ticket: null,
    };
  }

  setTheme(theme: ThemeMode): void {
    this.themeService.setTheme(theme);
  }
}
