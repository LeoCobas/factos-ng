export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Expose-Headers': 'Server-Timing, x-sb-edge-region',
  'Timing-Allow-Origin': '*',
};

type Now = () => number;

export class RequestTimings {
  private readonly startedAt: number;
  private readonly durations = new Map<string, number>();

  constructor(private readonly now: Now = () => performance.now()) {
    this.startedAt = this.now();
  }

  async measure<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const startedAt = this.now();
    try {
      return await operation();
    } finally {
      this.record(name, this.now() - startedAt);
    }
  }

  record(name: string, durationMs: number): void {
    const normalizedName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    this.durations.set(normalizedName, (this.durations.get(normalizedName) || 0) + durationMs);
  }

  toJSON(): Record<string, number> {
    return {
      ...Object.fromEntries([...this.durations].map(([name, duration]) => [name, round(duration)])),
      total: round(this.now() - this.startedAt),
    };
  }

  toServerTimingHeader(): string {
    return Object.entries(this.toJSON())
      .map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`)
      .join(', ');
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
