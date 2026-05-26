import { TestBed } from '@angular/core/testing';
import { OnboardingComponent } from './onboarding.component';
import { AuthService } from '../../core/services/auth.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService } from '../../core/services/theme.service';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { supabase } from '../../core/services/supabase.service';

describe('OnboardingComponent', () => {
  let authServiceMock: any;
  let contribuyenteServiceMock: any;
  let themeServiceMock: any;
  let routerMock: any;
  let originalFetch: any;
  let mockSupabaseAuth: any;

  beforeEach(() => {
    window.__FACTOS_RUNTIME_CONFIG__ = {
      supabase: {
        url: 'https://fake-supabase.co',
        anonKey: 'fake-key',
      },
    };

    authServiceMock = {
      session: signal({ user: { id: 'user-1' } }),
    };

    mockSupabaseAuth = {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'fake-token'
          }
        }
      })
    };
    vi.spyOn(supabase, 'auth', 'get').mockReturnValue(mockSupabaseAuth as never);

    contribuyenteServiceMock = {
      crearContribuyente: vi.fn(),
      cargarContribuyente: vi.fn(),
    };

    themeServiceMock = {
      isDark: signal(true),
    };

    routerMock = {
      navigate: vi.fn(),
    };

    originalFetch = global.fetch;
    global.fetch = vi.fn();

    TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ContribuyenteService, useValue: contribuyenteServiceMock },
        { provide: ThemeService, useValue: themeServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('debe iniciar en el Paso 1 y validar el formulario fiscal', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;

    expect(component.currentStep()).toBe(1);
    expect(component.fiscalForm.valid).toBe(false);

    // Rellenar con CUIT incorrecto (menos de 11 dígitos)
    component.fiscalForm.patchValue({
      cuit: '123',
      razon_social: 'Empresa Test',
      condicion_iva: 'Responsable Monotributo',
      punto_venta: 4,
    });
    expect(component.fiscalForm.valid).toBe(false);

    // CUIT correcto
    component.fiscalForm.patchValue({
      cuit: '20123456789',
    });
    expect(component.fiscalForm.valid).toBe(true);
  });

  it('debe buscar el CUIT y autocompletar razon social y domicilio', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    
    // Mock the auth session token getter if it exists, or verify fetch headers
    const mockSession = { data: { session: { access_token: 'fake-token' } } };
    // We also need to mock supabase auth getSession. Wait, let's see if supabase is imported directly.
    // Let's mock fetch response
    (global.fetch as any).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          razon_social: 'JUAN PEREZ',
          domicilio: 'Calle Falsa 123',
          condicion_iva: 'Responsable Monotributo'
        }
      })
    });

    component.fiscalForm.patchValue({ cuit: '20123456789' });
    await component.buscarCuit();

    expect(global.fetch).toHaveBeenCalled();
    expect(component.fiscalForm.value.razon_social).toBe('JUAN PEREZ');
    expect(component.fiscalForm.value.domicilio).toBe('Calle Falsa 123');
    expect(component.fiscalForm.value.condicion_iva).toBe('Responsable Monotributo');
  });

  it('debe generar CSR y guardar las claves en el estado', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;

    (global.fetch as any).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        success: true,
        csr: '-----BEGIN CERTIFICATE REQUEST-----\n...',
        private_key: '-----BEGIN RSA PRIVATE KEY-----\n...'
      })
    });

    // Mock URL.createObjectURL and download triggers to avoid crashes in test env
    window.URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
    window.URL.revokeObjectURL = vi.fn();
    
    component.fiscalForm.patchValue({ cuit: '20123456789', razon_social: 'JUAN PEREZ' });
    await component.generarCsr();

    expect(global.fetch).toHaveBeenCalled();
    expect(component.csr()).toBe('-----BEGIN CERTIFICATE REQUEST-----\n...');
    expect(component.privateKey()).toBe('-----BEGIN RSA PRIVATE KEY-----\n...');
  });

  it('debe avanzar y retroceder de paso correctamente', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;

    // Completar paso 1
    component.fiscalForm.patchValue({ cuit: '20123456789', razon_social: 'JUAN PEREZ' });
    expect(component.isNextDisabled()).toBe(false);

    component.nextStep();
    expect(component.currentStep()).toBe(2);

    component.prevStep();
    expect(component.currentStep()).toBe(1);
  });

  it('debe guardar los datos de onboarding y navegar a / al finalizar', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;

    contribuyenteServiceMock.crearContribuyente.mockResolvedValue({ success: true });
    contribuyenteServiceMock.cargarContribuyente.mockResolvedValue(undefined);

    component.fiscalForm.patchValue({
      cuit: '20123456789',
      razon_social: 'JUAN PEREZ',
      domicilio: 'Calle Falsa 123',
      condicion_iva: 'Responsable Monotributo',
      punto_venta: 4,
      concepto: 'Servicios profesionales',
      actividad: 'servicios'
    });

    component.privateKey.set('fake-key');
    component.certFileContent.set('fake-cert');

    await component.guardarOnboarding();

    expect(contribuyenteServiceMock.crearContribuyente).toHaveBeenCalledWith(expect.objectContaining({
      cuit: '20123456789',
      arca_key: 'fake-key',
      arca_cert: 'fake-cert'
    }));
    expect(contribuyenteServiceMock.cargarContribuyente).toHaveBeenCalled();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/']);
  });
});
