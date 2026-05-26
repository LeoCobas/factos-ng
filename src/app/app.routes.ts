import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [guestGuard]
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent),
    canActivate: [authGuard]
  },
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'facturar',
        pathMatch: 'full'
      },
      {
        path: 'facturar',
        loadComponent: () => import('./features/facturar/facturar-nuevo.component').then(m => m.FacturarNuevoComponent)
      },
      {
        path: 'listado',
        loadComponent: () => import('./features/listado/listado.component').then(m => m.ListadoComponent)
      },
      {
        path: 'totales',
        loadComponent: () => import('./features/totales/totales.component').then(m => m.TotalesComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
