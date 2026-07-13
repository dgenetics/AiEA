import { addDays, addMonths, addWeeks, setHours, setMinutes, startOfDay } from "date-fns";
import type { RecurrenceRule } from "@/lib/types";

export function parseRecurrenceRule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecurrenceRule;
  } catch {
    return null;
  }
}

export function stringifyRecurrenceRule(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  return JSON.stringify(rule);
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return "Does not repeat";
  const n = rule.interval > 1 ? ` every ${rule.interval}` : "";
  switch (rule.frequency) {
    case "daily":
      return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
    case "weekly":
      return rule.interval === 1 ? "Weekly" : `Every ${rule.interval} weeks`;
    case "monthly":
      return rule.interval === 1 ? "Monthly" : `Every ${rule.interval} months`;
    default:
      return `Custom${n}`;
  }
}

function applyTime(date: Date, time?: string) {
  if (!time) return date;
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(date, h || 9), m || 0);
}

/** Compute the next fire time after `from` for a recurrence rule. */
export function nextOccurrence(rule: RecurrenceRule, from: Date = new Date()): Date {
  let cursor = applyTime(startOfDay(from), rule.time);

  // If today's time already passed, start from tomorrow
  if (cursor <= from) {
    cursor = addDays(cursor, 1);
  }

  const maxSteps = 400;
  for (let i = 0; i < maxSteps; i++) {
    if (matchesRule(cursor, rule, from)) {
      return cursor;
    }
    cursor = addDays(cursor, 1);
  }

  // Fallback
  return addDays(from, rule.interval || 1);
}

function matchesRule(date: Date, rule: RecurrenceRule, origin: Date): boolean {
  if (rule.byWeekday?.length && !rule.byWeekday.includes(date.getDay())) {
    return false;
  }

  switch (rule.frequency) {
    case "daily": {
      const days = Math.floor(
        (startOfDay(date).getTime() - startOfDay(origin).getTime()) / (1000 * 60 * 60 * 24),
      );
      return days >= 0 && days % (rule.interval || 1) === 0;
    }
    case "weekly": {
      if (rule.byWeekday?.length) return true;
      const weeks = Math.floor(
        (startOfDay(date).getTime() - startOfDay(origin).getTime()) / (1000 * 60 * 60 * 24 * 7),
      );
      return weeks >= 0 && weeks % (rule.interval || 1) === 0 && date.getDay() === origin.getDay();
    }
    case "monthly": {
      const months =
        (date.getFullYear() - origin.getFullYear()) * 12 + (date.getMonth() - origin.getMonth());
      return months >= 0 && months % (rule.interval || 1) === 0 && date.getDate() === origin.getDate();
    }
    default:
      return true;
  }
}

export function advanceFrom(rule: RecurrenceRule, completedOn: Date): Date {
  switch (rule.frequency) {
    case "daily":
      return applyTime(addDays(completedOn, rule.interval || 1), rule.time);
    case "weekly":
      return applyTime(addWeeks(completedOn, rule.interval || 1), rule.time);
    case "monthly":
      return applyTime(addMonths(completedOn, rule.interval || 1), rule.time);
    default:
      return applyTime(addDays(completedOn, rule.interval || 1), rule.time);
  }
}
