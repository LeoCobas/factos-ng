import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { signal } from '@angular/core';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('auth guards', () => {
  const createRouterStub = () => ({
    createUrlTree: vi.fn((commands: unknown[], extras?: { queryParams?: Record<string, string> }) => ({
      commands,
      extras,
    }) as unknown as UrlTree),
  });

  const configure = (authenticated: boolean) => {
    const routerStub = createRouterStub();
    const authServiceStub = {
      isAuthenticated: signal(authenticated),
      session: signal(authenticated ? ({ user: { id: 'user-1' } } as never) : null),
      waitForInitialization: vi.fn().mockResolvedValue(undefined),
      setRedirectUrl: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: AuthService, useValue: authServiceStub },
      ],
    });

    return { routerStub, authServiceStub };
  };

  it('permite el acceso a rutas protegidas cuando el usuario esta autenticado', async () => {
    configure(true);

    const result = await TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/facturar' } as never),
    );

    expect(result).toBe(true);
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
});
