import {
  normalizeVoucherInfo,
  voucherMatchesExpected,
} from '../../../../supabase/functions/_shared/arca-voucher';
import { SupabaseArcaTicketStorage } from '../../../../supabase/functions/_shared/arca-ticket-storage';

describe('ARCA Edge helpers', () => {
  it('normaliza y compara un comprobante recuperado por getVoucherInfo', () => {
    const voucher = normalizeVoucherInfo({
      concepto: 2,
      docTipo: 99,
      docNro: 0,
      cbteDesde: 67,
      cbteFch: '20260802',
      impTotal: 3333.005,
      monId: 'PES',
      monCotiz: 1,
      codAutorizacion: '12345678901234',
    });

    expect(
      voucherMatchesExpected(voucher, {
        concepto: 2,
        docTipo: 99,
        docNro: 0,
        cbteNro: 67,
        cbteFch: 20260802,
        impTotal: 3333,
        monId: 'PES',
        monCotiz: 1,
      }),
    ).toBe(true);
  });

  it('rechaza una recuperacion que pertenece a otro payload', () => {
    const voucher = normalizeVoucherInfo({
      concepto: 2,
      docTipo: 99,
      docNro: 0,
      cbteDesde: 67,
      cbteFch: '20260802',
      impTotal: 4444,
      monId: 'PES',
      monCotiz: 1,
    });

    expect(
      voucherMatchesExpected(voucher, {
        concepto: 2,
        docTipo: 99,
        docNro: 0,
        cbteNro: 67,
        cbteFch: 20260802,
        impTotal: 3333,
        monId: 'PES',
        monCotiz: 1,
      }),
    ).toBe(false);
  });

  it('lee un ticket vigente y persiste renovaciones directamente en Supabase', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const ticket = {
      getTimeUntilExpiration: () => 120_000,
      toLoginCredentials: () => ({ header: [{}, { expirationtime: '2099-01-01' }], credentials: { sign: 's', token: 't' } }),
    };
    const factory = { create: vi.fn(() => ticket) };
    const storage = new SupabaseArcaTicketStorage(
      { rpc },
      'wsfe',
      { __factos_ticket_store__: true, buckets: { wsfe: { stored: true } } },
      factory,
    );

    await expect(storage.get('wsfe')).resolves.toBe(ticket);
    await storage.save(ticket, 'wsfe');

    expect(factory.create).toHaveBeenCalledWith({ stored: true });
    expect(rpc).toHaveBeenCalledWith('merge_arca_ticket_bucket', {
      p_bucket: 'wsfe',
      p_ticket: ticket.toLoginCredentials(),
    });
  });
});
