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
        path: 'facturar',
        loadComponent: () => import('./features/facturar/facturar.component').then(m => m.FacturarComponent)
      },
      {
        path: 'listado',
        loadComponent: () => import('./features/listado/listado.component').then(m => m.ListadoComponent)
      },
      {
        path: 'totales',
        loadComponent: () => import('./features/totales/totales.component').then(m => m.TotalesComponent)
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
