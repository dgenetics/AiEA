import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  boardColor as boardChipClass,
  boardFromPriority,
  boardLabel as boardLaneLabel,
} from "@/lib/board";
import {
  calendarDayDiff,
  formatCalendarDate,
  toLocalCalendarDay,
} from "@/lib/calendar";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDue(date: Date | string | null | undefined): string {
  if (!date) return "No date";
  const d = toLocalCalendarDay(date);
  if (Number.isNaN(d.getTime())) return "No date";

  const dayDiff = calendarDayDiff(d);

  if (dayDiff < 0) return dayDiff === -1 ? "Yesterday" : `${Math.abs(dayDiff)}d overdue`;
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  if (dayDiff < 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return formatCalendarDate(d, { month: "short", day: "numeric" });
}

/** @deprecated Prefer boardLabel / resolveBoard from `@/lib/board`. */
export function priorityLabel(priority: number | null | undefined): string {
  return boardLaneLabel(boardFromPriority(priority));
}

/** @deprecated Prefer boardColor / resolveBoard from `@/lib/board`. */
export function priorityColor(priority: number | null | undefined): string {
  return boardChipClass(boardFromPriority(priority));
}

export function areaColor(slug: string): string {
  switch (slug) {
    case "work":
      return "#6366f1";
    case "life":
      return "#f59e0b";
    default:
      return "#8b5cf6";
  }
}
