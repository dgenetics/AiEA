import type { ScheduleJson } from "@/lib/maintenance";

/** Open task fields the Schedules cards need for the amber tint. */
export type CachedOpenCard = {
  id: string;
  scheduleId: string | null;
  board: string | null;
  dueAt: string | null;
  status: string;
};

export type SchedulePlace = { system: string; component: string };

export type SchedulesSnapshot = {
  schedules: ScheduleJson[];
  openCards: CachedOpenCard[];
};

/** Server page payload. `places` is what the cards show before Systems data arrives. */
export type SchedulesPageData = SchedulesSnapshot & {
  places: Record<string, SchedulePlace>;
};

let snapshot: SchedulesSnapshot | null = null;
let generation = 0;

/** Last successful Schedules payload, or null before the first load in this tab. */
export function readSchedulesCache(): SchedulesSnapshot | null {
  return snapshot;
}

export function writeSchedulesCache(next: SchedulesSnapshot) {
  snapshot = next;
}

/**
 * Bump on every fetch. An older response must not overwrite a newer one
 * when a visit and a save overlap.
 */
export function beginSchedulesFetch(): number {
  generation += 1;
  return generation;
}

export function schedulesFetchIsCurrent(id: number): boolean {
  return id === generation;
}

export function clearSchedulesCache() {
  snapshot = null;
  generation = 0;
}
