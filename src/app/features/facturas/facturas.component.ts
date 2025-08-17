import { Component } from '@angular/core';

@Component({
  selector: 'app-facturas',
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Facturas</h2>
        <p class="text-gray-600">
          Gestiona y crea tus facturas
        </p>
      </div>

      <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div class="p-6">
          <h3 class="text-lg font-semibold">Lista de Facturas</h3>
        </div>
        <div class="p-6 pt-0">
          <div class="text-center py-8 text-gray-600">
            No hay facturas creadas
          </div>
        </div>
      </div>
    </div>
  `
})
export class FacturasComponent {}
