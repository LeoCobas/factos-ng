import { scheduleEmissionTimingPersistence } from './arca-emission-background-timing.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('scheduleEmissionTimingPersistence stores the completed persistence timing in background', async () => {
  let scheduled: Promise<unknown> | undefined;
  let persisted: { emisionId: string; timings: Record<string, number> } | undefined;

  scheduleEmissionTimingPersistence({
    emisionId: '00000000-0000-0000-0000-000000000001',
    timings: {
      toJSON: () => ({ emission_prepare_db: 175.2, durable_persist: 418.4, total: 901.7 }),
    },
    persist: async (emisionId, timings) => {
      persisted = { emisionId, timings };
    },
    waitUntil: (promise) => {
      scheduled = promise;
    },
  });

  if (!scheduled) throw new Error('Background persistence was not scheduled');
  await scheduled;

  assertEquals(persisted, {
    emisionId: '00000000-0000-0000-0000-000000000001',
    timings: { emission_prepare_db: 175.2, durable_persist: 418.4, total: 901.7 },
  });
});

Deno.test('scheduleEmissionTimingPersistence contains telemetry failures', async () => {
  let scheduled: Promise<unknown> | undefined;
  let reportedError = '';

  scheduleEmissionTimingPersistence({
    emisionId: '00000000-0000-0000-0000-000000000002',
    timings: { toJSON: () => ({ durable_persist: 250 }) },
    persist: async () => {
      throw new Error('telemetry unavailable');
    },
    waitUntil: (promise) => {
      scheduled = promise;
    },
    onError: (error) => {
      reportedError = error instanceof Error ? error.message : String(error);
    },
  });

  if (!scheduled) throw new Error('Background persistence was not scheduled');
  await scheduled;

  assertEquals(reportedError, 'telemetry unavailable');
});
