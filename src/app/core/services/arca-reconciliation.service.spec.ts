import { TestBed } from '@angular/core/testing';

import { ArcaReconciliationService } from './arca-reconciliation.service';
import { supabase } from './supabase.service';

describe('ArcaReconciliationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.__FACTOS_RUNTIME_CONFIG__ = {
      supabase: {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
      },
    };
    TestBed.configureTestingModule({ providers: [ArcaReconciliationService] });
  });

  afterEach(() => vi.restoreAllMocks());

  it('refresca un token proximo a vencer antes de auditar', async () => {
    vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({
      data: {
        session: {
          access_token: 'old-token',
          expires_at: Math.floor(Date.now() / 1000) + 30,
        },
      },
      error: null,
    } as never);
    const refreshSpy = vi.spyOn(supabase.auth, 'refreshSession').mockResolvedValue({
      data: { session: { access_token: 'fresh-token' } },
      error: null,
    } as never);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, data: { first: 1, last: 1, summary: {}, results: [] } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await TestBed.inject(ArcaReconciliationService).auditar(1, 'FACTURA C');

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      }),
    );
  });
});
