/**
 * Hardened system prompts for AiEA.
 * Keep behavioral rules here — schemas live in schemas.ts.
 */

export type CaptureContext = {
  todayISO: string; // YYYY-MM-DD
  nowISO: string;
  timezone: string;
  weekday: string;
  endOfMonthISO: string;
  userName?: string;
  /** Formatted few-shot corrections from the user */
  trainingBlock?: string;
};

export function buildCaptureSystemPrompt(ctx: CaptureContext): string {
  return `You turn a farm-and-home brain dump into tasks that are created immediately. There is no review step.

## Clock (authoritative)
- Timezone: ${ctx.timezone}
- Today: ${ctx.todayISO} (${ctx.weekday})
- Now: ${ctx.nowISO}
- End of this month: ${ctx.endOfMonthISO}
${ctx.userName ? `- User: ${ctx.userName}` : ""}

${ctx.trainingBlock ? `${ctx.trainingBlock}\n` : ""}

## Split
- Separate actions on "and", commas, or new lines become separate tasks.
- Keep one action whole when "and" joins objects ("buy nails and screws" is one task).
- Drop filler ("um", "uh", "remind me to").
- Do not invent tasks that were not said.

## Dates
Resolve dates in ${ctx.timezone}.
- "today" / "tonight" → ${ctx.todayISO}
- "tomorrow" → the next calendar day
- a weekday ("Thursday") → the next occurrence, including today
- "this week" → a day within the next few days
- "next week" → about 7 days out
- If no date was said, dueAt is null. Do not invent a deadline.

## Lanes (lean Icebox when unclear)
- CURRENT: "today", "tonight", "urgent", "now", "asap", or due within about 2 days.
- BACKLOG: "this week", "next week", "soon", "after …", or due within about 14 days.
- ICEBOX: vague, "someday", "maybe", "idea", "think about", or no timing signal. This is the default.
boardReason is at most 80 characters, e.g. said 'someday' or no timing given.

## Titles
Verb-first, under 300 characters. Extra context goes in notes.

## Output
Return { "tasks": [ { title, notes, dueAt, board, boardReason } ] }.
If the text has no actionable content, return { "tasks": [] }.`;
}

export function buildCaptureUserPrompt(rawText: string): string {
  return `Capture text:

---
${rawText.trim()}
---

Turn it into tasks.`;
}

/** Clock context for prompts — defaults to America/New_York. */
export function getPromptClock(timezone?: string): CaptureContext {
  const tz =
    timezone ||
    process.env.AIEA_TIMEZONE?.trim() ||
    "America/New_York";

  const now = new Date();
  const todayISO = formatInTimeZone(now, tz, "date");
  const nowISO = formatInTimeZone(now, tz, "datetime");
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: tz,
  }).format(now);

  // Last calendar day of the current month in that timezone
  const parts = getZonedParts(now, tz);
  const lastDay = new Date(parts.year, parts.month, 0).getDate();
  const endOfMonthISO = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return {
    todayISO,
    nowISO,
    timezone: tz,
    weekday,
    endOfMonthISO,
  };
}

function getZonedParts(date: Date, timeZone: string) {
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
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function formatInTimeZone(
  date: Date,
  timeZone: string,
  mode: "date" | "datetime",
): string {
  const p = getZonedParts(date, timeZone);
  const d = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (mode === "date") return d;
  const offset = guessOffset(date, timeZone);
  return `${d}T${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}:${String(p.second).padStart(2, "0")}${offset}`;
}

function guessOffset(date: Date, timeZone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const part = fmt.formatToParts(date).find((x) => x.type === "timeZoneName")
      ?.value;
    // e.g. "GMT-4" or "GMT+5:30"
    if (part?.startsWith("GMT")) {
      const rest = part.slice(3) || "+00:00";
      if (rest === "") return "+00:00";
      if (/^[+-]\d{1,2}$/.test(rest)) {
        const sign = rest[0];
        const h = rest.slice(1).padStart(2, "0");
        return `${sign}${h}:00`;
      }
      if (/^[+-]\d{1,2}:\d{2}$/.test(rest)) {
        const sign = rest[0];
        const [h, m] = rest.slice(1).split(":");
        return `${sign}${h.padStart(2, "0")}:${m}`;
      }
    }
  } catch {
    /* fall through */
  }
  // Fallback: server local offset
  const mins = -date.getTimezoneOffset();
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  const h = String(Math.floor(abs / 60)).padStart(2, "0");
  const m = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}
