import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { FacturacionService, FacturaReciente } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { FacturarNuevoComponent } from './facturar-nuevo.component';

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('FacturarNuevoComponent', () => {
  const createFacturacionServiceStub = () => ({
    emitirFactura: vi.fn().mockResolvedValue({
      success: true,
      comprobante: {
        id: 'comp-1',
        contribuyente_id: 'cont-1',
        tipo_comprobante: 'FACTURA C',
        numero_comprobante: '0001-00000015',
        punto_venta: 1,
        fecha: '2026-04-20',
        total: 12000,
        cae: '123',
        vencimiento_cae: '20260430',
        estado: 'emitida',
        concepto: 'Servicios',
        pdf_url: null,
        afip_id: null,
        cliente_cuit: null,
        cliente_doc_tipo: null,
        cliente_doc_nro: null,
        cliente_nombre: null,
        cliente_domicilio: null,
        cliente_condicion_iva: null,
        comprobante_asociado_id: null,
        created_at: null,
        updated_at: null,
      },
    }),
    buscarClientePorCuit: vi.fn(),
    cargarUltimaFechaComprobantePorTipo: vi.fn().mockResolvedValue(null),
    cargarFacturasRecientes: vi.fn().mockResolvedValue([
      {
        id: 'fac-1',
        fecha: '2026-04-20',
        tipo_comprobante: 'FACTURA C',
        total: 12000,
        numero_comprobante: '0001-00000014',
        created_at: null,
      } satisfies FacturaReciente,
    ]),
  });

  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [FacturarNuevoComponent],
      providers: [
        {
          provide: FacturacionService,
          useValue: createFacturacionServiceStub(),
        },
        {
          provide: PdfService,
          useValue: {
            createPdfAsset: vi.fn(),
            revokeBlobUrl: vi.fn(),
            createPdfInfo: vi.fn(),
            sharePdf: vi.fn(),
            printFactura: vi.fn(),
            downloadPdf: vi.fn(),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: signal({
              id: 'cont-1',
              actividad: 'servicios',
              condicion_iva: 'Monotributo',
            }),
          },
        },
      ],
    }).compileComponents();
  });

  it('renderiza el panel de facturas recientes y recarga al tener contribuyente', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.cargarFacturasRecientes).toHaveBeenCalledWith('cont-1');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Últimas facturas');
  });

  it('muestra el prefijo monetario y deja deshabilitado el CTA con monto vacio', () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);

    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const moneyPrefix = host.querySelector('.premium-money-field__prefix');
    const submitButton = host.querySelector('button[type="submit"]') as HTMLButtonElement | null;

    expect(moneyPrefix?.textContent).toContain('$');
    expect(submitButton?.disabled).toBe(true);
  });

  it('usa la ultima fecha del tipo resuelto como minimo si es posterior a la ventana fiscal', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00-03:00'));

    try {
      const fixture = TestBed.createComponent(FacturarNuevoComponent);
      const component = fixture.componentInstance;
      const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
        typeof createFacturacionServiceStub
      >;

      service.cargarUltimaFechaComprobantePorTipo.mockResolvedValue('2026-04-21');
      component.formFactura.controls.fecha.setValue('2026-04-15');

      fixture.detectChanges();
      await fixture.whenStable();

      expect(service.cargarUltimaFechaComprobantePorTipo).toHaveBeenCalledWith(
        'cont-1',
        'FACTURA C',
        undefined,
      );
      expect(component.minFecha()).toBe('2026-04-21');
      expect(component.formFactura.controls.fecha.value).toBe('2026-04-21');
    } finally {
      vi.useRealTimers();
    }
  });

  it('recalcula el minimo cuando cambia el cliente y se resuelve otro tipo de factura', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;
    const contribuyenteService = TestBed.inject(ContribuyenteService) as unknown as {
      contribuyente: ReturnType<typeof signal>;
    };

    contribuyenteService.contribuyente.set({
      id: 'cont-1',
      actividad: 'servicios',
      condicion_iva: 'IVA Responsable Inscripto',
      punto_venta: 1,
    });
    service.cargarUltimaFechaComprobantePorTipo.mockImplementation(
      async (_contribuyenteId, tipoComprobante) =>
        tipoComprobante === 'FACTURA A' ? '2026-04-20' : '2026-04-18',
    );

    fixture.detectChanges();
    await Promise.resolve();
    expect(component.minFecha()).toBe('2026-04-18');

    component.clienteSeleccionado.set({
      cuit: '20111111112',
      nombre: 'Cliente RI',
      domicilio: null,
      condicion_iva: 'IVA Responsable Inscripto',
      doc_tipo: 80,
      doc_nro: 20111111112,
      condicion_iva_normalizada: 'IVA Responsable Inscripto',
      fiscal_profile: 'responsable-inscripto',
      fiscal_status_message: 'ok',
      fiscal_status_reliable: true,
      fiscal_status_source: 'constancia_inscripcion',
    });
    fixture.detectChanges();
    await Promise.resolve();

    expect(service.cargarUltimaFechaComprobantePorTipo).toHaveBeenCalledWith(
      'cont-1',
      'FACTURA A',
      1,
    );
    expect(component.minFecha()).toBe('2026-04-20');
  });

  it('envia el submit valido y resetea el formulario en exito', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();

    expect(service.emitirFactura).toHaveBeenCalled();
    expect(component.facturaEmitida()?.numero_comprobante).toBe('0001-00000015');
    expect(component.formFactura.controls.monto.value).toBe('');
  });

  it('muestra el error especifico del servicio al fallar la emision', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    service.emitirFactura.mockResolvedValue({
      success: false,
      error:
        'No se pudo emitir la factura porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
    });

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();

    expect(component.mensaje()).toContain('no hay conexion');
    expect(component.esExito()).toBe(false);
  });

  it('muestra un warning inline cuando ARCA esta en mantenimiento durante la emision', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    service.emitirFactura.mockResolvedValue({
      success: false,
      error: 'ARCA informa mantenimiento programado.',
      errorType: 'arca_maintenance',
      shouldRetry: true,
    });

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();
    fixture.detectChanges();

    expect(component.esExito()).toBe(false);
    expect(component.mensaje()).toContain('ARCA esta en mantenimiento');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'ARCA esta en mantenimiento',
    );
  });

  it('muestra un mensaje inline de autenticacion/WSAA al fallar credenciales', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    service.emitirFactura.mockResolvedValue({
      success: false,
      error: 'WSAA rechazo el token de autenticacion.',
      errorType: 'arca_auth',
    });

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();

    expect(component.esExito()).toBe(false);
    expect(component.mensaje()).toContain('autenticacion con ARCA/WSAA');
  });

  it('muestra un mensaje inline de red al fallar la emision por conexion', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
      typeof createFacturacionServiceStub
    >;

    service.emitirFactura.mockResolvedValue({
      success: false,
      error:
        'No se pudo emitir la factura porque no hay conexion a internet. Verifica la red e intenta nuevamente.',
      errorType: 'network',
    });

    component.formFactura.setValue({
      monto: 12000,
      fecha: '2026-04-20',
      cliente_cuit: '',
    });

    await component.emitirFactura();

    expect(component.esExito()).toBe(false);
    expect(component.mensaje()).toContain('no hay conexion con el servicio de facturacion');
  });

  it('bloquea doble click mientras una accion del comprobante sigue en curso', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const pdfService = TestBed.inject(PdfService) as unknown as {
      createPdfInfo: ReturnType<typeof vi.fn>;
      sharePdf: ReturnType<typeof vi.fn>;
    };
    const deferred = createDeferred<{ success: boolean; message: string; type: 'success' }>();

    component.facturaEmitida.set({
      id: 'comp-1',
      contribuyente_id: 'cont-1',
      tipo_comprobante: 'FACTURA C',
      numero_comprobante: '0001-00000015',
      punto_venta: 1,
      fecha: '2026-04-20',
      total: 12000,
      cae: '123',
      vencimiento_cae: '20260430',
      estado: 'emitida',
      concepto: 'Servicios',
      pdf_url: null,
      afip_id: null,
      cliente_cuit: null,
      cliente_doc_tipo: null,
      cliente_doc_nro: null,
      cliente_nombre: null,
      cliente_domicilio: null,
      cliente_condicion_iva: null,
      comprobante_asociado_id: null,
      created_at: null,
      updated_at: null,
    });
    pdfService.createPdfInfo.mockReturnValue({ filename: 'a.pdf', title: 'A', text: 'x' });
    pdfService.sharePdf.mockReturnValue(deferred.promise);

    const firstCall = component.compartir();
    const secondCall = component.compartir();

    expect(component.accionComprobanteEnCurso()).toBe('compartir');
    expect(pdfService.sharePdf).toHaveBeenCalledTimes(1);

    deferred.resolve({
      success: true,
      message: 'Comprobante listo para compartir.',
      type: 'success',
    });
    await firstCall;
    await secondCall;

    expect(component.accionComprobanteEnCurso()).toBeNull();
  });

  it('muestra feedback de exito al completar una accion del comprobante', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const pdfService = TestBed.inject(PdfService) as unknown as {
      createPdfInfo: ReturnType<typeof vi.fn>;
      downloadPdf: ReturnType<typeof vi.fn>;
    };

    component.facturaEmitida.set({
      id: 'comp-1',
      contribuyente_id: 'cont-1',
      tipo_comprobante: 'FACTURA C',
      numero_comprobante: '0001-00000015',
      punto_venta: 1,
      fecha: '2026-04-20',
      total: 12000,
      cae: '123',
      vencimiento_cae: '20260430',
      estado: 'emitida',
      concepto: 'Servicios',
      pdf_url: null,
      afip_id: null,
      cliente_cuit: null,
      cliente_doc_tipo: null,
      cliente_doc_nro: null,
      cliente_nombre: null,
      cliente_domicilio: null,
      cliente_condicion_iva: null,
      comprobante_asociado_id: null,
      created_at: null,
      updated_at: null,
    });
    pdfService.createPdfInfo.mockReturnValue({ filename: 'a.pdf', title: 'A', text: 'x' });
    pdfService.downloadPdf.mockResolvedValue({
      success: true,
      message: 'Ticket guardado exitosamente.',
      type: 'success',
    });

    await component.descargar();

    expect(component.mensajeAccionComprobante()).toBe('Ticket guardado exitosamente.');
    expect(component.mensajeAccionComprobanteTipo()).toBe('success');
  });

  it('muestra feedback de error si falla una accion del comprobante', async () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance;
    const pdfService = TestBed.inject(PdfService) as unknown as {
      createPdfInfo: ReturnType<typeof vi.fn>;
      sharePdf: ReturnType<typeof vi.fn>;
    };

    component.facturaEmitida.set({
      id: 'comp-1',
      contribuyente_id: 'cont-1',
      tipo_comprobante: 'FACTURA C',
      numero_comprobante: '0001-00000015',
      punto_venta: 1,
      fecha: '2026-04-20',
      total: 12000,
      cae: '123',
      vencimiento_cae: '20260430',
      estado: 'emitida',
      concepto: 'Servicios',
      pdf_url: null,
      afip_id: null,
      cliente_cuit: null,
      cliente_doc_tipo: null,
      cliente_doc_nro: null,
      cliente_nombre: null,
      cliente_domicilio: null,
      cliente_condicion_iva: null,
      comprobante_asociado_id: null,
      created_at: null,
      updated_at: null,
    });
    pdfService.createPdfInfo.mockReturnValue({ filename: 'a.pdf', title: 'A', text: 'x' });
    pdfService.sharePdf.mockRejectedValue(new Error('fallo'));

    await component.compartir();

    expect(component.mensajeAccionComprobante()).toBe('No se pudo compartir el ticket.');
    expect(component.mensajeAccionComprobanteTipo()).toBe('error');
  });

  it('pide confirmacion con temporizador si el monto supera el limite configurado', async () => {
    vi.useFakeTimers();

    try {
      const fixture = TestBed.createComponent(FacturarNuevoComponent);
      const component = fixture.componentInstance;
      const service = TestBed.inject(FacturacionService) as unknown as ReturnType<
        typeof createFacturacionServiceStub
      >;
      const contribuyenteService = TestBed.inject(ContribuyenteService) as unknown as {
        contribuyente: ReturnType<typeof signal>;
      };

      contribuyenteService.contribuyente.set({
        id: 'cont-1',
        actividad: 'servicios',
        condicion_iva: 'Monotributo',
        monto_maximo_factura: 10000,
      });

      component.formFactura.setValue({
        monto: 12000,
        fecha: '2026-04-20',
        cliente_cuit: '',
      });

      await component.emitirFactura();

      expect(component.mostrandoConfirmacionMonto()).toBe(true);
      expect(component.confirmacionMontoCountdown()).toBe(5);
      expect(service.emitirFactura).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      await component.confirmarEmisionMontoExcedido();

      expect(component.mostrandoConfirmacionMonto()).toBe(false);
      expect(service.emitirFactura).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ubica la confirmacion debajo del header en desktop aunque no haya teclado', () => {
    const fixture = TestBed.createComponent(FacturarNuevoComponent);
    const component = fixture.componentInstance as any;
    const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue({
      getBoundingClientRect: () => ({ bottom: 132 }),
    } as HTMLElement);

    component.actualizarPosicionConfirmacionMonto();

    expect(component.confirmacionMontoTopOffset()).toBe(144);
    querySelectorSpy.mockRestore();
  });

  it('sube la confirmacion hacia arriba si el viewport visible queda chico en mobile', () => {
    const originalVisualViewport = window.visualViewport;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        height: 260,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    try {
      const fixture = TestBed.createComponent(FacturarNuevoComponent);
      const component = fixture.componentInstance as any;
      const querySelectorSpy = vi.spyOn(document, 'querySelector').mockReturnValue({
        getBoundingClientRect: () => ({ bottom: 140 }),
      } as HTMLElement);

      component.confirmacionMontoCardRef = () => ({ nativeElement: { offsetHeight: 240 } });

      component.actualizarPosicionConfirmacionMonto();

      expect(component.confirmacionMontoTopOffset()).toBe(12);
      querySelectorSpy.mockRestore();
    } finally {
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: originalVisualViewport,
      });
    }
  });
});
