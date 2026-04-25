import { TestBed } from '@angular/core/testing';

import { ContribuyenteService } from './contribuyente.service';
import { FacturacionService } from './facturacion.service';
import { supabase } from './supabase.service';

describe('FacturacionService', () => {
  const contribuyente = {
    id: 'cont-1',
    user_id: 'user-1',
    cuit: '20111111112',
    razon_social: 'Emisor Test',
    nombre_fantasia: null,
    domicilio: null,
    condicion_iva: 'Responsable Monotributo',
    ingresos_brutos: null,
    inicio_actividades: null,
    concepto: 'Servicios',
    actividad: 'servicios',
    iva_porcentaje: 21,
    punto_venta: 1,
    monto_maximo_factura: null,
    arca_cert: null,
    arca_key: null,
    arca_production: null,
    arca_ticket: null,
    created_at: null,
    updated_at: null,
  };

  const createUltimaFechaQuery = (fecha: string | null, error: unknown = null) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: fecha ? { fecha } : null,
        error,
      }),
    };

    return query;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00-03:00'));
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        FacturacionService,
        {
          provide: ContribuyenteService,
          useValue: {
            contribuyente: vi.fn(() => contribuyente),
          },
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('permite validar una factura si no hay comprobantes previos del mismo tipo', async () => {
    const service = TestBed.inject(FacturacionService);
    const query = createUltimaFechaQuery(null);
    vi.spyOn(supabase, 'from').mockReturnValue(query as never);

    await expect(
      service.validarFechaNoAnteriorAUltimoTipo({
        contribuyenteId: 'cont-1',
        tipoComprobante: 'FACTURA C',
        fechaISO: '2026-04-20',
        puntoVenta: 1,
      }),
    ).resolves.toBeUndefined();

    expect(query.eq).toHaveBeenCalledWith('tipo_comprobante', 'FACTURA C');
    expect(query.eq).toHaveBeenCalledWith('punto_venta', 1);
  });

  it('rechaza FACTURA C con fecha anterior a la ultima FACTURA C autorizada', async () => {
    const service = TestBed.inject(FacturacionService);
    const query = createUltimaFechaQuery('2026-04-21');
    vi.spyOn(supabase, 'from').mockReturnValue(query as never);

    await expect(
      service.validarFechaNoAnteriorAUltimoTipo({
        contribuyenteId: 'cont-1',
        tipoComprobante: 'FACTURA C',
        fechaISO: '2026-04-20',
        puntoVenta: 1,
      }),
    ).rejects.toThrow(
      'No se puede emitir una FACTURA C con fecha anterior a la ultima autorizada para ese tipo: 21/04/2026',
    );
  });

  it('permite FACTURA B anterior a la ultima FACTURA C si no hay ultima FACTURA B', async () => {
    const service = TestBed.inject(FacturacionService);
    const query = createUltimaFechaQuery(null);
    vi.spyOn(supabase, 'from').mockReturnValue(query as never);

    await expect(
      service.validarFechaNoAnteriorAUltimoTipo({
        contribuyenteId: 'cont-1',
        tipoComprobante: 'FACTURA B',
        fechaISO: '2026-04-18',
        puntoVenta: 1,
      }),
    ).resolves.toBeUndefined();

    expect(query.eq).toHaveBeenCalledWith('tipo_comprobante', 'FACTURA B');
  });

  it('mantiene la restriccion de ventana fiscal por actividad antes de consultar ultimo tipo', async () => {
    const service = TestBed.inject(FacturacionService);
    const ultimaFechaSpy = vi.spyOn(service, 'cargarUltimaFechaComprobantePorTipo');

    await expect(
      service.emitirFactura({
        monto: 1000,
        fecha: '01/04/2026',
        tipo_comprobante_resuelto: 'FACTURA C',
      }),
    ).rejects.toThrow('Para servicios solo se permiten facturas hasta 10 dias atras');

    expect(ultimaFechaSpy).not.toHaveBeenCalled();
  });

  it('rechaza la emision antes de ARCA cuando la factura es anterior al ultimo tipo local', async () => {
    const service = TestBed.inject(FacturacionService);
    vi.spyOn(service, 'cargarUltimaFechaComprobantePorTipo').mockResolvedValue('2026-04-22');
    const arcaSpy = vi.spyOn(service as any, 'llamarArca');

    await expect(
      service.emitirFactura({
        monto: 1000,
        fecha: '21/04/2026',
        tipo_comprobante_resuelto: 'FACTURA C',
      }),
    ).rejects.toThrow('No se puede emitir una FACTURA C');

    expect(arcaSpy).not.toHaveBeenCalled();
  });

  it('precalienta el ultimo comprobante y deduplica pedidos en curso por tipo', async () => {
    const service = TestBed.inject(FacturacionService);
    let resolveRequest!: () => void;
    const request = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const prefetchSpy = vi
      .spyOn(service as any, 'llamarPrecalentarUltimoComprobante')
      .mockReturnValue(request);

    const first = service.precalentarUltimoComprobante('FACTURA C');
    const second = service.precalentarUltimoComprobante('FACTURA C');

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect(prefetchSpy).toHaveBeenCalledWith(1, 'FACTURA C');

    resolveRequest();
    await Promise.all([first, second]);
  });

  it('respeta TTL local despues de un prefetch exitoso', async () => {
    const service = TestBed.inject(FacturacionService);
    const prefetchSpy = vi
      .spyOn(service as any, 'llamarPrecalentarUltimoComprobante')
      .mockResolvedValue(undefined);

    await service.precalentarUltimoComprobante('FACTURA C');
    await service.precalentarUltimoComprobante('FACTURA C');

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
  });

  it('vuelve a precalentar cuando cambia el tipo de comprobante', async () => {
    const service = TestBed.inject(FacturacionService);
    const prefetchSpy = vi
      .spyOn(service as any, 'llamarPrecalentarUltimoComprobante')
      .mockResolvedValue(undefined);

    await service.precalentarUltimoComprobante('FACTURA C');
    await service.precalentarUltimoComprobante('FACTURA B');

    expect(prefetchSpy).toHaveBeenCalledTimes(2);
    expect(prefetchSpy).toHaveBeenCalledWith(1, 'FACTURA C');
    expect(prefetchSpy).toHaveBeenCalledWith(1, 'FACTURA B');
  });

  it('rechaza nota de credito con fecha anterior a la ultima NC del mismo tipo', async () => {
    const service = TestBed.inject(FacturacionService);
    const originalQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          tipo_comprobante: 'FACTURA C',
          numero_comprobante: '0001-00000010',
          punto_venta: 1,
          fecha: '2026-04-20',
          cliente_cuit: null,
          cliente_doc_tipo: 99,
          cliente_doc_nro: 0,
          cliente_nombre: null,
          cliente_domicilio: null,
          cliente_condicion_iva: 'Consumidor Final',
        },
        error: null,
      }),
    };
    vi.spyOn(supabase, 'from').mockReturnValue(originalQuery as never);
    vi.spyOn(service, 'cargarUltimaFechaComprobantePorTipo').mockResolvedValue('2026-04-23');

    const resultado = await service.crearNotaCredito('comp-1', '0001-00000010', 1000);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toContain('No se puede emitir una NOTA DE CREDITO C');
  });
});
