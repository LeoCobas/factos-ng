import { SupabaseSystemArcaTicketStorage } from './arca-system-ticket-storage.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function createTicket(credentials: unknown, millisecondsRemaining = 120_000) {
  return {
    credentials,
    toLoginCredentials: () => credentials,
    getTimeUntilExpiration: () => millisecondsRemaining,
  };
}

Deno.test('SupabaseSystemArcaTicketStorage loads a fresh system ticket', async () => {
  const savedCredentials = { token: 'cached', sign: 'signature' };
  const client = {
    from(table: string) {
      assertEquals(table, 'arca_system_tickets');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: { ticket: savedCredentials }, error: null };
        },
      };
    },
  };
  const factory = { create: (credentials: unknown) => createTicket(credentials) };
  const storage = new SupabaseSystemArcaTicketStorage(client, 20_123_456_789, true, factory);

  const ticket = await storage.get('ws_sr_constancia_inscripcion');

  assertEquals(ticket?.toLoginCredentials(), savedCredentials);
});

Deno.test('SupabaseSystemArcaTicketStorage ignores tickets near expiration', async () => {
  const client = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: { ticket: { token: 'stale' } }, error: null };
        },
      };
    },
  };
  const factory = { create: (credentials: unknown) => createTicket(credentials, 30_000) };
  const storage = new SupabaseSystemArcaTicketStorage(client, 20_123_456_789, false, factory);

  assertEquals(await storage.get('ws_sr_constancia_inscripcion'), null);
});

Deno.test('SupabaseSystemArcaTicketStorage upserts tickets by service, CUIT and environment', async () => {
  let upsertPayload: unknown = null;
  let upsertOptions: unknown = null;
  const client = {
    from() {
      return {
        async upsert(payload: unknown, options: unknown) {
          upsertPayload = payload;
          upsertOptions = options;
          return { error: null };
        },
      };
    },
  };
  const factory = { create: (credentials: unknown) => createTicket(credentials) };
  const storage = new SupabaseSystemArcaTicketStorage(client, 20_123_456_789, true, factory);
  const ticket = createTicket({ token: 'new', sign: 'new-signature' });

  await storage.save(ticket, 'ws_sr_constancia_inscripcion');

  assertEquals(upsertPayload, {
    service_name: 'ws_sr_constancia_inscripcion',
    cuit: '20123456789',
    production: true,
    ticket: { token: 'new', sign: 'new-signature' },
  });
  assertEquals(upsertOptions, { onConflict: 'service_name,cuit,production' });
});
