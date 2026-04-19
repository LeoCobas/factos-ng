export type ArcaTicketBucket = 'wsfe' | 'padron';

type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

function asRecord(value: JsonLike | undefined): Record<string, JsonLike> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonLike>)
    : {};
}

export function readArcaTicketBucket(
  storedTicket: JsonLike | undefined,
  bucket: ArcaTicketBucket,
): JsonLike | null {
  const record = asRecord(storedTicket);

  if (record['__factos_ticket_store__'] === true) {
    const buckets = asRecord(record['buckets']);
    return (buckets[bucket] as JsonLike | undefined) ?? null;
  }

  if (Object.keys(record).length === 0) {
    return null;
  }

  // Compatibilidad hacia atrás: si aún hay un ticket plano, asumimos que era de WSFE.
  return bucket === 'wsfe' ? (storedTicket ?? null) : null;
}

export function writeArcaTicketBucket(
  storedTicket: JsonLike | undefined,
  bucket: ArcaTicketBucket,
  nextTicket: JsonLike | undefined,
): JsonLike {
  const record = asRecord(storedTicket);
  const existingBuckets =
    record['__factos_ticket_store__'] === true ? asRecord(record['buckets']) : {};

  const buckets: Record<string, JsonLike> = { ...existingBuckets };

  if (nextTicket == null) {
    delete buckets[bucket];
  } else {
    buckets[bucket] = nextTicket;
  }

  return {
    __factos_ticket_store__: true,
    buckets,
  };
}
