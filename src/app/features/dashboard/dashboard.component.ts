import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="space-y-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p class="text-gray-600">
          Resumen de tu actividad de facturación
        </p>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="text-sm font-medium">
              Total Facturas
            </h3>
          </div>
          <div>
            <div class="text-2xl font-bold">0</div>
            <p class="text-xs text-gray-600">
              Este mes
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="text-sm font-medium">
              Ingresos
            </h3>
          </div>
          <div>
            <div class="text-2xl font-bold">$0</div>
            <p class="text-xs text-gray-600">
              Este mes
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="text-sm font-medium">
              Clientes
            </h3>
          </div>
          <div>
            <div class="text-2xl font-bold">0</div>
            <p class="text-xs text-gray-600">
              Total registrados
            </p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div class="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 class="text-sm font-medium">
              Pendientes
            </h3>
          </div>
          <div>
            <div class="text-2xl font-bold">0</div>
            <p class="text-xs text-gray-600">
              Facturas pendientes
            </p>
          </div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div class="col-span-4 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="p-6">
            <h3 class="text-lg font-semibold">Últimas Facturas</h3>
          </div>
          <div class="p-6 pt-0">
            <div class="text-sm text-gray-600 text-center py-8">
              No hay facturas recientes
            </div>
          </div>
        </div>

        <div class="col-span-3 rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="p-6">
            <h3 class="text-lg font-semibold">Acciones Rápidas</h3>
          </div>
          <div class="p-6 pt-0 space-y-2">
            <div class="text-sm text-gray-600">
              • Nueva factura
            </div>
            <div class="text-sm text-gray-600">
              • Agregar cliente
            </div>
            <div class="text-sm text-gray-600">
              • Ver reportes
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardComponent {}
