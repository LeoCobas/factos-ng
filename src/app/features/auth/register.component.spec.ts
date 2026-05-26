import { TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { signal } from '@angular/core';
import { Router } from '@angular/router';

describe('RegisterComponent', () => {
  let authServiceMock: any;
  let themeServiceMock: any;
  let routerMock: any;

  beforeEach(() => {
    authServiceMock = {
      signUp: vi.fn(),
    };
    themeServiceMock = {
      isDark: signal(true),
    };
    routerMock = {
      navigate: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  it('debe inicializar el formulario vacio e invalido', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    expect(component.form.valid).toBe(false);
    expect(component.form.value.email).toBe('');
    expect(component.form.value.password).toBe('');
    expect(component.form.value.confirmPassword).toBe('');
  });

  it('debe validar contraseñas coincidentes', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    component.form.patchValue({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'differentpassword',
    });
    expect(component.form.valid).toBe(false);
    expect(component.form.hasError('mismatch')).toBe(true);
  });

  it('debe ser valido si las contraseñas coinciden y el email es correcto', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    component.form.patchValue({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    expect(component.form.valid).toBe(true);
  });

  it('debe llamar a authService.signUp al enviar un formulario valido', async () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    authServiceMock.signUp.mockResolvedValue({ error: null });

    component.form.patchValue({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    await component.onSubmit();

    expect(authServiceMock.signUp).toHaveBeenCalledWith('test@example.com', 'password123');
    expect(component.registrationSuccess()).toBe(true);
    expect(component.error()).toBeNull();
  });

  it('debe mostrar un mensaje de error si signUp falla', async () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    authServiceMock.signUp.mockResolvedValue({ error: { message: 'El usuario ya existe' } });

    component.form.patchValue({
      email: 'test@example.com',
      password: 'password123',
      confirmPassword: 'password123',
    });

    await component.onSubmit();

    expect(component.registrationSuccess()).toBe(false);
    expect(component.error()).toBe('El usuario ya existe');
  });
});
