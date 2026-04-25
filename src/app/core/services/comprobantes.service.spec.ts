import { TestBed } from '@angular/core/testing';

import { ComprobantesService } from './comprobantes.service';
import { supabase } from './supabase.service';

function createBuilder(data: unknown[] = [], error: unknown = null) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    like: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.like.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockResolvedValue({ data, error });

  return builder;
}

describe('ComprobantesService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve un listado global paginado y detecta si hay mas resultados', async () => {
    const rows = Array.from({ length: 11 }, (_, index) => ({
      id: `comp-${index}`,
      numero_comprobante: `0001-000000${String(index).padStart(2, '0')}`,
      fecha: '2026-04-20',
      total: 15200,
      estado: 'emitida',
      tipo_comprobante: 'FACTURA C',
      cae: '123',
      vencimiento_cae: '20260430',
      pdf_url: null,
      concepto: 'Servicios',
      punto_venta: 1,
      cliente_cuit: '20123456789',
      cliente_nombre: 'Cliente Demo',
      cliente_domicilio: 'Calle 123',
      cliente_condicion_iva: 'Consumidor Final',
      cliente_doc_tipo: 80,
      cliente_doc_nro: 20123456789,
      created_at: '2026-04-20T10:00:00.000Z',
      updated_at: '2026-04-20T10:00:00.000Z',
      comprobante_asociado_id: null,
      comprobante_asociado: null,
    }));
    const builder = createBuilder(rows);

    vi.spyOn(supabase, 'from').mockReturnValue(builder as never);

    TestBed.configureTestingModule({
      providers: [ComprobantesService],
    });

    const service = TestBed.inject(ComprobantesService);
    const result = await service.cargarComprobantesListado('cont-1', {
      offset: 0,
      limit: 10,
    });

    expect(builder.eq).toHaveBeenCalledWith('contribuyente_id', 'cont-1');
    expect(builder.eq).not.toHaveBeenCalledWith('fecha', expect.any(String));
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.range).toHaveBeenCalledWith(0, 10);
    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'comp-0',
        numero_factura: '0001-00000000',
        monto: 15200,
        cliente_nombre: 'Cliente Demo',
      }),
    );
  });

  it('aplica filtro por fecha cuando se pide un listado diario', async () => {
    const builder = createBuilder([]);

    vi.spyOn(supabase, 'from').mockReturnValue(builder as never);

    TestBed.configureTestingModule({
      providers: [ComprobantesService],
    });

    const service = TestBed.inject(ComprobantesService);
    const result = await service.cargarComprobantesListado('cont-1', {
      fecha: '2026-04-20',
      offset: 10,
      limit: 10,
    });

    expect(builder.eq).toHaveBeenCalledWith('contribuyente_id', 'cont-1');
    expect(builder.eq).toHaveBeenCalledWith('fecha', '2026-04-20');
    expect(builder.range).toHaveBeenCalledWith(10, 20);
    expect(result).toEqual({ items: [], hasMore: false });
  });

  it('calcula el resumen diario con notas de credito negativas y anuladas excluidas', async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValueOnce(builder).mockResolvedValueOnce({
      data: [
        { total: 1000, estado: 'emitida', tipo_comprobante: 'FACTURA C' },
        { total: 250, estado: 'emitida', tipo_comprobante: 'NOTA DE CREDITO C' },
        { total: 500, estado: 'anulada', tipo_comprobante: 'FACTURA C' },
      ],
      error: null,
    });

    vi.spyOn(supabase, 'from').mockReturnValue(builder as never);

    TestBed.configureTestingModule({
      providers: [ComprobantesService],
    });

    const service = TestBed.inject(ComprobantesService);
    const result = await service.cargarResumenComprobantesPorFecha('cont-1', '2026-04-20');

    expect(builder.select).toHaveBeenCalledWith('total, estado, tipo_comprobante');
    expect(builder.eq).toHaveBeenCalledWith('contribuyente_id', 'cont-1');
    expect(builder.eq).toHaveBeenCalledWith('fecha', '2026-04-20');
    expect(result).toEqual({ cantidad: 3, total: 750 });
  });
});
