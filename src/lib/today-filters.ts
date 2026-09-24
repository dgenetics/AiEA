/**
 * Today board density filters.
 * Default: Current lane + due today / overdue by <= 7 days (scannable "in play").
 * Current items overdue 8+ days are "stale" — collapsed into a Stale row.
 * Lane chips (All | Current | Backlog | Icebox) stick via ?lane=.
 */

import {
  BOARD_LANES,
  resolveBoard,
  type BoardLane,
} from "@/lib/board";
import { calendarDayDiff } from "@/lib/calendar";
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

/** Server-clock day bounds — DB prefilter only; membership uses classifyTodayTask (app timezone). */
export function todayWindow(now = new Date()) {
  return {
    start: startOfDay(now),
    end: endOfDay(now),
  };
}

type Boardish = { board?: string | null; priority?: number | null };

export function taskBoard(t: Boardish): BoardLane {
  return resolveBoard({ board: t.board, priority: t.priority });
}

/** Overdue by more than this many calendar days = stale (exactly 7 still shows). */
export const STALE_OVERDUE_DAYS = 7;

export type TodayClass = "main" | "stale" | "hidden";

type TodayTaskish = Boardish & {
  dueAt?: Date | string | null;
  scheduledFor?: Date | string | null;
  followUpDueAt?: Date | string | null;
  isFollowUp?: boolean | null;
};

/**
 * Calendar days overdue in the app timezone (AIEA_TIMEZONE, default
 * America/New_York) — not the server's UTC date. 0 = due today, <0 = future.
 */
export function overdueDays(
  dueAt: Date | string,
  now: Date = new Date(),
): number {
  return 0 - calendarDayDiff(dueAt, now); // avoid -0 for due today
}

/**
 * Default Today membership (pure, testable):
 * - main:   Current AND (due today OR overdue <= 7d, scheduled today,
 *           follow-up due <= today). Follow-ups never go stale.
 * - stale:  Current AND overdue 8+ days (collapsed Stale row).
 * - hidden: everything else (other lanes, undated, future-dated).
 */
export function classifyTodayTask(
  t: TodayTaskish,
  now: Date = new Date(),
): TodayClass {
  if (taskBoard(t) !== "CURRENT") return "hidden";
  if (t.scheduledFor && calendarDayDiff(t.scheduledFor, now) === 0) return "main";
  if (t.followUpDueAt && calendarDayDiff(t.followUpDueAt, now) <= 0) return "main";
  if (!t.dueAt) return "hidden";
  const od = overdueDays(t.dueAt, now);
  if (od < 0) return "hidden";
  if (od <= STALE_OVERDUE_DAYS || t.isFollowUp) return "main";
  return "stale";
}

/** Default list membership: classifyTodayTask === "main". */
export function matchesCurrentDefault(
  t: TodayTaskish,
  now: Date = new Date(),
): boolean {
  return classifyTodayTask(t, now) === "main";
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
