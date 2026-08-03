import { getEmissionTimingSnapshot } from './arca-emission-timing.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('getEmissionTimingSnapshot keeps only finite numeric stage durations', () => {
  const snapshot = getEmissionTimingSnapshot({
    toJSON: () =>
      ({
        auth: 100,
        emission_prepare_db: 200,
        total: 350,
        token: 'secret',
        certificate: 'certificate',
        payload: { doc_nro: 1 },
        invalid: Number.NaN,
        infinite: Number.POSITIVE_INFINITY,
      }) as unknown as Record<string, number>,
  });

  assertEquals(snapshot, {
    auth: 100,
    emission_prepare_db: 200,
    total: 350,
  });
});

Deno.test('getEmissionTimingSnapshot returns null without timings', () => {
  assertEquals(getEmissionTimingSnapshot(), null);
});
