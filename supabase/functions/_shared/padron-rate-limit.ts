export const PADRON_RATE_LIMIT_MAX_REQUESTS = 10;
export const PADRON_RATE_LIMIT_WINDOW_SECONDS = 60;

export interface PadronRateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

function firstRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
  }

  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export async function consumePadronLookupRateLimit(
  db: RpcClient,
  userId: string,
): Promise<PadronRateLimitDecision> {
  const { data, error } = await db.rpc('consume_padron_lookup_rate_limit', {
    p_user_id: userId,
    p_max_requests: PADRON_RATE_LIMIT_MAX_REQUESTS,
    p_window_seconds: PADRON_RATE_LIMIT_WINDOW_SECONDS,
  });

  if (error) {
    throw new Error(`No se pudo validar el limite de consultas: ${error.message || 'error desconocido'}`);
  }

  const record = firstRecord(data);
  if (!record) {
    throw new Error('No se pudo validar el limite de consultas: respuesta vacia');
  }

  return {
    allowed: record.allowed === true,
    remaining: Number(record.remaining || 0),
    retryAfterSeconds: Number(record.retry_after_seconds || 0),
  };
}
