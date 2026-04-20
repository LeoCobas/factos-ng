import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const createAuthServiceStub = () => ({
    signIn: vi.fn().mockResolvedValue({ error: null }),
    setRedirectUrl: vi.fn(),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'returnUrl' ? '/facturar' : null),
              },
            },
          },
        },
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false),
          },
        },
        {
          provide: AuthService,
          useValue: createAuthServiceStub(),
        },
      ],
    }).compileComponents();
  });

  it('configura el returnUrl al crear el componente', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const authService = TestBed.inject(AuthService) as unknown as ReturnType<
      typeof createAuthServiceStub
    >;

    fixture.detectChanges();

    expect(authService.setRedirectUrl).toHaveBeenCalledWith('/facturar');
  });

  it('envia el formulario valido al servicio de autenticacion', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    const authService = TestBed.inject(AuthService) as unknown as ReturnType<
      typeof createAuthServiceStub
    >;

    component.form.setValue({
      email: 'test@example.com',
      password: 'secret',
    });

    await component.onSubmit();

    expect(authService.signIn).toHaveBeenCalledWith('test@example.com', 'secret');
    expect(component.error()).toBeNull();
  });

  it('muestra errores devueltos por autenticacion', async () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    const authService = TestBed.inject(AuthService) as unknown as ReturnType<
      typeof createAuthServiceStub
    >;
    authService.signIn.mockResolvedValueOnce({ error: { message: 'Credenciales invalidas' } });

    component.form.setValue({
      email: 'test@example.com',
      password: 'secret',
    });

    await component.onSubmit();

    expect(component.error()).toBe('Credenciales invalidas');
  });

  it('deshabilita el submit cuando el formulario es invalido', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
