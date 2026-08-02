import { getVerifiedUserId } from './supabase-auth.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('getVerifiedUserId returns the verified subject claim', async () => {
  const auth = {
    getClaims: async (_token: string) => ({
      data: { claims: { sub: 'user-123' } },
      error: null,
    }),
  };

  assertEquals(await getVerifiedUserId(auth, 'token'), 'user-123');
});

Deno.test('getVerifiedUserId rejects claims without a subject', async () => {
  const auth = {
    getClaims: async (_token: string) => ({ data: { claims: {} }, error: null }),
  };

  let message = '';
  try {
    await getVerifiedUserId(auth, 'token');
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }

  assertEquals(message, 'Sesion invalida');
});
