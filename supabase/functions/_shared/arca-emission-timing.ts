export function getEmissionTimingSnapshot(
  timings?: { toJSON(): Record<string, number> },
): Record<string, number> | null {
  if (!timings) return null;

  return Object.fromEntries(
    Object.entries(timings.toJSON()).filter(
      ([, value]) => typeof value === 'number' && Number.isFinite(value),
    ),
  );
}
