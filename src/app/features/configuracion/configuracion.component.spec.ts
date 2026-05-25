import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { ThemeService } from '../../core/services/theme.service';
import type { Contribuyente } from '../../core/types/database.types';
import { ConfiguracionComponent } from './configuracion.component';

describe('ConfiguracionComponent', () => {
  const createContribuyenteServiceStub = () => ({
    inicializado: signal(true),
    contribuyente: signal<Contribuyente | null>(null),
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

  it('guarda el monto maximo de factura en 0 cuando se deja sin limite', async () => {
    const fixture = TestBed.createComponent(ConfiguracionComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(ContribuyenteService) as unknown as ReturnType<
      typeof createContribuyenteServiceStub
    >;

    component.facturacionForm.patchValue({
      cuit: '20123456789',
      razon_social: 'Comercio Demo',
      punto_venta: 4,
      concepto: 'Servicios',
      monto_maximo_factura: 0,
    });

    await component.guardarFacturacion();

    expect(service.crearContribuyente).toHaveBeenCalledWith(
      expect.objectContaining({ monto_maximo_factura: 0 }),
    );
  });

  it('no borra certificados al guardar datos de facturacion de un contribuyente existente', async () => {
    const fixture = TestBed.createComponent(ConfiguracionComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(ContribuyenteService) as unknown as ReturnType<
      typeof createContribuyenteServiceStub
    >;

    service.contribuyente.set({
      id: 'cont-1',
      user_id: 'user-1',
      cuit: '20123456789',
      razon_social: 'Comercio Demo',
      nombre_fantasia: null,
      domicilio: null,
      condicion_iva: 'Responsable Monotributo',
      ingresos_brutos: null,
      inicio_actividades: null,
      concepto: 'Servicios',
      actividad: 'servicios',
      iva_porcentaje: 21,
      punto_venta: 4,
      monto_maximo_factura: 0,
      arca_cert: 'CERT',
      arca_key: 'KEY',
      arca_production: false,
      arca_ticket: null,
      mp_access_token: null,
      created_at: null,
      updated_at: null,
    });

    component.facturacionForm.patchValue({
      cuit: '20123456789',
      razon_social: 'Comercio Demo',
      punto_venta: 4,
      concepto: 'Servicios',
      monto_maximo_factura: 0,
    });

    await component.guardarFacturacion();

    expect(service.actualizarContribuyente).toHaveBeenCalledWith(
      expect.not.objectContaining({
        arca_cert: null,
        arca_key: null,
      }),
    );
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
