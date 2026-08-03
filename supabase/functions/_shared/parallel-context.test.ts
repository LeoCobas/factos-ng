import { verifyAndLoadContext } from './parallel-context.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

async function assertRejects(operation: () => Promise<unknown>, expectedMessage: string) {
  let message = '';
  try {
    await operation();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  assertEquals(message, expectedMessage);
}

Deno.test('verifyAndLoadContext starts auth and context before either resolves', async () => {
  const started: string[] = [];
  let resolveAuth!: (value: string) => void;
  let resolveContext!: (value: { id: string }) => void;

  const result = verifyAndLoadContext(
    () =>
      new Promise((resolve) => {
        started.push('auth');
        resolveAuth = resolve;
      }),
    () =>
      new Promise((resolve) => {
        started.push('context');
        resolveContext = resolve;
      }),
  );

  await Promise.resolve();
  assertEquals(started, ['auth', 'context']);
  resolveContext({ id: 'context-1' });
  resolveAuth('user-1');
  assertEquals(await result, {
    userId: 'user-1',
    context: { id: 'context-1' },
  });
});

Deno.test('verifyAndLoadContext rejects when authentication fails', async () => {
  let contextStarted = false;

  await assertRejects(
    () =>
      verifyAndLoadContext(
        async () => {
          throw new Error('Sesion invalida');
        },
        async () => {
          contextStarted = true;
          return { id: 'context-1' };
        },
      ),
    'Sesion invalida',
  );

  assertEquals(contextStarted, true);
});

Deno.test('verifyAndLoadContext rejects when context loading fails', async () => {
  await assertRejects(
    () =>
      verifyAndLoadContext(
        async () => 'user-1',
        async () => {
          throw new Error('No se pudo obtener el contexto');
        },
      ),
    'No se pudo obtener el contexto',
  );
});
