/**
 * Calendar-date helpers for America/New_York (default).
 * Avoids the UTC-midnight bug: "2026-07-13T00:00:00Z" → July 12 evening in NY.
 *
 * Convention: store due *days* as noon in the app timezone when possible.
 */

export const APP_TIMEZONE =
  process.env.AIEA_TIMEZONE?.trim() || "America/New_York";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Y/M/D/H/M/S parts in APP_TIMEZONE (or override). */
export function zonedParts(date: Date = new Date(), timeZone: string = APP_TIMEZONE) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const hour = map.hour === "24" ? 0 : Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month), // 1–12
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Calendar YYYY-MM-DD in app timezone. */
export function localYmd(d: Date = new Date(), timeZone: string = APP_TIMEZONE): string {
  const p = zonedParts(d, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/**
 * A Date at local noon on that calendar day, expressed as a real instant.
 * Built from NY (or app) Y-M-D so "today" matches New York.
 */
export function localNoon(y: number, monthIndex: number, day: number): Date {
  // monthIndex is 0-based (JS Date convention)
  return new Date(y, monthIndex, day, 12, 0, 0, 0);
}

export function localNoonFromYmd(ymd: string): Date {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return localNoonToday();
  return localNoon(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function localNoonToday(timeZone: string = APP_TIMEZONE): Date {
  const p = zonedParts(new Date(), timeZone);
  return localNoon(p.year, p.month - 1, p.day);
}

export function localNoonPlusDays(
  days: number,
  from: Date = new Date(),
  timeZone: string = APP_TIMEZONE,
): Date {
  const p = zonedParts(from, timeZone);
  const base = localNoon(p.year, p.month - 1, p.day);
  base.setDate(base.getDate() + days);
  return base;
}

/**
 * Interpret a stored due value as a calendar day in the app timezone (noon).
 * UTC midnights use the UTC Y-M-D as the intended calendar day.
 */
export function toLocalCalendarDay(
  date: Date | string,
  timeZone: string = APP_TIMEZONE,
): Date {
  if (typeof date === "string") {
    const pure = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (pure) return localNoonFromYmd(date);

    const prefix = date.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (prefix) {
      const d = new Date(date);
      if (
        !Number.isNaN(d.getTime()) &&
        d.getUTCHours() === 0 &&
        d.getUTCMinutes() === 0 &&
        d.getUTCSeconds() === 0
      ) {
        return localNoon(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      }
      if (!Number.isNaN(d.getTime())) {
        const p = zonedParts(d, timeZone);
        return localNoon(p.year, p.month - 1, p.day);
      }
      return localNoonFromYmd(`${prefix[1]}-${prefix[2]}-${prefix[3]}`);
    }
  }

  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return localNoonToday(timeZone);

  if (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  ) {
    return localNoon(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  const p = zonedParts(d, timeZone);
  return localNoon(p.year, p.month - 1, p.day);
}

/** Store a calendar due date as local-noon ISO (safe for NY display). */
export function toStoredDueDate(date: Date | string): string {
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return localNoonFromYmd(date).toISOString();
  }
  return toLocalCalendarDay(date).toISOString();
}

/** YYYY-MM-DD for date inputs */
export function toDateInputValue(date: Date | string | null | undefined): string {
  if (!date) return "";
  return localYmd(toLocalCalendarDay(date));
}

export function formatCalendarDate(
  date: Date | string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "No date";
  const d = toLocalCalendarDay(date);
  return d.toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    ...(opts ?? { month: "short", day: "numeric", year: "numeric" }),
  });
}

export function calendarDayDiff(
  target: Date | string,
  from: Date = new Date(),
): number {
  const a = toLocalCalendarDay(from);
  const b = toLocalCalendarDay(target);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Human label for current app timezone. */
export function timezoneLabel(): string {
  return APP_TIMEZONE === "America/New_York" ? "Eastern Time (New York)" : APP_TIMEZONE;
}
