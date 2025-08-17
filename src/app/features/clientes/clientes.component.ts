import { Component } from '@angular/core';

@Component({
  selector: 'app-clientes',
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Clientes</h2>
        <p class="text-gray-600">
          Gestiona tu lista de clientes
        </p>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="p-6">
          <h3 class="text-lg font-semibold">Lista de Clientes</h3>
        </div>
        <div class="p-6 pt-0">
          <div class="text-center py-8 text-gray-600">
            No hay clientes registrados
          </div>
        </div>
      </div>
    </div>
  `
})
export class ClientesComponent {}
