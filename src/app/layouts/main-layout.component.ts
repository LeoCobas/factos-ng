import { Component, computed, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ContribuyenteService } from '../core/services/contribuyente.service';
import { ThemeService } from '../core/services/theme.service';
import { ConfiguracionComponent } from '../features/configuracion/configuracion.component';

@Component({
  selector: 'app-main-layout',
  template: `
    <div class="min-h-screen bg-background flex flex-col">
      <div
        data-app-header
        class="bg-card/96 px-3 py-3 backdrop-blur sm:px-4 sm:py-4"
      >
        <div class="mx-auto flex max-w-5xl flex-col gap-3">
          <div class="relative flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center flex-shrink-0">
              <img
                [src]="logoSrc()"
                alt="Factos Logo"
                class="h-10 w-auto sm:h-11"
                style="max-height: 44px;"
              />
            </div>

            <div class="ml-auto flex items-center gap-2">
              @if (contribuyenteService.inicializado() && contribuyenteService.contribuyente()) {
                <div #contribuyentePreviewTrigger class="relative flex items-center">
                  <button
                    type="button"
                    (click)="toggleContribuyentePreview()"
                    class="header-icon-btn"
                    [attr.aria-expanded]="mostrarContribuyentePreview()"
                    aria-label="Ver datos del contribuyente"
                    title="Ver datos del contribuyente"
                  >
                    <svg class="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"></path>
                    </svg>
                  </button>

                  <div
                    class="contribuyente-preview"
                    [class.contribuyente-preview--visible]="mostrarContribuyentePreview()"
                  >
                    <div class="contribuyente-badge">
                      <button
                        type="button"
                        (click)="abrirConfiguracionDesdeContribuyente()"
                        class="contribuyente-badge__main"
                      >
                        <span class="contribuyente-badge__icon">
                          <svg class="h-4 w-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5m-4 0h4"></path>
                          </svg>
                        </span>
                        <span class="min-w-0">
                          <span class="block truncate text-sm font-semibold text-foreground">
                            {{ contribuyenteService.contribuyente()!.razon_social }}
                          </span>
                          <span class="block truncate text-[0.72rem] uppercase tracking-[0.18em] text-muted-foreground/90">
                            CUIT {{ formatCuit(contribuyenteService.contribuyente()!.cuit) }}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        (click)="signOut()"
                        class="contribuyente-badge__logout"
                        aria-label="Cerrar sesion"
                        title="Cerrar sesion"
                      >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                          <path d="M16 17l5-5-5-5"></path>
                          <path d="M21 12H9"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              }

              <button
                type="button"
                (click)="abrirConfiguracion()"
                class="header-btn header-btn-idle"
                [attr.aria-expanded]="mostrarConfiguracion()"
                aria-haspopup="dialog"
              >
                <svg class="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <circle cx="12" cy="12" r="4"/>
                </svg>
                <span class="truncate">Configuraci&oacute;n</span>
              </button>
            </div>

          </div>

          @if (contribuyenteService.inicializado()) {
            @if (contribuyenteService.errorCarga()) {
              <div class="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span>{{ contribuyenteService.errorCarga() }}</span>
              </div>
            }

            @if (!contribuyenteService.contribuyente()) {
              <div
                class="flex items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-sm text-destructive cursor-pointer"
                role="button"
                tabindex="0"
                (click)="abrirConfiguracion()"
                (keydown.enter)="abrirConfiguracion()"
                (keydown.space)="abrirConfiguracion()"
              >
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
                <span class="font-medium">Configur&aacute; tus datos de contribuyente para facturar</span>
              </div>
            }
          }

          <div class="nav-strip">
            <button
              (click)="navigate('/facturar')"
              class="nav-button-mobile nav-button-text min-w-0 flex-1"
              [class.nav-btn-active]="isActive('/facturar')"
              [class.nav-btn-idle]="!isActive('/facturar')"
            >
              <svg class="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                <path d="M12 17.5v-11"/>
              </svg>
              <span class="truncate">Facturar</span>
            </button>

            <button
              (click)="navigate('/listado')"
              class="nav-button-mobile nav-button-text min-w-0 flex-1"
              [class.nav-btn-active]="isActive('/listado')"
              [class.nav-btn-idle]="!isActive('/listado')"
            >
              <svg class="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12h.01"/>
                <path d="M3 18h.01"/>
                <path d="M3 6h.01"/>
                <path d="M8 12h13"/>
                <path d="M8 18h13"/>
                <path d="M8 6h13"/>
              </svg>
              <span class="truncate">Listado</span>
            </button>

            <button
              (click)="navigate('/totales')"
              class="nav-button-mobile nav-button-text min-w-0 flex-1"
              [class.nav-btn-active]="isActive('/totales')"
              [class.nav-btn-idle]="!isActive('/totales')"
            >
              <svg class="h-4 w-4 sm:h-[1.05rem] sm:w-[1.05rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
                <path d="M18 17V9"/>
                <path d="M13 17V5"/>
                <path d="M8 17v-3"/>
              </svg>
              <span class="truncate">Totales</span>
            </button>
          </div>
        </div>
      </div>

      <main class="flex-1 bg-background px-3 py-3 sm:px-4 sm:py-4">
        <div class="mx-auto max-w-5xl">
          <router-outlet></router-outlet>
        </div>
      </main>

      @if (mostrarConfiguracion()) {
        <div
          class="config-modal-backdrop"
          role="presentation"
          (click)="cerrarConfiguracion()"
        >
          <section
            class="config-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-modal-title"
            (click)="$event.stopPropagation()"
          >
            <header class="config-modal-header">
              <div class="config-modal-title-group">
                <span class="config-modal-icon" aria-hidden="true">
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <circle cx="12" cy="12" r="4"/>
                  </svg>
                </span>
                <h2 id="config-modal-title">Configuraci&oacute;n</h2>
              </div>
              <button
                type="button"
                (click)="cerrarConfiguracion()"
                class="config-modal-close"
                aria-label="Cerrar configuracion"
                title="Cerrar"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18"></path>
                  <path d="m6 6 12 12"></path>
                </svg>
              </button>
            </header>

            <div class="config-modal-body">
              <app-configuracion />
            </div>
          </section>
        </div>
      }
    </div>
  `,
  imports: [RouterOutlet, ConfiguracionComponent],
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly contribuyentePreviewTrigger = viewChild<ElementRef<HTMLElement>>('contribuyentePreviewTrigger');
  readonly contribuyenteService = inject(ContribuyenteService);
  readonly themeService = inject(ThemeService);

  readonly logoSrc = computed(() => (this.themeService.isDark() ? '/logob.png' : '/logo.png'));
  readonly mostrarContribuyentePreview = signal(false);
  readonly mostrarConfiguracion = signal(false);

  private contribuyentePreviewTimer: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit() {
    await this.contribuyenteService.cargarContribuyente();
    this.mostrarPreviewContribuyente();
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: PointerEvent): void {
    if (!this.mostrarContribuyentePreview()) {
      return;
    }

    const triggerElement = this.contribuyentePreviewTrigger()?.nativeElement;
    const target = event.target as Node | null;
    if (!triggerElement || !target || triggerElement.contains(target)) {
      return;
    }

    this.ocultarPreviewContribuyente();
  }

  @HostListener('document:keydown.escape')
  onDocumentEscape(): void {
    this.cerrarConfiguracion();
    this.ocultarPreviewContribuyente();
  }

  ngOnDestroy(): void {
    this.clearContribuyentePreviewTimer();
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  formatCuit(cuit: string): string {
    if (!cuit || cuit.length !== 11) return cuit;
    return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;
  }

  toggleContribuyentePreview(): void {
    if (this.mostrarContribuyentePreview()) {
      this.ocultarPreviewContribuyente();
      return;
    }

    this.mostrarPreviewContribuyente();
  }

  abrirConfiguracionDesdeContribuyente(): void {
    this.ocultarPreviewContribuyente();
    this.abrirConfiguracion();
  }

  abrirConfiguracion(): void {
    this.ocultarPreviewContribuyente();
    this.mostrarConfiguracion.set(true);
  }

  cerrarConfiguracion(): void {
    this.mostrarConfiguracion.set(false);
  }

  private mostrarPreviewContribuyente(): void {
    if (!this.contribuyenteService.contribuyente()) {
      return;
    }

    this.clearContribuyentePreviewTimer();
    this.mostrarContribuyentePreview.set(true);
    this.contribuyentePreviewTimer = setTimeout(() => {
      this.mostrarContribuyentePreview.set(false);
      this.contribuyentePreviewTimer = null;
    }, 3000);
  }

  private ocultarPreviewContribuyente(): void {
    this.clearContribuyentePreviewTimer();
    this.mostrarContribuyentePreview.set(false);
  }

  private clearContribuyentePreviewTimer(): void {
    if (this.contribuyentePreviewTimer !== null) {
      clearTimeout(this.contribuyentePreviewTimer);
      this.contribuyentePreviewTimer = null;
    }
  }

  async signOut() {
    this.ocultarPreviewContribuyente();
    await this.authService.signOut();
  }
}
