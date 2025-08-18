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
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.5 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
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
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            <span class="hidden sm:inline">Facturar</span>
          </button>
          
          <button 
            (click)="navigate('/listado')"
            class="flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-1 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base"
            [class]="isActive('/listado') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h6a2 2 0 002-2V7a2 2 0 00-2-2H9z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8"></path>
            </svg>
            <span class="hidden sm:inline">Listado</span>
          </button>
          
          <button 
            (click)="navigate('/totales')"
            class="flex-1 flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 px-1 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base"
            [class]="isActive('/totales') ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:text-gray-900'"
          >
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
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
