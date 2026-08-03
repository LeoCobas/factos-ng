import {
  getPreparedEmissionAction,
  getPreparedVoucherNumber,
  type PreparedEmission,
} from './arca-emission-preparation.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function prepared(overrides: Partial<PreparedEmission> = {}): PreparedEmission {
  return {
    attempt_existing: false,
    attempt: { status: 'pending', cbte_nro: 42 },
    comprobante: null,
    ...overrides,
  };
}

Deno.test('persisted emission returns its comprobante without contacting ARCA', () => {
  assertEquals(
    getPreparedEmissionAction(
      prepared({
        attempt_existing: true,
        attempt: { status: 'persisted', cbte_nro: 41 },
        comprobante: { id: 'saved' },
      }),
    ),
    'return_persisted',
  );
});

Deno.test('rejected and conflict attempts are terminal', () => {
  assertEquals(
    getPreparedEmissionAction(
      prepared({ attempt_existing: true, attempt: { status: 'rejected', cbte_nro: 41 } }),
    ),
    'reject_terminal',
  );
  assertEquals(
    getPreparedEmissionAction(
      prepared({ attempt_existing: true, attempt: { status: 'conflict', cbte_nro: 41 } }),
    ),
    'reject_terminal',
  );
});

Deno.test('recoverable existing attempts query voucher info before retrying', () => {
  for (const status of ['pending', 'uncertain', 'authorized']) {
    assertEquals(
      getPreparedEmissionAction(
        prepared({ attempt_existing: true, attempt: { status, cbte_nro: 41 } }),
      ),
      'recover_voucher',
    );
  }
});

Deno.test('missing prepared number fetches last voucher before create', () => {
  assertEquals(
    getPreparedEmissionAction(prepared({ attempt: { status: 'pending', cbte_nro: null } })),
    'fetch_last_voucher',
  );
});

Deno.test('new prepared attempt with a number can create immediately', () => {
  assertEquals(getPreparedEmissionAction(prepared()), 'create_voucher');
});

Deno.test('attempt number is the only prepared voucher number authority', () => {
  assertEquals(
    getPreparedVoucherNumber(
      prepared({
        attempt_existing: true,
        ultimo_comprobante: 99,
        attempt: { status: 'pending', cbte_nro: 41 },
      }),
    ),
    41,
  );
});
