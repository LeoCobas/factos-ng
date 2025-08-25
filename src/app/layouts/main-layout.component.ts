import { Component, signal, computed, effect } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-main-layout',
  template: `
    <div class="min-h-screen bg-background">
      <!-- Header with logo and config -->
      <div class="bg-card border-b border-border shadow-sm p-3 sm:p-4">
        <div class="flex items-center justify-between mb-4 sm:mb-6">
          <!-- Logo que cambia según el tema -->
          <div class="flex items-center">
            <img 
              [src]="logoSrc()" 
              alt="Factos Logo" 
              class="h-10 sm:h-12 w-auto"
              style="max-height: 40px; sm:max-height: 48px;"
            />
          </div>
          
          <button 
            (click)="navigate('/configuracion')"
            class="ml-auto flex items-center space-x-2 rounded-md header-btn transition-all duration-200"
            [class]="isActive('/configuracion') ? 'ml-auto flex items-center space-x-2 rounded-md header-btn nav-btn-active' : 'ml-auto flex items-center space-x-2 rounded-md header-btn text-muted-foreground hover:text-foreground hover:bg-background/50'"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span class="truncate">Configuración</span>
          </button>
        </div>

        <!-- Navigation tabs -->
        <div class="flex bg-muted rounded-lg p-1 shadow-sm border border-border">
          <button 
            (click)="navigate('/facturar')"
            class="flex-1 flex items-center justify-center space-x-0.5 sm:space-x-2 nav-button-mobile rounded-md font-medium transition-all duration-200 nav-button-text min-w-0"
            [class]="isActive('/facturar') ? 'nav-btn-active' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
              <path d="M12 17.5v-11"/>
            </svg>
            <span class="truncate">Facturar</span>
          </button>
          
          <button 
            (click)="navigate('/listado')"
            class="flex-1 flex items-center justify-center space-x-0.5 sm:space-x-2 nav-button-mobile rounded-md font-medium transition-all duration-200 nav-button-text min-w-0"
            [class]="isActive('/listado') ? 'nav-btn-active' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            class="flex-1 flex items-center justify-center space-x-0.5 sm:space-x-2 nav-button-mobile rounded-md font-medium transition-all duration-200 nav-button-text min-w-0"
            [class]="isActive('/totales') ? 'nav-btn-active' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
            <span class="truncate">Totales</span>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <main class="p-3 sm:p-4 bg-background min-h-screen">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  imports: [RouterOutlet]
})
export class MainLayoutComponent {
  // Signal para detectar el tema actual
  isDarkTheme = signal(false);

  // Computed para el logo según el tema
  logoSrc = computed(() => {
    return this.isDarkTheme() ? '/logob.png' : '/logo.png';
  });

  constructor(private router: Router) {
    // Detectar tema inicial
    this.updateTheme();

    // Observar cambios en el tema
    effect(() => {
      const observer = new MutationObserver(() => {
        this.updateTheme();
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      // Cleanup en destroy
      return () => observer.disconnect();
    });
  }

  private updateTheme() {
    const isDark = document.documentElement.classList.contains('dark-theme');
    this.isDarkTheme.set(isDark);
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }

  isActive(path: string): boolean {
    return this.router.url === path;
  }

  async signOut() {
    // Por ahora, solo navegar al login
    this.router.navigate(['/login']);
  }
}
