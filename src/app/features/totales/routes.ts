import { Routes } from '@angular/router';

export const totalesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./totales.component').then(m => m.TotalesComponent)
  }
];
