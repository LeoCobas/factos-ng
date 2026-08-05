import { TestBed } from '@angular/core/testing';

import { Contribuyente } from '../types/database.types';
import { ContribuyenteService } from './contribuyente.service';
import { supabase } from './supabase.service';

const crearContribuyente = (userId: string, id: string, razonSocial: string): Contribuyente => ({
  id,
  user_id: userId,
  cuit: userId === 'user-1' ? '20315518270' : '27333444556',
  razon_social: razonSocial,
  nombre_fantasia: null,
  domicilio: null,
  condicion_iva: 'Responsable Monotributo',
  ingresos_brutos: null,
  inicio_actividades: null,
  concepto: null,
  actividad: 'servicios',
  iva_porcentaje: null,
  punto_venta: 1,
  monto_maximo_factura: null,
  arca_cert: null,
  arca_key: null,
  arca_production: false,
  arca_ticket: null,
  mp_access_token: null,
  created_at: null,
  updated_at: null,
});

describe('ContribuyenteService', () => {
  const authMock = {
    getUser: vi.fn(),
  };

  let usuarioActualId: string;
  let contribuyentesPorUsuario: Record<string, Contribuyente>;
  let maybeSingle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    usuarioActualId = 'user-1';
    contribuyentesPorUsuario = {
      'user-1': crearContribuyente('user-1', 'contribuyente-1', 'Usuario Uno'),
      'user-2': crearContribuyente('user-2', 'contribuyente-2', 'Usuario Dos'),
    };

    authMock.getUser.mockReset().mockImplementation(async () => ({
      data: { user: { id: usuarioActualId } },
      error: null,
    }));

    maybeSingle = vi.fn().mockImplementation(async () => ({
      data: contribuyentesPorUsuario[usuarioActualId],
      error: null,
    }));

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle,
    };

    vi.spyOn(supabase, 'auth', 'get').mockReturnValue(authMock as never);
    vi.spyOn(supabase, 'from').mockReturnValue(query as never);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('recarga el contribuyente cuando cambia el usuario autenticado', async () => {
    const service = TestBed.inject(ContribuyenteService);

    await service.cargarContribuyente();
    expect(service.contribuyente()?.id).toBe('contribuyente-1');

    usuarioActualId = 'user-2';
    await service.cargarContribuyente();

    expect(service.contribuyente()?.id).toBe('contribuyente-2');
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it('ignora una respuesta pendiente de la sesion anterior despues de reiniciar el estado', async () => {
    const service = TestBed.inject(ContribuyenteService);
    let resolverPrimeraCarga!: (value: { data: Contribuyente; error: null }) => void;

    maybeSingle
      .mockReset()
      .mockImplementationOnce(
        () =>
          new Promise<{ data: Contribuyente; error: null }>((resolve) => {
            resolverPrimeraCarga = resolve;
          }),
      )
      .mockResolvedValueOnce({
        data: contribuyentesPorUsuario['user-2'],
        error: null,
      });

    const primeraCarga = service.cargarContribuyente();
    await vi.waitFor(() => expect(maybeSingle).toHaveBeenCalledOnce());

    service.reiniciarEstado();
    usuarioActualId = 'user-2';
    await service.cargarContribuyente();

    resolverPrimeraCarga({
      data: contribuyentesPorUsuario['user-1'],
      error: null,
    });
    await primeraCarga;

    expect(service.contribuyente()?.id).toBe('contribuyente-2');
    expect(service.inicializado()).toBe(true);
  });
});
