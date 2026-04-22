import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

type AuthChangeCallback = (event: string, session: { user?: { id: string } } | null) => void;

const { mockSupabaseAuth } = vi.hoisted(() => ({
  mockSupabaseAuth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
}));

vi.mock('./supabase.service', () => ({
  supabase: {
    auth: mockSupabaseAuth,
  },
}));

describe('AuthService', () => {
  const createRouterStub = (url = '/') => ({
    url,
    navigate: vi.fn().mockResolvedValue(true),
    navigateByUrl: vi.fn().mockResolvedValue(true),
  });

  let authChangeCallback: AuthChangeCallback | undefined;

  beforeEach(() => {
    authChangeCallback = undefined;
    mockSupabaseAuth.signInWithPassword.mockReset();
    mockSupabaseAuth.signUp.mockReset();
    mockSupabaseAuth.signOut.mockReset();
    mockSupabaseAuth.resetPasswordForEmail.mockReset();
    mockSupabaseAuth.getSession.mockReset();
    mockSupabaseAuth.onAuthStateChange.mockReset();

    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockSupabaseAuth.onAuthStateChange.mockImplementation((callback: AuthChangeCallback) => {
      authChangeCallback = callback;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      };
    });
  });

  it('redirige al returnUrl cuando ocurre un login interactivo', async () => {
    const routerStub = createRouterStub('/login?returnUrl=%2Ftotales');

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: routerStub }],
    });

    const service = TestBed.inject(AuthService);
    service.setRedirectUrl('/totales');

    await service.waitForInitialization();
    authChangeCallback?.('SIGNED_IN', { user: { id: 'user-1' } });
    await Promise.resolve();

    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/totales');
  });

  it('no redirige a la raiz cuando llega un SIGNED_IN estando ya en una ruta interna', async () => {
    const routerStub = createRouterStub('/totales');

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: routerStub }],
    });

    const service = TestBed.inject(AuthService);

    await service.waitForInitialization();
    authChangeCallback?.('SIGNED_IN', { user: { id: 'user-1' } });
    await Promise.resolve();

    expect(routerStub.navigateByUrl).not.toHaveBeenCalled();
  });

  it('redirige al inicio cuando el login se completa desde la pantalla de acceso sin returnUrl', async () => {
    const routerStub = createRouterStub('/login');

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: routerStub }],
    });

    const service = TestBed.inject(AuthService);

    await service.waitForInitialization();
    authChangeCallback?.('SIGNED_IN', { user: { id: 'user-1' } });
    await Promise.resolve();

    expect(routerStub.navigateByUrl).toHaveBeenCalledWith('/');
  });
});
