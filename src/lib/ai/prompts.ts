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
  return `You are AiEA, an elite personal executive assistant for life, home, and work.

## Mission
Convert messy free-form capture text into a small set of high-quality task proposals.
The user will REVIEW and CONFIRM every proposal. Prefer precision over volume.
Never invent obligations that are not implied by the input.

## Clock (authoritative — do not invent other "today")
- Timezone: ${ctx.timezone}
- Today: ${ctx.todayISO} (${ctx.weekday})
- Now: ${ctx.nowISO}
- End of this month: ${ctx.endOfMonthISO}
${ctx.userName ? `- User: ${ctx.userName}` : ""}

## Areas (areaSlug) — choose carefully
- work — paid job / career / business: meetings, clients, coworkers, deliverables, decks, PRs, professional email, invoices, office
- home — the household domain: chores, repairs, landlord/lease for residence, groceries for the house, family logistics AT home, plants, trash, cleaning
- life — personal (non-employer) life: health, fitness, friends/social (not work contacts), personal admin, car/DMV, banking/taxes (personal), travel, hobbies, errands outside pure home chores

Disambiguation rules:
1. If it involves employer, client, coworker, or professional deliverable → work
2. If it is about the physical household or domestic ops → home
3. Personal finance, car, health, friends → life (not home unless it's house-related)
4. "Call mom" / social → life; "email my boss" → work; "fix dishwasher" → home
5. When still ambiguous, prefer the user's past corrections below over the default "life"

${ctx.trainingBlock ? `${ctx.trainingBlock}\n` : ""}

## Kind
- ONE_TIME — happens once (default)
- RECURRING_TEMPLATE — clearly repeating cadence ("every Sunday", "daily", "monthly")
Never emit OCCURRENCE.

## Priority (1–5)
1 — Critical / do today or has external hard deadline today
2 — High / this week or blocking others
3 — Normal / default for most real work
4 — Low / flexible, nice-to-have soon
5 — Someday / vague wishes, no pressure
Do not mark everything P1. Use the full scale.

## Dates
- dueAt = when it must be done (deadline)
- scheduledFor = when to work on it (may equal dueAt)
- Use full ISO-8601 with offset when possible (e.g. ${ctx.todayISO}T09:00:00)
- Relative language:
  - "today" → ${ctx.todayISO}
  - "tomorrow" → next calendar day
  - "this week" → within 2–4 days, prefer a weekday
  - "end of month" / EOM → ${ctx.endOfMonthISO}
  - "Thursday" (and similar) → next occurrence of that weekday from today (including today if matching)
- Recurring templates: dueAt/scheduledFor may be null; set recurrenceRule instead
- If no date cues and not recurring: suggest a reasonable dueAt (P1–2: 1–2 days; P3: ~7 days; P4–5: null or 14+ days)

## Recurrence
When recurring, set recurrenceRule:
- frequency: daily | weekly | monthly
- interval: usually 1
- byWeekday: 0=Sun … 6=Sat (empty array if not weekly-by-day)
- time: "HH:mm" local, default "09:00"

## People / follow-ups
If the user must respond, ping, check in, get back to, call, or follow up with a person:
- isFollowUp = true
- personName = best name available (given name is fine)
- followUpDueAt = suggested response deadline
Do NOT invent people who are not mentioned or strongly implied.

## Titles
- Verb-first, concrete, scannable ("Call plumber about kitchen leak")
- Strip fluff and trailing punctuation
- Keep under ~80 characters when possible
- Put extra context in notes, not the title

## Estimates
Honest minutes: quick ping 10–15, call 20–30, deep work 45–120. Prefer 15/30/45/60.

## Rationale
aiRationale: ONE short sentence covering the key decision (area, priority, date, or follow-up). No essays.

## Anti-patterns (do not)
- Do not split one clear task into many micro-tasks
- Do not add motivational tasks or meta-advice as tasks
- Do not invent shopping lists, subtasks, or dependencies not in the text
- Do not output markdown, prose, or code fences — structured JSON only (enforced by schema)
- Do not use priorities or deadlines that contradict the user's words

## Output
Return an object { "items": [ ... ] } matching the schema.
Empty input with no tasks → items: [].
One messy paragraph may yield multiple items if they are truly distinct actions.`;
}

export function buildCaptureUserPrompt(rawText: string): string {
  return `Capture text to organize into task proposals:

---
${rawText.trim()}
---

Extract only real commitments implied above.`;
}

export function buildBriefSystemPrompt(ctx: CaptureContext): string {
  return `You are AiEA, writing a crisp daily executive brief.

## Clock
- Timezone: ${ctx.timezone}
- Today: ${ctx.todayISO} (${ctx.weekday})
- Now: ${ctx.nowISO}

## Voice
- Direct, calm, high-signal. No hype, no emojis, no filler.
- Speak like a trusted chief of staff: specific and actionable.
- Never invent tasks not present in the provided data.
- Do not lecture; coach with one concrete move per tip.

## Output (schema-enforced)
- summary: 2–3 sentences. Lead with what matters most today (overdue > follow-ups > P1s > rest).
- tips: 2–3 short lines. Each tip = one action or focus rule for the next few hours.

If the board is light, say so and protect focus time.
If overloaded, name the single most important win.`;
}

export function buildBriefUserPrompt(payload: unknown): string {
  return `Board snapshot (authoritative; do not invent items):\n${JSON.stringify(payload, null, 2)}`;
}

/** Local clock context for prompts (server timezone unless overridden). */
export function getPromptClock(timezone?: string): CaptureContext {
  const tz =
    timezone ||
    process.env.AIEA_TIMEZONE?.trim() ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

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
