import { Component } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-main-layout',
  template: `
    <div class="min-h-screen bg-white">
      <!-- Header -->
      <header class="border-b bg-white">
        <div class="container mx-auto flex h-16 items-center px-4">
          <div class="flex items-center space-x-4">
            <h1 class="text-xl font-bold text-blue-600">FACTOS</h1>
            
            <nav class="flex items-center space-x-6 text-sm font-medium">
              <a 
                (click)="navigate('/facturar')" 
                class="transition-colors hover:text-gray-900 cursor-pointer"
                [class.text-gray-900]="isActive('/facturar')"
                [class.text-gray-600]="!isActive('/facturar')"
              >
                Facturar
              </a>
              <a 
                (click)="navigate('/listado')" 
                class="transition-colors hover:text-gray-900 cursor-pointer"
                [class.text-gray-900]="isActive('/listado')"
                [class.text-gray-600]="!isActive('/listado')"
              >
                Listado
              </a>
              <a 
                (click)="navigate('/totales')" 
                class="transition-colors hover:text-gray-900 cursor-pointer"
                [class.text-gray-900]="isActive('/totales')"
                [class.text-gray-600]="!isActive('/totales')"
              >
                Totales
              </a>
              <a 
                (click)="navigate('/configuracion')" 
                class="transition-colors hover:text-gray-900 cursor-pointer"
                [class.text-gray-900]="isActive('/configuracion')"
                [class.text-gray-600]="!isActive('/configuracion')"
              >
                Configuración
              </a>
            </nav>
          </div>
          
          <div class="ml-auto flex items-center space-x-4">
            <span class="text-sm text-gray-600">
              Usuario conectado
            </span>
            <button 
              (click)="signOut()"
              class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="container mx-auto py-6 px-4">
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
