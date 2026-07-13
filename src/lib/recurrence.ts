import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  format,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import type { RecurrenceRule } from "@/lib/types";

export type CheckInSlot = {
  time: string; // HH:mm
  done: boolean;
  completedAt?: string | null;
};

export type CheckInsState = {
  day: string; // YYYY-MM-DD
  slots: CheckInSlot[];
};

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

export function parseCheckIns(raw: string | null | undefined): CheckInsState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CheckInsState;
    if (!parsed?.slots?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stringifyCheckIns(state: CheckInsState | null | undefined): string | null {
  if (!state) return null;
  return JSON.stringify(state);
}

/** Evenly spread N times across a typical day (default 10:00–18:00 window). */
export function evenDayTimes(count: number): string[] {
  const n = Math.min(Math.max(count, 1), 12);
  if (n === 1) return ["10:00"];
  const startMin = 10 * 60; // 10:00
  const endMin = 18 * 60; // 18:00
  const times: string[] = [];
  for (let i = 0; i < n; i++) {
    const m = Math.round(startMin + ((endMin - startMin) * i) / (n - 1));
    const h = Math.floor(m / 60);
    const min = m % 60;
    times.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return times;
}

/**
 * Infer multi-slot times from notes/title, e.g. "3 times a day, evenly spread out".
 * Returns null if no multi-slot pattern found.
 */
export function inferTimesFromText(...texts: Array<string | null | undefined>): string[] | null {
  const blob = texts.filter(Boolean).join(" ").toLowerCase();
  if (!blob) return null;

  // Explicit clock times: 10am, 2pm, 6:30 pm
  const explicit: string[] = [];
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(blob)) !== null) {
    let h = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    explicit.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  if (explicit.length >= 2) {
    return [...new Set(explicit)].sort();
  }

  // "3 times a day" / "3x daily" / "thrice a day"
  const nMatch =
    blob.match(/(\d+)\s*(?:x|times?)\s*(?:a\s*)?day/i) ||
    blob.match(/(\d+)\s*times?\s*daily/i);
  if (nMatch) {
    return evenDayTimes(Number(nMatch[1]));
  }
  if (/\bthrice\b/.test(blob) || /three times/.test(blob)) return evenDayTimes(3);
  if (/\btwice\b/.test(blob) || /two times/.test(blob)) return evenDayTimes(2);

  return null;
}

/** Enrich rule with times[] from notes if multi-slot language is present. */
export function enrichRuleWithTimes(
  rule: RecurrenceRule,
  ...texts: Array<string | null | undefined>
): RecurrenceRule {
  const inferred = inferTimesFromText(...texts);
  if (inferred?.length) {
    return {
      ...rule,
      times: inferred,
      time: inferred[0],
    };
  }
  if (rule.times?.length) {
    return { ...rule, time: rule.times[0] ?? rule.time };
  }
  return rule;
}

export function getRuleTimes(rule: RecurrenceRule): string[] {
  if (rule.times?.length) return rule.times;
  if (rule.time) return [rule.time];
  return ["09:00"];
}

export function isMultiSlot(rule: RecurrenceRule | null | undefined): boolean {
  return Boolean(rule?.times && rule.times.length > 1);
}

export function buildCheckInsForDay(day: Date, times: string[]): CheckInsState {
  return {
    day: format(day, "yyyy-MM-dd"),
    slots: times.map((time) => ({ time, done: false, completedAt: null })),
  };
}

export function checkInsProgress(state: CheckInsState | null): {
  done: number;
  total: number;
  allDone: boolean;
  nextTime: string | null;
} {
  if (!state?.slots?.length) {
    return { done: 0, total: 0, allDone: true, nextTime: null };
  }
  const done = state.slots.filter((s) => s.done).length;
  const total = state.slots.length;
  const next = state.slots.find((s) => !s.done);
  return {
    done,
    total,
    allDone: done >= total,
    nextTime: next?.time ?? null,
  };
}

export function describeRecurrence(rule: RecurrenceRule | null | undefined): string {
  if (!rule) return "Does not repeat";
  const times = getRuleTimes(rule);
  const multi =
    times.length > 1 ? ` · ${times.length}× (${times.map(formatTimeLabel).join(", ")})` : "";

  switch (rule.frequency) {
    case "daily":
      return (rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`) + multi;
    case "weekly":
      return (rule.interval === 1 ? "Weekly" : `Every ${rule.interval} weeks`) + multi;
    case "monthly":
      return (rule.interval === 1 ? "Monthly" : `Every ${rule.interval} months`) + multi;
    default:
      return `Custom${multi}`;
  }
}

export function formatTimeLabel(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = Number(mStr) || 0;
  const ap = h >= 12 ? "pm" : "am";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return m ? `${h}:${String(m).padStart(2, "0")}${ap}` : `${h}${ap}`;
}

function applyTime(date: Date, time?: string) {
  if (!time) return date;
  const [h, m] = time.split(":").map(Number);
  return setMinutes(setHours(date, h || 9), m || 0);
}

/** Next calendar occurrence after `from` (uses first slot time for multi-slot rules). */
export function nextOccurrence(rule: RecurrenceRule, from: Date = new Date()): Date {
  const firstTime = getRuleTimes(rule)[0] || "09:00";
  let cursor = applyTime(startOfDay(from), firstTime);

  if (cursor <= from) {
    cursor = addDays(cursor, 1);
  }

  const maxSteps = 400;
  for (let i = 0; i < maxSteps; i++) {
    if (matchesRule(cursor, rule, from)) {
      return applyTime(startOfDay(cursor), firstTime);
    }
    cursor = addDays(cursor, 1);
  }

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
        (startOfDay(date).getTime() - startOfDay(origin).getTime()) /
          (1000 * 60 * 60 * 24 * 7),
      );
      return weeks >= 0 && weeks % (rule.interval || 1) === 0 && date.getDay() === origin.getDay();
    }
    case "monthly": {
      const months =
        (date.getFullYear() - origin.getFullYear()) * 12 +
        (date.getMonth() - origin.getMonth());
      return (
        months >= 0 &&
        months % (rule.interval || 1) === 0 &&
        date.getDate() === origin.getDate()
      );
    }
    default:
      return true;
  }
}

export function advanceFrom(rule: RecurrenceRule, completedOn: Date): Date {
  const firstTime = getRuleTimes(rule)[0] || "09:00";
  switch (rule.frequency) {
    case "daily":
      return applyTime(addDays(startOfDay(completedOn), rule.interval || 1), firstTime);
    case "weekly":
      return applyTime(addWeeks(startOfDay(completedOn), rule.interval || 1), firstTime);
    case "monthly":
      return applyTime(addMonths(startOfDay(completedOn), rule.interval || 1), firstTime);
    default:
      return applyTime(addDays(startOfDay(completedOn), rule.interval || 1), firstTime);
  }
}

/** Due datetime for a slot on a given calendar day. */
export function slotDateTime(day: Date | string, time: string): Date {
  const base = typeof day === "string" ? new Date(day + "T12:00:00") : day;
  return applyTime(startOfDay(base), time);
}

export function dayBounds(d: Date) {
  return { start: startOfDay(d), end: endOfDay(d) };
}
