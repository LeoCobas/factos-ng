import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { ContribuyenteService } from '../services/contribuyente.service';

describe('auth guards', () => {
  const createRouterStub = () => ({
    createUrlTree: vi.fn((commands: unknown[], extras?: { queryParams?: Record<string, string> }) => ({
      commands,
      extras,
    }) as unknown as UrlTree),
  });

  const configure = (authenticated: boolean, onboardingCompleted = true, inicializado = true, errorCarga: string | null = null) => {
    const routerStub = createRouterStub();
    const authServiceStub = {
      isAuthenticated: signal(authenticated),
      session: signal(authenticated ? ({ user: { id: 'user-1' } } as never) : null),
      waitForInitialization: vi.fn().mockResolvedValue(undefined),
      setRedirectUrl: vi.fn(),
    };
    const contribuyenteServiceStub = {
      inicializado: signal(inicializado),
      tieneContribuyente: signal(onboardingCompleted),
      errorCarga: signal(errorCarga),
      contribuyente: signal(onboardingCompleted ? ({
        arca_cert: 'dummy_cert',
        arca_key: 'dummy_key',
      } as never) : null),
      cargarContribuyente: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authServiceStub },
        { provide: ContribuyenteService, useValue: contribuyenteServiceStub },
      ],
    });

    return { routerStub, authServiceStub, contribuyenteServiceStub };
  };

  it('permite el acceso a rutas protegidas cuando el usuario esta autenticado y completo onboarding', async () => {
    configure(true, true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(result).toBe(true);
  });

  it('redirige a /onboarding cuando el usuario esta autenticado pero no completo onboarding', async () => {
    const { routerStub } = configure(true, false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/onboarding']);
    expect(result).toEqual({
      commands: ['/onboarding'],
      extras: undefined,
    });
  });

  it('permite el acceso a /onboarding cuando el usuario esta autenticado y no completo onboarding', async () => {
    configure(true, false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/onboarding' } as never),
    );

    expect(result).toBe(true);
  });

  it('redirige al home (/) si intenta ir a /onboarding cuando el usuario ya completo onboarding', async () => {
    const { routerStub } = configure(true, true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/onboarding' } as never),
    );

    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toEqual({
      commands: ['/'],
      extras: undefined,
    });
  });

  it('redirige a login cuando el usuario no esta autenticado', async () => {
    const { routerStub, authServiceStub } = configure(false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(authServiceStub.waitForInitialization).toHaveBeenCalled();
    expect(authServiceStub.setRedirectUrl).toHaveBeenCalledWith('/facturar');
    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/facturar' },
    });
    expect(result).toEqual({
      commands: ['/login'],
      extras: { queryParams: { returnUrl: '/facturar' } },
    });
  });

  it('permite el acceso a login cuando no hay sesion', async () => {
    configure(false);

    const result = await TestBed.runInInjectionContext(() =>
      guestGuard({} as never, { url: '/login' } as never),
    );

    expect(result).toBe(true);
  });

  it('redirecciona al home si el usuario ya esta autenticado', async () => {
    const { routerStub } = configure(true);

    const result = await TestBed.runInInjectionContext(() =>
      guestGuard({} as never, { url: '/login' } as never),
    );

    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toEqual({
      commands: ['/'],
      extras: undefined,
    });
  });

  it('llama a cargarContribuyente si no esta inicializado', async () => {
    const { contribuyenteServiceStub } = configure(true, true, false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(contribuyenteServiceStub.cargarContribuyente).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('permite el acceso si ocurre un error al cargar el contribuyente', async () => {
    configure(true, false, true, 'Error de conexion');

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(result).toBe(true);
  });

  it('maneja correctamente urls de onboarding con parametros o hashes', async () => {
    const { routerStub } = configure(true, false);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/onboarding?code=123#hash' } as never),
    );

    // No debe redirigir porque ya está en la ruta clean de onboarding
    expect(routerStub.createUrlTree).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('redirige a / si onboarding esta completado e intenta ir a onboarding con parametros', async () => {
    const { routerStub } = configure(true, true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/onboarding?code=123#hash' } as never),
    );

    expect(routerStub.createUrlTree).toHaveBeenCalledWith(['/']);
    expect(result).toEqual({
      commands: ['/'],
      extras: undefined,
    });
  });
});
