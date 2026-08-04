import {
  consumePadronLookupRateLimit,
  PADRON_RATE_LIMIT_MAX_REQUESTS,
  PADRON_RATE_LIMIT_WINDOW_SECONDS,
} from './padron-rate-limit.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('consumePadronLookupRateLimit returns the atomic database decision', async () => {
  let rpcName = '';
  let rpcArgs: unknown = null;
  const db = {
    async rpc(name: string, args: unknown) {
      rpcName = name;
      rpcArgs = args;
      return {
        data: [{ allowed: true, remaining: 8, retry_after_seconds: 0 }],
        error: null,
      };
    },
  };

  const result = await consumePadronLookupRateLimit(db, 'user-123');

  assertEquals(rpcName, 'consume_padron_lookup_rate_limit');
  assertEquals(rpcArgs, {
    p_user_id: 'user-123',
    p_max_requests: PADRON_RATE_LIMIT_MAX_REQUESTS,
    p_window_seconds: PADRON_RATE_LIMIT_WINDOW_SECONDS,
  });
  assertEquals(result, { allowed: true, remaining: 8, retryAfterSeconds: 0 });
});

Deno.test('consumePadronLookupRateLimit fails closed when the database check fails', async () => {
  const db = {
    async rpc() {
      return { data: null, error: { message: 'database unavailable' } };
    },
  };

  let message = '';
  try {
    await consumePadronLookupRateLimit(db, 'user-123');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, 'No se pudo validar el limite de consultas: database unavailable');
});
