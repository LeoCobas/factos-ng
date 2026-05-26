import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService } from '../../core/services/theme.service';
import { getRuntimeConfig } from '../../core/config/runtime-config';
import { getFriendlyNetworkErrorMessage } from '../../core/utils/network-error.util';
import { supabase } from '../../core/services/supabase.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-4xl card-surface p-6 sm:p-8 space-y-6">
        
        <!-- Header -->
        <div class="text-center">
          <img [src]="logoSrc()" alt="Factos Logo" class="h-10 mx-auto mb-2" />
          <h2 class="text-2xl font-bold">Configuración de Facturación</h2>
          <p class="text-sm text-muted-foreground mt-1">Completá los pasos para poder emitir comprobantes autorizados por ARCA (AFIP).</p>
        </div>

        <!-- Progress Steps -->
        <div class="flex items-center justify-between border-b border-border pb-4">
          @for (step of [1, 2, 3, 4]; track step) {
            <div class="flex items-center gap-2">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors"
                [class.bg-primary]="currentStep() === step"
                [class.text-primary-foreground]="currentStep() === step"
                [class.bg-green-500]="currentStep() > step"
                [class.text-white]="currentStep() > step"
                [class.bg-muted]="currentStep() < step"
                [class.text-muted-foreground]="currentStep() < step"
              >
                @if (currentStep() > step) {
                  ✓
                } @else {
                  {{ step }}
                }
              </div>
              <span class="text-xs font-medium hidden sm:inline" [class.text-primary]="currentStep() === step">
                {{ getStepTitle(step) }}
              </span>
            </div>
            @if (step < 4) {
              <div class="flex-1 h-px bg-border mx-2"></div>
            }
          }
        </div>

        <!-- Error Alert -->
        @if (errorMessage()) {
          <div class="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {{ errorMessage() }}
          </div>
        }

        <!-- Wizard Views -->
        <div class="min-h-[300px]">
          
          <!-- STEP 1: Fiscal Data -->
          @if (currentStep() === 1) {
            <form [formGroup]="fiscalForm" class="space-y-4">
              <h3 class="text-lg font-semibold border-b border-border pb-1">1. Datos Fiscales</h3>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="form-field">
                  <label class="form-label">CUIT (11 dígitos, sin guiones)</label>
                  <div class="flex gap-2">
                    <input type="text" formControlName="cuit" class="form-input" placeholder="20123456789" />
                    <button
                      type="button"
                      [disabled]="buscandoCuit() || fiscalForm.controls.cuit.invalid"
                      (click)="buscarCuit()"
                      class="btn-primary rounded-lg px-4 text-sm font-semibold"
                    >
                      @if (buscandoCuit()) {
                        Buscando...
                      } @else {
                        Buscar
                      }
                    </button>
                  </div>
                  @if (fiscalForm.controls.cuit.touched && fiscalForm.controls.cuit.invalid) {
                    <p class="text-xs text-destructive mt-1">Ingresá un CUIT válido de 11 dígitos</p>
                  }
                </div>

                <div class="form-field">
                  <label class="form-label">Razón Social</label>
                  <input type="text" formControlName="razon_social" class="form-input" placeholder="Nombre completo o Empresa S.A." />
                </div>

                <div class="form-field">
                  <label class="form-label">Condición IVA</label>
                  <select formControlName="condicion_iva" class="form-select">
                    <option value="Responsable Monotributo">Responsable Monotributo</option>
                    <option value="Responsable Inscripto">Responsable Inscripto</option>
                    <option value="Exento">Exento</option>
                  </select>
                </div>

                <div class="form-field">
                  <label class="form-label">Domicilio Fiscal</label>
                  <input type="text" formControlName="domicilio" class="form-input" placeholder="Calle 123, Ciudad, Provincia" />
                </div>

                <div class="form-field col-span-1 sm:col-span-2">
                  <div class="grid grid-cols-3 gap-3">
                    <div>
                      <label class="form-label">Punto de Venta</label>
                      <input type="number" formControlName="punto_venta" class="form-input" placeholder="4" />
                    </div>
                    <div>
                      <label class="form-label">Concepto Facturado</label>
                      <select formControlName="concepto" class="form-select">
                        <option value="Servicios profesionales">Servicios profesionales</option>
                        <option value="Venta de bienes">Venta de bienes</option>
                        <option value="Productos y Servicios">Productos y Servicios</option>
                      </select>
                    </div>
                    <div>
                      <label class="form-label">Actividad principal</label>
                      <select formControlName="actividad" class="form-select">
                        <option value="servicios">Servicios</option>
                        <option value="bienes">Bienes / Productos</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          }

          <!-- STEP 2: CSR Request Generation -->
          @if (currentStep() === 2) {
            <div class="space-y-4">
              <h3 class="text-lg font-semibold border-b border-border pb-1">2. Solicitud de Certificado (CSR)</h3>
              <p class="text-sm text-muted-foreground">
                Generamos de forma segura una <strong>Clave Privada</strong> y una <strong>Solicitud de Certificado (CSR)</strong>. 
                La clave privada quedará cargada temporalmente en memoria, y se te descargará el archivo <code>.csr</code> para poder realizar la firma en el portal de ARCA.
              </p>

              @if (csr()) {
                <div class="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-3">
                  <p class="text-sm font-medium text-green-600 dark:text-green-400">
                    ✔ Par de claves generado. Descargamos tu archivo <code>factos-solicitud.csr</code>.
                  </p>
                  <button (click)="descargarCsr()" class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                    Descargar CSR Nuevamente
                  </button>
                </div>
              } @else {
                <div class="flex justify-center p-8">
                  <button
                    type="button"
                    [disabled]="generandoCsr()"
                    (click)="generarCsr()"
                    class="btn-primary rounded-lg px-6 py-3 font-bold shadow-sm"
                  >
                    @if (generandoCsr()) {
                      Generando Claves y Solicitud...
                    } @else {
                      Generar Clave Privada y CSR (.csr)
                    }
                  </button>
                </div>
              }
            </div>
          }

          <!-- STEP 3: ARCA Portal Instructions -->
          @if (currentStep() === 3) {
            <div class="space-y-4">
              <h3 class="text-lg font-semibold border-b border-border pb-1">3. Trámite en Portal ARCA (AFIP)</h3>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                  <h4 class="font-bold text-primary">Fase A: Crear el Certificado</h4>
                  <ol class="list-decimal pl-5 text-sm space-y-2 text-muted-foreground">
                    <li>Entrá a <a href="https://auth.afip.gob.ar" target="_blank" class="underline text-primary">ARCA con Clave Fiscal</a>.</li>
                    <li>Buscá <strong>"Administración de Certificados Digitales"</strong>.</li>
                    <li>Hacé clic en <strong>"Agregar Alias"</strong>.</li>
                    <li>Ingresá un alias (ej: <code>Factos</code>) y subí el archivo <strong>.csr</strong> descargado en el Paso 2.</li>
                    <li>Generá y descargá el archivo del certificado (<code>.crt</code> o <code>.cer</code>).</li>
                  </ol>
                </div>

                <div class="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
                  <h4 class="font-bold text-primary">Fase B: Delegar los 2 Servicios</h4>
                  <p class="text-xs text-muted-foreground">Debés asociar el nuevo Alias a estos servicios en ARCA:</p>
                  <ol class="list-decimal pl-5 text-sm space-y-2 text-muted-foreground">
                    <li>Entrá a <strong>"Administrador de Relaciones de Clave Fiscal"</strong>.</li>
                    <li>Hacé clic en <strong>"Nueva Relación"</strong> -> Buscar -> Logo ARCA -> <strong>"Servicios Interactivos"</strong>.</li>
                    <li>Asociá el Alias a <strong>Facturación Electrónica</strong> (wsfe).</li>
                    <li>Hacé el mismo proceso y asocialo a <strong>Consulta de Constancia de Inscripción</strong> (padron).</li>
                  </ol>
                </div>
              </div>
            </div>
          }

          <!-- STEP 4: Upload CRT and Save -->
          @if (currentStep() === 4) {
            <div class="space-y-4">
              <h3 class="text-lg font-semibold border-b border-border pb-1">4. Subir Certificado y Finalizar</h3>
              <p class="text-sm text-muted-foreground">
                Subí el archivo de certificado <code>.crt</code> o <code>.cer</code> descargado de la web de ARCA en el paso anterior.
              </p>

              <div class="form-field">
                <label class="form-label">Archivo Certificado (.crt / .cer)</label>
                <div class="flex items-center gap-3">
                  <label
                    class="file-dropzone flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors"
                  >
                    <input
                      type="file"
                      accept=".crt,.cer,.pem"
                      class="hidden"
                      (change)="onCertFileSelected($event)"
                    />
                    <svg class="h-8 w-8 text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    @if (certFileName()) {
                      <span class="text-sm font-semibold text-primary">{{ certFileName() }}</span>
                    } @else {
                      <span class="text-sm text-muted-foreground">Seleccionar certificado .crt / .cer</span>
                    }
                  </label>
                </div>
              </div>
            </div>
          }

        </div>

        <!-- Footer Actions -->
        <div class="flex justify-between pt-4 border-t border-border">
          <button
            type="button"
            [disabled]="currentStep() === 1 || guardandoOnboarding()"
            (click)="prevStep()"
            class="btn-secondary rounded-lg px-4 py-2 text-sm font-semibold border border-border"
          >
            Atrás
          </button>

          @if (currentStep() < 4) {
            <button
              type="button"
              [disabled]="isNextDisabled()"
              (click)="nextStep()"
              class="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
            >
              Siguiente
            </button>
          } @else {
            <button
              type="button"
              [disabled]="!certFileContent() || guardandoOnboarding()"
              (click)="guardarOnboarding()"
              class="btn-primary rounded-lg px-6 py-2 text-sm font-semibold"
            >
              @if (guardandoOnboarding()) {
                Guardando configuración...
              } @else {
                Guardar y Empezar a Facturar
              }
            </button>
          }
        </div>

      </div>
    </div>
  `,
})
export class OnboardingComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly contribuyenteService = inject(ContribuyenteService);
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  readonly currentStep = signal(1);
  readonly buscandoCuit = signal(false);
  readonly generandoCsr = signal(false);
  readonly guardandoOnboarding = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly privateKey = signal<string | null>(null);
  readonly csr = signal<string | null>(null);
  readonly certFileName = signal<string | null>(null);
  readonly certFileContent = signal<string | null>(null);

  readonly logoSrc = computed(() => (this.themeService.isDark() ? '/logob.png' : '/logo.png'));

  readonly fiscalForm: FormGroup = this.fb.group({
    cuit: ['', [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
    razon_social: ['', Validators.required],
    domicilio: [''],
    condicion_iva: ['Responsable Monotributo', Validators.required],
    punto_venta: [4, [Validators.required, Validators.min(1)]],
    concepto: ['Servicios profesionales', Validators.required],
    actividad: ['servicios', Validators.required],
    iva_porcentaje: [21.00]
  });

  getStepTitle(step: number): string {
    const titles = ['Datos Fiscales', 'Generar CSR', 'Trámite ARCA', 'Subir Certificado'];
    return titles[step - 1];
  }

  isNextDisabled(): boolean {
    if (this.currentStep() === 1) return this.fiscalForm.invalid || this.buscandoCuit();
    if (this.currentStep() === 2) return !this.csr();
    return false;
  }

  prevStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update(s => s - 1);
      this.errorMessage.set(null);
    }
  }

  nextStep(): void {
    if (this.currentStep() < 4) {
      this.currentStep.update(s => s + 1);
      this.errorMessage.set(null);
    }
  }

  async buscarCuit(): Promise<void> {
    const cuit = this.fiscalForm.value.cuit;
    if (!cuit || cuit.length !== 11) return;

    this.buscandoCuit.set(true);
    this.errorMessage.set(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) throw new Error('Sesión de usuario no válida');

      const response = await fetch(`${getRuntimeConfig().supabase.url}/functions/v1/padron-lookup`, {
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
        this.fiscalForm.patchValue({
          razon_social: result.data.razon_social || '',
          domicilio: result.data.domicilio || '',
          condicion_iva: result.data.condicion_iva || 'Responsable Monotributo'
        });
      } else {
        this.errorMessage.set(result.error || 'No se pudieron consultar los datos del CUIT automáticamente. Podés rellenar el formulario de forma manual.');
      }
    } catch (error: any) {
      this.errorMessage.set(getFriendlyNetworkErrorMessage(
        error,
        'Error de conexión al consultar el CUIT. Podés completar los campos manualmente.',
      ));
    } finally {
      this.buscandoCuit.set(false);
    }
  }

  async generarCsr(): Promise<void> {
    this.generandoCsr.set(true);
    this.errorMessage.set(null);

    const { cuit, razon_social } = this.fiscalForm.value;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const response = await fetch(`${getRuntimeConfig().supabase.url}/functions/v1/generate-csr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: getRuntimeConfig().supabase.anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ cuit, razon_social }),
      });

      const result = await response.json();
      if (result && result.success) {
        this.csr.set(result.csr);
        this.privateKey.set(result.private_key);
        this.descargarCsr();
      } else {
        this.errorMessage.set(result.error || 'Error al generar la solicitud de certificado.');
      }
    } catch (error: any) {
      this.errorMessage.set(getFriendlyNetworkErrorMessage(error, 'Error al conectar con el servidor criptográfico.'));
    } finally {
      this.generandoCsr.set(false);
    }
  }

  descargarCsr(): void {
    const data = this.csr();
    if (!data) return;

    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factos-cuit-${this.fiscalForm.value.cuit}.csr`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onCertFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.certFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      this.certFileContent.set(reader.result as string);
    };
    reader.readAsText(file);
  }

  async guardarOnboarding(): Promise<void> {
    if (!this.certFileContent() || !this.privateKey()) {
      this.errorMessage.set('Falta cargar el certificado o generar la clave privada.');
      return;
    }

    this.guardandoOnboarding.set(true);
    this.errorMessage.set(null);

    try {
      const fiscalData = this.fiscalForm.getRawValue();
      const payload = {
        cuit: fiscalData.cuit,
        razon_social: fiscalData.razon_social,
        nombre_fantasia: fiscalData.razon_social,
        domicilio: fiscalData.domicilio || null,
        condicion_iva: fiscalData.condicion_iva,
        ingresos_brutos: fiscalData.cuit,
        inicio_actividades: new Date().toISOString().split('T')[0],
        punto_venta: Number(fiscalData.punto_venta),
        concepto: fiscalData.concepto,
        iva_porcentaje: Number(fiscalData.iva_porcentaje),
        actividad: fiscalData.actividad,
        monto_maximo_factura: 0,
        arca_cert: this.certFileContent(),
        arca_key: this.privateKey(),
        arca_production: false,
        arca_ticket: null,
      };

      const result = await this.contribuyenteService.crearContribuyente(payload);

      if (result.success) {
        await this.contribuyenteService.cargarContribuyente();
        await this.router.navigate(['/']);
      } else {
        this.errorMessage.set(result.error || 'Error al guardar los datos de onboarding.');
      }
    } catch (error: any) {
      this.errorMessage.set(getFriendlyNetworkErrorMessage(error, 'Error de red al guardar la configuración.'));
    } finally {
      this.guardandoOnboarding.set(false);
    }
  }
}
