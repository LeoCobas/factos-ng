import { corsHeaders, RequestTimings } from './http-observability.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (actual !== expected) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test('CORS caches preflight and exposes Server-Timing', () => {
  assertEquals(corsHeaders['Access-Control-Max-Age'], '86400');
  assertEquals(corsHeaders['Access-Control-Allow-Headers'].includes('x-region'), true);
  assertEquals(corsHeaders['Access-Control-Expose-Headers'], 'Server-Timing, x-sb-edge-region');
  assertEquals(corsHeaders['Timing-Allow-Origin'], '*');
});

Deno.test('RequestTimings accumulates repeated stages and formats the header', () => {
  let now = 100;
  const timings = new RequestTimings(() => now);

  timings.record('cache_read', 4.25);
  timings.record('cache_read', 5.75);
  timings.record('arca_create', 20);
  now = 135;

  assertEquals(timings.toJSON().cache_read, 10);
  assertEquals(timings.toJSON().total, 35);
  assertEquals(
    timings.toServerTimingHeader(),
    'cache_read;dur=10.0, arca_create;dur=20.0, total;dur=35.0',
  );
});

Deno.test('RequestTimings measures asynchronous stages even when they fail', async () => {
  let now = 0;
  const timings = new RequestTimings(() => now);

  try {
    await timings.measure('auth', async () => {
      now = 12.5;
      throw new Error('failed');
    });
  } catch {
    // Expected: timing must still be recorded by finally.
  }

  assertEquals(timings.toJSON().auth, 12.5);
});
