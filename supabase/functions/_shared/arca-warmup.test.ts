import { warmWsfeConnection } from './arca-warmup.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('warmWsfeConnection authenticates with a lightweight WSFE request', async () => {
  let maxRecordsCalls = 0;
  const service = {
    async getMaxRecordsPerRequest() {
      maxRecordsCalls += 1;
      return { maxRecords: 1 };
    },
  };

  await warmWsfeConnection(service);

  assertEquals(maxRecordsCalls, 1);
});
