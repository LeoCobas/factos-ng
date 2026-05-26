import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { ContribuyenteService } from '../services/contribuyente.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const contribuyenteService = inject(ContribuyenteService);
  const router = inject(Router);

  await authService.waitForInitialization();

  if (authService.isAuthenticated()) {
    if (!contribuyenteService.inicializado()) {
      await contribuyenteService.cargarContribuyente();
    }

    if (contribuyenteService.errorCarga()) {
      return true;
    }

    const tienePerfil = contribuyenteService.tieneContribuyente();
    const tieneCerts = !!(contribuyenteService.contribuyente()?.arca_cert && contribuyenteService.contribuyente()?.arca_key);
    const onboardingCompletado = tienePerfil && tieneCerts;

    const pathname = state.url.split(/[?#]/)[0];

    if (!onboardingCompletado) {
      if (pathname !== '/onboarding') {
        return router.createUrlTree(['/onboarding']);
      }
      return true;
    } else {
      if (pathname === '/onboarding') {
        return router.createUrlTree(['/']);
      }
    }

    authService.setRedirectUrl(null);
    return true;
  }

  authService.setRedirectUrl(state.url);
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

export const guestGuard: CanActivateFn = async (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.waitForInitialization();

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
