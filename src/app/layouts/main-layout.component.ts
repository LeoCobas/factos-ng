import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-main-layout',
  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header with logo and config -->
      <div class="bg-white p-3 sm:p-4">
        <div class="flex items-center justify-between mb-4 sm:mb-6">
          <!-- Nuevo logo PNG -->
          <div class="flex items-center">
            <img 
              src="/logo.png" 
              alt="Factos Logo" 
              class="h-10 sm:h-12 w-auto"
              style="max-height: 40px; sm:max-height: 48px;"
            />
          </div>
          
          <button 
            (click)="navigate('/configuracion')"
            class="flex items-center space-x-1 sm:space-x-2 text-gray-600 hover:text-gray-900"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
            <span class="text-xs sm:text-sm">Configuración</span>
          </button>
        </div>

        <!-- Navigation tabs -->
        <div class="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button 
            (click)="navigate('/facturar')"
            class="flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-1 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base"
            [class]="isActive('/facturar') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
              <path d="M12 17.5v-11"/>
            </svg>
            <span class="hidden sm:inline">Facturar</span>
          </button>
          
          <button 
            (click)="navigate('/listado')"
            class="flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-1 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base"
            [class]="isActive('/listado') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12h.01"/>
              <path d="M3 18h.01"/>
              <path d="M3 6h.01"/>
              <path d="M8 12h13"/>
              <path d="M8 18h13"/>
              <path d="M8 6h13"/>
            </svg>
            <span class="hidden sm:inline">Listado</span>
          </button>
          
          <button 
            (click)="navigate('/totales')"
            class="flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-1 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base"
            [class]="isActive('/totales') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 3v16a2 2 0 0 0 2 2h16"/>
              <path d="M18 17V9"/>
              <path d="M13 17V5"/>
              <path d="M8 17v-3"/>
            </svg>
            <span class="hidden sm:inline">Totales</span>
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <main class="p-3 sm:p-4">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  imports: [RouterOutlet]
})
export class MainLayoutComponent {
  constructor(private router: Router) {}

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
