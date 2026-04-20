import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService } from '../../core/services/theme.service';
import { ConfiguracionComponent } from './configuracion.component';

describe('ConfiguracionComponent', () => {
  const createContribuyenteServiceStub = () => ({
    inicializado: signal(true),
    contribuyente: signal(null),
    cargarContribuyente: vi.fn().mockResolvedValue(undefined),
    actualizarContribuyente: vi.fn().mockResolvedValue({ success: true }),
    crearContribuyente: vi.fn().mockResolvedValue({ success: true }),
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracionComponent],
      providers: [
        {
          provide: ThemeService,
          useValue: {
            theme: signal<'light' | 'dark' | 'auto'>('light'),
            setTheme: vi.fn(),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: createContribuyenteServiceStub(),
        },
      ],
    }).compileComponents();
  });

  it('requiere los campos obligatorios de facturacion', () => {
    const fixture = TestBed.createComponent(ConfiguracionComponent);
    const component = fixture.componentInstance;

    component.facturacionForm.patchValue({
      cuit: '',
      razon_social: '',
      punto_venta: null,
      concepto: '',
    });

    expect(component.facturacionForm.invalid).toBe(true);
    expect(component.facturacionForm.controls.cuit.hasError('required')).toBe(true);
    expect(component.facturacionForm.controls.razon_social.hasError('required')).toBe(true);
    expect(component.facturacionForm.controls.punto_venta.hasError('required')).toBe(true);
    expect(component.facturacionForm.controls.concepto.hasError('required')).toBe(true);
  });

  it('usa un formulario reactivo para cuenta', async () => {
    const fixture = TestBed.createComponent(ConfiguracionComponent);
    const component = fixture.componentInstance;

    component.tabActiva.set('cuenta');
    component.accountForm.patchValue({
      nuevoEmail: 'nuevo@example.com',
      nuevaPassword: 'secret1',
      confirmarPassword: 'secret1',
    });

    expect(component.accountForm.controls.nuevoEmail.value).toBe('nuevo@example.com');
    expect(component.accountForm.controls.nuevaPassword.value).toBe('secret1');
  });
});
