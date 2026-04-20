import { TestBed } from '@angular/core/testing';

import { ComprobantesService } from './comprobantes.service';
import { supabase } from './supabase.service';

describe('ComprobantesService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve un listado tipado por fecha', async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    } as unknown as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockResolvedValue({
      data: [
        {
          id: 'comp-1',
          numero_comprobante: '0001-00000012',
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
        },
      ],
      error: null,
    });

    vi.spyOn(supabase, 'from').mockReturnValue(builder as never);

    TestBed.configureTestingModule({
      providers: [ComprobantesService],
    });

    const service = TestBed.inject(ComprobantesService);
    const result = await service.cargarComprobantesPorFecha('cont-1', '2026-04-20');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'comp-1',
        numero_factura: '0001-00000012',
        monto: 15200,
        cliente_nombre: 'Cliente Demo',
      }),
    ]);
  });

  it('devuelve null si falla la consulta de ultima fecha', async () => {
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    } as unknown as {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    };

    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockResolvedValue({ data: null, error: { message: 'boom' } });

    vi.spyOn(supabase, 'from').mockReturnValue(builder as never);

    TestBed.configureTestingModule({
      providers: [ComprobantesService],
    });

    const service = TestBed.inject(ComprobantesService);

    await expect(service.cargarUltimaFechaConComprobantes('cont-1')).resolves.toBeNull();
  });
});
