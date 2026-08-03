import { getEmissionTimingSnapshot } from './arca-emission-timing.ts';

interface ScheduleEmissionTimingPersistenceParams {
  emisionId: string;
  timings: { toJSON(): Record<string, number> };
  persist: (emisionId: string, timings: Record<string, number>) => Promise<void>;
  waitUntil: (promise: Promise<unknown>) => void;
  onError?: (error: unknown) => void;
}

export function scheduleEmissionTimingPersistence(
  params: ScheduleEmissionTimingPersistenceParams,
): void {
  const snapshot = getEmissionTimingSnapshot(params.timings);
  if (!snapshot) return;

  const task = params.persist(params.emisionId, snapshot).catch((error) => {
    params.onError?.(error);
  });
  params.waitUntil(task);
}
