import { nanoid } from "nanoid";
import type { ProposedItem } from "@/lib/types";
import type { BoardLane } from "@/lib/board";
import { priorityFromBoard } from "@/lib/board";
import {
  APP_TIMEZONE,
  localNoonPlusDays,
  toStoredDueDate,
  zonedParts,
} from "@/lib/calendar";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const ACTION_START =
  /^(call|fix|buy|order|renew|think|email|text|schedule|check|clean|mow|replace|change|test|rotate|pick|get|make|write|send|pay|book|ask|review|install|repair|paint|wash|feed|water|plant|move|build|look|find|set|update|cancel|return|drop|take|go|visit|meet|talk|discuss|plan|research|consider|decide|start|finish|do|add|remove|inspect|service|swap|remind|put|take|walk|drive|haul|trim|prune|seed|harvest|winterize|shut|turn|fill|drain|grease|sharpen|stack|split|store|cover|uncover)\b/i;

const TIMING =
  /\b(today|tonight|tomorrow|someday|maybe|asap|urgent|now|soon|this week|next week)\b/i;

function cleanChunk(raw: string): string {
  return raw
    .replace(/\b(um+|uh+|er+)\b/gi, " ")
    .replace(/^\s*(remind me to|please|hey|ok so|okay so)\s+/i, "")
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSeparateAction(right: string): boolean {
  const t = right.trim();
  if (!t) return false;
  if (ACTION_START.test(t)) return true;
  if (TIMING.test(t) && ACTION_START.test(t.replace(TIMING, "").trim())) return true;
  if (/^(someday|maybe|later|then)\b/i.test(t) && t.split(/\s+/).length > 1) {
    return true;
  }
  return false;
}

/** Split "and" only when both sides are actions ("call vet and fix the fence"). */
function splitAnd(chunk: string): string[] {
  const parts = chunk.split(/\s+\band\b\s+|\s+&\s+/i);
  if (parts.length < 2) return [chunk];
  const out: string[] = [];
  let buf = parts[0] ?? "";
  for (let i = 1; i < parts.length; i++) {
    const right = parts[i] ?? "";
    if (looksLikeSeparateAction(right)) {
      if (buf.trim()) out.push(buf.trim());
      buf = right;
    } else {
      buf = `${buf} and ${right}`;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export function splitCaptureActions(rawText: string): string[] {
  const chunks = rawText
    .split(/\n+|;|,/)
    .map((c) => cleanChunk(c))
    .filter((c) => c.length > 1);
  const actions: string[] = [];
  for (const chunk of chunks) {
    for (const part of splitAnd(chunk)) {
      const cleaned = cleanChunk(part);
      if (cleaned.length > 1) actions.push(cleaned);
    }
  }
  return actions;
}

function nextWeekday(name: string, from = new Date()): Date | null {
  const target = WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
  if (target < 0) return null;
  const parts = zonedParts(from, APP_TIMEZONE);
  const today = new Date(parts.year, parts.month - 1, parts.day, 12, 0, 0, 0);
  const current = today.getDay();
  let delta = (target - current + 7) % 7;
  if (delta === 0) delta = 0;
  today.setDate(today.getDate() + delta);
  return today;
}

function dueFromText(text: string): { dueAt: string | null; days: number | null } {
  const lower = text.toLowerCase();
  if (/\b(today|tonight)\b/.test(lower)) {
    return { dueAt: toStoredDueDate(localNoonPlusDays(0)), days: 0 };
  }
  if (/\btomorrow\b/.test(lower)) {
    return { dueAt: toStoredDueDate(localNoonPlusDays(1)), days: 1 };
  }
  for (const day of WEEKDAYS) {
    if (new RegExp(`\\b${day}\\b`).test(lower)) {
      const date = nextWeekday(day);
      if (!date) break;
      const days = Math.round(
        (date.getTime() - localNoonPlusDays(0).getTime()) / (1000 * 60 * 60 * 24),
      );
      return { dueAt: toStoredDueDate(date), days };
    }
  }
  if (/\bnext week\b/.test(lower)) {
    return { dueAt: toStoredDueDate(localNoonPlusDays(7)), days: 7 };
  }
  if (/\bthis week\b/.test(lower)) {
    return { dueAt: toStoredDueDate(localNoonPlusDays(3)), days: 3 };
  }
  return { dueAt: null, days: null };
}

export function laneForCaptureText(
  text: string,
  dueDays: number | null,
): { board: BoardLane; boardReason: string } {
  const lower = text.toLowerCase();
  if (/\b(today|tonight|urgent|now|asap|immediately)\b/.test(lower)) {
    const word = lower.match(/\b(today|tonight|urgent|now|asap|immediately)\b/)?.[1];
    return { board: "CURRENT", boardReason: `said '${word}'` };
  }
  if (dueDays != null && dueDays <= 2) {
    return { board: "CURRENT", boardReason: "due within 2 days" };
  }
  if (
    /\b(someday|maybe|idea)\b/.test(lower) ||
    /\bthink about\b/.test(lower)
  ) {
    const word = lower.match(/\b(someday|maybe|idea)\b/)?.[1] ?? "think about";
    return { board: "ICEBOX", boardReason: `said '${word}'` };
  }
  if (/\b(this week|next week|soon)\b/.test(lower) || /\bafter\b/.test(lower)) {
    const word =
      lower.match(/\b(this week|next week|soon)\b/)?.[1] ?? "after";
    return { board: "BACKLOG", boardReason: `said '${word}'` };
  }
  if (dueDays != null && dueDays <= 14) {
    return { board: "BACKLOG", boardReason: "due within 2 weeks" };
  }
  if (dueDays != null) {
    return { board: "BACKLOG", boardReason: "has a date" };
  }
  return { board: "ICEBOX", boardReason: "no timing given" };
}

function titleFrom(text: string): string {
  const clean = text.replace(/[.]+$/, "").trim().slice(0, 300);
  if (!clean) return "Untitled";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** Local parser used when no API key is set or the model output is invalid. */
export function heuristicPropose(rawText: string, _fullCapture?: string): ProposedItem[] {
  const actions = splitCaptureActions(rawText);
  const items: ProposedItem[] = actions.slice(0, 20).map((line) => {
    const { dueAt, days } = dueFromText(line);
    const { board, boardReason } = laneForCaptureText(line, days);
    return {
      id: nanoid(10),
      title: titleFrom(line),
      kind: "ONE_TIME" as const,
      board,
      boardReason,
      priority: priorityFromBoard(board) as 1 | 2 | 3 | 4 | 5,
      dueAt,
      aiRationale: boardReason,
    };
  });

  if (items.length === 0 && rawText.trim()) {
    const raw = rawText.trim();
    const title = titleFrom(raw.slice(0, 300));
    const notes = raw.length > 300 ? raw.slice(300) : undefined;
    return [
      {
        id: nanoid(10),
        title,
        notes,
        kind: "ONE_TIME",
        board: "ICEBOX",
        boardReason: "saved the raw text",
        priority: 5,
        dueAt: null,
        aiRationale: "saved the raw text",
      },
    ];
  }

  return items;
}

/** One ACTIVE task from the untouched capture text (outage / empty parse). */
export function rawTextItem(rawText: string): ProposedItem {
  const raw = rawText.trim();
  const title = titleFrom(raw.slice(0, 300));
  return {
    id: nanoid(10),
    title: title || "Untitled",
    notes: raw.length > 300 ? raw : undefined,
    kind: "ONE_TIME",
    board: "ICEBOX",
    boardReason: "saved the raw text",
    priority: 5,
    dueAt: null,
    aiRationale: "saved the raw text",
  };
}
