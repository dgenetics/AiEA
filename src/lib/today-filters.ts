/**
 * Today board density filters.
 * Default: Current lane + due today/overdue (scannable "in play").
 * Lane chips (All | Current | Backlog | Icebox) stick via ?lane=.
 */

import {
  BOARD_LANES,
  resolveBoard,
  type BoardLane,
} from "@/lib/board";
import { endOfDay, startOfDay } from "date-fns";

export const TODAY_LANE_FILTERS = ["all", "current", "backlog", "icebox"] as const;
export type TodayLaneFilter = (typeof TODAY_LANE_FILTERS)[number];

export const TODAY_LANE_META: Record<
  TodayLaneFilter,
  { label: string; board: BoardLane | null }
> = {
  all: { label: "All", board: null },
  current: { label: "Current", board: "CURRENT" },
  backlog: { label: "Backlog", board: "BACKLOG" },
  icebox: { label: "Icebox", board: "ICEBOX" },
};

export function parseTodayLane(raw: string | string[] | undefined): TodayLaneFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v && (TODAY_LANE_FILTERS as readonly string[]).includes(v)) {
    return v as TodayLaneFilter;
  }
  // Default density: Current (not the firehose)
  return "current";
}

export function todayLaneHref(lane: TodayLaneFilter): string {
  // Clean URL for default
  if (lane === "current") return "/today";
  return `/today?lane=${lane}`;
}

/** End of local today — overdue = dueAt < start, due today = dueAt within [start, end]. */
export function todayWindow(now = new Date()) {
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
}

type Boardish = { board?: string | null; priority?: number | null };

/** Due today or overdue (strict dueAt), plus scheduled/follow-up due today. */
export function isDueTodayOrOverdue(
  t: {
    dueAt?: Date | string | null;
    scheduledFor?: Date | string | null;
    followUpDueAt?: Date | string | null;
  },
  window = todayWindow(),
): boolean {
  const { start, end } = window;
  if (t.dueAt) {
    const d = t.dueAt instanceof Date ? t.dueAt : new Date(t.dueAt);
    if (d <= end) return true;
  }
  if (t.scheduledFor) {
    const s = t.scheduledFor instanceof Date ? t.scheduledFor : new Date(t.scheduledFor);
    if (s >= start && s <= end) return true;
  }
  if (t.followUpDueAt) {
    const f = t.followUpDueAt instanceof Date ? t.followUpDueAt : new Date(t.followUpDueAt);
    if (f <= end) return true;
  }
  return false;
}

export function taskBoard(t: Boardish): BoardLane {
  return resolveBoard({ board: t.board, priority: t.priority });
}

/**
 * Default list membership: Current lane AND due today/overdue.
 * Undated Current and future-dated Current stay out of the default.
 */
export function matchesCurrentDefault<T extends Boardish & {
  dueAt?: Date | string | null;
  scheduledFor?: Date | string | null;
  followUpDueAt?: Date | string | null;
}>(t: T, window = todayWindow()): boolean {
  return taskBoard(t) === "CURRENT" && isDueTodayOrOverdue(t, window);
}

/** Firehose / non-default lane: any board, filtered by chip. */
export function matchesLaneFilter<T extends Boardish>(
  t: T,
  lane: TodayLaneFilter,
): boolean {
  if (lane === "all") return true;
  const board = TODAY_LANE_META[lane].board;
  return board != null && taskBoard(t) === board;
}

export { BOARD_LANES };
