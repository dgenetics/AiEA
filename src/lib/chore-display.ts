import type { BoardLane } from "@/lib/board";
import { calendarDayDiff, formatCalendarDate } from "@/lib/calendar";
import { intervalDaysFromFrequency } from "@/lib/maintenance";

/** Column for a schedule chore at creation only. Never Icebox. */
export function boardForScheduleDue(due: Date, now = new Date()): BoardLane {
  const days = calendarDayDiff(due, now);
  return days <= 7 ? "CURRENT" : "BACKLOG";
}

export function cadencePhrase(
  frequency: string | null | undefined,
  intervalDays: number | null | undefined,
): string | null {
  const f = frequency?.trim().toLowerCase() || "";
  const days =
    intervalDays != null && Number.isFinite(intervalDays)
      ? intervalDays
      : intervalDaysFromFrequency(frequency);
  if (f === "6mo" || days === 182) return "every 6 mo";
  if (f === "1y" || f === "12mo" || days === 365) return "every 1 yr";
  if (days && days > 0) return `every ${days} days`;
  if (f) return f;
  return null;
}

/** Card line on /schedules: “Every 3 months”, “Every month”, “Every 2 weeks”. */
export function scheduleCardFrequency(
  frequency: string | null | undefined,
  intervalDays: number | null | undefined,
): string {
  const f = frequency?.trim().toLowerCase() || "";
  const days =
    intervalDays != null && Number.isFinite(intervalDays)
      ? intervalDays
      : intervalDaysFromFrequency(frequency);
  if (f === "7d" || days === 7) return "Every week";
  if (f === "14d" || days === 14) return "Every 2 weeks";
  if (f === "30d" || days === 30) return "Every month";
  if (f === "60d" || days === 60) return "Every 2 months";
  if (f === "90d" || days === 90) return "Every 3 months";
  if (f === "6mo" || days === 182) return "Every 6 months";
  if (f === "1y" || f === "12mo" || days === 365) return "Every year";
  if (days && days > 0) return days === 1 ? "Every day" : `Every ${days} days`;
  if (f) return f;
  return "—";
}

export function choreDuePresentation(
  due: Date | string | null | undefined,
  now = new Date(),
): { text: string; tone: "overdue" | "soon" | "later" } | null {
  if (!due) return null;
  const days = calendarDayDiff(due, now);
  if (Number.isNaN(days)) return null;
  if (days < 0) return { text: `Overdue ${Math.abs(days)}d`, tone: "overdue" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow (in 1d)", tone: "soon" };
  if (days <= 7) {
    const when = formatCalendarDate(due, { weekday: "short" });
    return { text: `Due ${when} (in ${days}d)`, tone: "soon" };
  }
  return {
    text: formatCalendarDate(due, { month: "short", day: "numeric" }),
    tone: "later",
  };
}
