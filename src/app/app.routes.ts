import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'clientes',
        loadComponent: () => import('./features/clientes/clientes.component').then(m => m.ClientesComponent)
      },
      {
        path: 'facturas',
        loadComponent: () => import('./features/facturas/facturas.component').then(m => m.FacturasComponent)
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./features/configuracion/configuracion.component').then(m => m.ConfiguracionComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
