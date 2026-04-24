import { registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ComprobantesService } from '../../core/services/comprobantes.service';
import { ContribuyenteService } from '../../core/services/contribuyente.service';
import { FacturacionService } from '../../core/services/facturacion.service';
import { PdfService } from '../../core/services/pdf.service';
import { ListadoComponent } from './listado.component';

function crearFactura(
  overrides: Partial<Parameters<ListadoComponent['anularFactura']>[0]> = {},
): Parameters<ListadoComponent['anularFactura']>[0] {
  return {
    id: 'factura-1',
    numero_factura: '0001-00000014',
    fecha: '2026-04-16',
    monto: 28000,
    estado: 'emitida' as const,
    tipo_comprobante: 'FACTURA C',
    ...overrides,
  };
}

describe('ListadoComponent', () => {
  beforeEach(async () => {
    registerLocaleData(localeEsAr);

    await TestBed.configureTestingModule({
      imports: [ListadoComponent],
      providers: [
        {
          provide: PdfService,
          useValue: {
            createPdfInfo: vi.fn(),
            sharePdf: vi.fn(),
            downloadPdf: vi.fn(),
            revokeBlobUrl: vi.fn(),
          },
        },
        {
          provide: FacturacionService,
          useValue: {
            crearNotaCredito: vi.fn(),
          },
        },
        {
          provide: ComprobantesService,
          useValue: {
            cargarComprobantesPorFecha: vi.fn().mockResolvedValue([]),
            cargarUltimaFechaConComprobantes: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: signal(null),
          },
        },
      ],
    }).compileComponents();
  });

  it('muestra la condicion de IVA con acentos correctos en el detalle expandido', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'emitida',
        tipo_comprobante: 'FC C',
        cliente_condicion_iva: 'Consumidor Final',
      },
    ]);
    component.facturaExpandida.set('factura-1');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Condici\u00f3n IVA: Consumidor Final');
  });

  it('renderiza la nota de credito emitida como panel inline dentro del listado', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance as ListadoComponent & {
      notaCreditoEmitida: ReturnType<typeof signal>;
    };

    component.notaCreditoEmitida.set({
      numero: '0001-00000021',
      monto: 15000,
      facturaOriginal: '0001-00000018',
      cae: '12345678901234',
      tipo_comprobante: 'NOTA DE CREDITO C',
    });

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nota de crédito emitida');
    expect(compiled.textContent).toContain('Anula factura 0001-00000018');
    expect(compiled.textContent).not.toContain('fixed inset-0');
  });

  it('muestra el estado Anulando solo en la fila activa', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '0001-00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'emitida',
        tipo_comprobante: 'FACTURA C',
      },
    ]);
    component.facturaExpandida.set('factura-1');
    component.accionesSecundariasFacturaId.set('factura-1');
    component.anulandoFacturaId.set('factura-1');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Anulando...');
  });

  it('muestra la fila principal compacta al expandir una factura', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '0001-00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'emitida',
        tipo_comprobante: 'FACTURA C',
      },
    ]);
    component.facturaExpandida.set('factura-1');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[aria-label="M\u00e1s opciones"]')).not.toBeNull();
    expect(compiled.textContent).toContain('Compartir');
    expect(compiled.textContent).toContain('Imprimir');
  });

  it('quita los ceros a la izquierda del numero visible de factura', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    expect(component.obtenerNumeroSinCeros('0001-00000014')).toBe('14');
    expect(component.obtenerNumeroSinCeros('00000014')).toBe('14');
    expect(component.obtenerNumeroSinCeros('0001-00000000')).toBe('0');
  });

  it('renderiza el numero de factura sin punto de venta ni ceros a la izquierda', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '0001-00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'emitida',
        tipo_comprobante: 'FACTURA C',
      },
    ]);

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rowGrid = compiled.querySelector(
      '.grid.grid-cols-\\[3rem_3rem_minmax\\(0\\2c 1fr\\)_6\\.4rem_1rem\\]',
    ) as HTMLElement | null;
    const amountCell = compiled.querySelector('.justify-self-end.text-right') as HTMLElement | null;

    expect(rowGrid).not.toBeNull();
    expect(amountCell).not.toBeNull();
    expect(compiled.textContent).toContain('14');
    expect(compiled.textContent).not.toContain('00000014');
  });

  it('ignora toggles duplicados rapidos al desplegar una factura', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00-03:00'));

    try {
      const fixture = TestBed.createComponent(ListadoComponent);
      const component = fixture.componentInstance;

      component.toggleExpansion('factura-1');
      vi.advanceTimersByTime(100);
      component.toggleExpansion('factura-1');

      expect(component.facturaExpandida()).toBe('factura-1');

      vi.advanceTimersByTime(300);
      component.toggleExpansion('factura-1');

      expect(component.facturaExpandida()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('oculta Anular Descargar y Ver hasta abrir mas opciones', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '0001-00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'emitida',
        tipo_comprobante: 'FACTURA C',
      },
    ]);
    component.facturaExpandida.set('factura-1');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Anular');
    expect(compiled.textContent).not.toContain('Descargar');
    expect(compiled.textContent).not.toContain('Ver');

    component.accionesSecundariasFacturaId.set('factura-1');
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Anular');
    expect(compiled.textContent).toContain('Descargar');
    expect(compiled.textContent).toContain('Ver');
  });

  it('ignora toggles duplicados rapidos del boton Mas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00-03:00'));

    try {
      const fixture = TestBed.createComponent(ListadoComponent);
      const component = fixture.componentInstance;

      component.toggleAccionesSecundarias('factura-1');
      vi.advanceTimersByTime(100);
      component.toggleAccionesSecundarias('factura-1');

      expect(component.accionesSecundariasFacturaId()).toBe('factura-1');

      vi.advanceTimersByTime(300);
      component.toggleAccionesSecundarias('factura-1');

      expect(component.accionesSecundariasFacturaId()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('no muestra Anular para facturas anuladas aunque esten abiertas las opciones secundarias', () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;

    component.facturas.set([
      {
        id: 'factura-1',
        numero_factura: '0001-00000014',
        fecha: '2026-04-16',
        monto: 28000,
        estado: 'anulada',
        tipo_comprobante: 'FACTURA C',
      },
    ]);
    component.facturaExpandida.set('factura-1');
    component.accionesSecundariasFacturaId.set('factura-1');

    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Anular');
    expect(compiled.textContent).toContain('Descargar');
    expect(compiled.textContent).toContain('Ver');
  });

  it('renderiza una confirmacion inline antes de anular y no ejecuta el servicio hasta confirmar', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    fixture.detectChanges();

    await component.anularFactura(factura);
    fixture.detectChanges();

    expect(crearNotaCreditoMock).not.toHaveBeenCalled();
    expect(component.mostrandoConfirmacionAnulacion()).toBe(true);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Confirmar anulación');
    expect(compiled.textContent).toContain('¿Seguro que querés anular la factura');
    expect(compiled.textContent).toContain('Se emitirá una nota de crédito automática');
  });

  it('cancela la confirmacion de anulación sin efectos laterales', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    await component.anularFactura(factura);
    component.cancelarConfirmacionAnulacion();
    fixture.detectChanges();

    expect(crearNotaCreditoMock).not.toHaveBeenCalled();
    expect(component.mostrandoConfirmacionAnulacion()).toBe(false);
    expect(component.facturaPendienteAnulacion()).toBeNull();
  });

  it('muestra warning inline y CTA de reintento cuando ARCA esta en mantenimiento', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    crearNotaCreditoMock.mockResolvedValueOnce({
      success: false,
      error: 'ARCA informa mantenimiento programado.',
      shouldRetry: true,
    });

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    await component.anularFactura(factura);
    await component.confirmarAnulacionFactura();
    fixture.detectChanges();

    expect(component.mensajeAccionTipo()).toBe('warning');
    expect(component.facturaPendienteReintento()?.id).toBe(factura.id);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('ARCA está en mantenimiento');
    expect(compiled.textContent).toContain('Reintentar');
  });

  it('muestra un mensaje inline de red y limpia el estado temporal cuando falla la conexión', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    crearNotaCreditoMock.mockRejectedValueOnce(new Error('fetch failed'));

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    await component.anularFactura(factura);
    await component.confirmarAnulacionFactura();
    fixture.detectChanges();

    expect(component.mensajeAccionTipo()).toBe('error');
    expect(component.mensajeAccion()).toContain('no hay conexión');
    expect(component.anulandoFacturaId()).toBeNull();
    expect(component.mostrandoConfirmacionAnulacion()).toBe(false);
    expect(component.facturaPendienteAnulacion()).toBeNull();
  });

  it('muestra un mensaje inline de credenciales para errores de autenticación', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    crearNotaCreditoMock.mockRejectedValueOnce(new Error('token vencido'));

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    await component.anularFactura(factura);
    await component.confirmarAnulacionFactura();

    expect(component.mensajeAccionTipo()).toBe('error');
    expect(component.mensajeAccion()).toContain('autenticación con ARCA');
  });

  it('muestra el resultado inline al compartir un PDF', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const pdfService = TestBed.inject(PdfService) as unknown as {
      createPdfInfo: ReturnType<typeof vi.fn>;
      sharePdf: ReturnType<typeof vi.fn>;
    };
    const factura = crearFactura();

    pdfService.createPdfInfo.mockReturnValue({ filename: 'a.pdf', title: 'A', text: 'x' });
    pdfService.sharePdf.mockResolvedValue({
      success: true,
      message: 'Informacion de factura copiada al portapapeles.',
      type: 'success',
    });

    await component.compartir(factura);

    expect(component.mensajeAccion()).toBe('Informacion de factura copiada al portapapeles.');
    expect(component.mensajeAccionTipo()).toBe('success');
  });

  it('muestra cancelacion de descarga sin depender de alertas del servicio', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const pdfService = TestBed.inject(PdfService) as unknown as {
      createPdfInfo: ReturnType<typeof vi.fn>;
      downloadPdf: ReturnType<typeof vi.fn>;
    };
    const factura = crearFactura();

    pdfService.createPdfInfo.mockReturnValue({ filename: 'a.pdf', title: 'A', text: 'x' });
    pdfService.downloadPdf.mockResolvedValue({
      success: false,
      message: 'Descarga cancelada.',
      type: 'warning',
    });

    await component.descargar(factura);

    expect(component.mensajeAccion()).toBe('Descarga cancelada.');
    expect(component.mensajeAccionTipo()).toBe('warning');
  });

  it('conserva el panel inline de nota de credito al anular con exito', async () => {
    const fixture = TestBed.createComponent(ListadoComponent);
    const component = fixture.componentInstance;
    const facturacionService = TestBed.inject(FacturacionService);
    const crearNotaCreditoMock = vi.mocked(facturacionService.crearNotaCredito);
    const factura = crearFactura();

    crearNotaCreditoMock.mockResolvedValueOnce({
      success: true,
      data: {
        numero: '0001-00000021',
        cae: '12345678901234',
        vencimiento_cae: '20260501',
        pdf_url: 'https://example.com/nc.pdf',
        comprobante: {
          id: 'nc-1',
          tipo_comprobante: 'NOTA DE CREDITO C',
          numero_comprobante: '0001-00000021',
        } as any,
      },
    });

    component.facturas.set([factura]);
    component.facturaExpandida.set(factura.id);
    component.accionesSecundariasFacturaId.set(factura.id);

    await component.anularFactura(factura);
    await component.confirmarAnulacionFactura();
    fixture.detectChanges();

    expect(component.notaCreditoEmitida()?.numero).toBe('0001-00000021');
    expect(component.mostrandoConfirmacionAnulacion()).toBe(false);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nota de crédito emitida');
    expect(compiled.textContent).toContain('Anula factura 0001-00000014');
  });
});
