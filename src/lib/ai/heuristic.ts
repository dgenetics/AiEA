import { nanoid } from "nanoid";
import type { ProposedItem, RecurrenceRule } from "@/lib/types";
import type { BoardLane } from "@/lib/board";
import { priorityFromBoard } from "@/lib/board";
import { enrichRuleWithTimes } from "@/lib/recurrence";
import { parseSubtaskLines } from "@/lib/subtasks-parse";
import { localNoonPlusDays, localNoonToday, toStoredDueDate } from "@/lib/calendar";

/** Heuristic fallback when no API key or AI fails — keeps the product usable. */
export function heuristicPropose(
  rawText: string,
  _fullCapture?: string,
): ProposedItem[] {
  const full = rawText.trim();
  const dueDays = (n: number) => toStoredDueDate(localNoonPlusDays(n));

  // Prefer treating "Subtasks: 1. … 2. …" as one parent + parts
  if (/subtasks?|parts?|steps?\s*:/i.test(full)) {
    const parts = parseSubtaskLines(full);
    if (parts.length >= 2) {
      const dueAt =
        parts[0]?.dueAt ||
        (/\btoday\b/i.test(full)
          ? dueDays(0)
          : /\btomorrow\b/i.test(full)
            ? dueDays(1)
            : dueDays(3));
      const board: BoardLane = /\btoday\b|urgent/i.test(full)
        ? "CURRENT"
        : "BACKLOG";
      return [
        {
          id: nanoid(10),
          title: "Work on listed subtasks",
          notes: full.slice(0, 500),
          kind: "ONE_TIME",
          areaSlug: /work|client|event|business/i.test(full) ? "work" : "life",
          board,
          priority: priorityFromBoard(board) as 1 | 2 | 3 | 4 | 5,
          dueAt,
          scheduledFor: dueAt,
          estimateMinutes: 45,
          subtasks: parts.map((p) => ({
            title: p.title,
            dueAt: p.dueAt ?? dueAt,
          })),
          aiRationale: `Parsed ${parts.length} subtasks from capture list`,
          accepted: false,
          dismissed: false,
        },
      ];
    }
  }

  const lines = rawText
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 3);

  const items: ProposedItem[] = [];

  for (const line of lines.slice(0, 20)) {
    const lower = line.toLowerCase();
    let areaSlug: string = "life";
    if (
      /work|meeting|deck|slide|client|boss|standup|pr\b|deploy|invoice|q[1-4]|coworker|colleague|office|slack|jira/i.test(
        lower,
      )
    ) {
      areaSlug = "work";
    }

    const isRecurring =
      /every\s+(day|week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.test(
        lower,
      ) ||
      /daily|weekly|monthly|each week|each day/i.test(lower) ||
      /\d+\s*(?:x|times?)\s*(?:a\s*)?day/i.test(lower) ||
      /times?\s*daily|twice a day|thrice/i.test(lower);

    const isFollowUp =
      /follow\s*up|ping|respond to|get back to|call back|check in with|reply to/i.test(
        lower,
      );

    let personName: string | null = null;
    const personMatch =
      line.match(/(?:with|to|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/) ||
      line.match(/(?:with|to|for)\s+([A-Z][a-z]+)/);
    if (personMatch) personName = personMatch[1];
    const nameMatch = line.match(/\b([A-Z][a-z]{2,})\b/);
    if (
      isFollowUp &&
      !personName &&
      nameMatch &&
      !["Call", "Email", "Follow", "Ping"].includes(nameMatch[1])
    ) {
      personName = nameMatch[1];
    }

    let board: BoardLane = "BACKLOG";
    if (/urgent|asap|critical|today|immediately/i.test(lower)) board = "CURRENT";
    else if (/someday|maybe|nice to have|park|icebox|low priority/i.test(lower)) {
      board = "ICEBOX";
    }

    let dueAt: string | null = null;
    if (/today/i.test(lower)) dueAt = dueDays(0);
    else if (/tomorrow/i.test(lower)) dueAt = dueDays(1);
    else if (/this week/i.test(lower)) dueAt = dueDays(3);
    else if (/end of (the )?month|eom/i.test(lower)) {
      const n = localNoonToday();
      const eom = new Date(n.getFullYear(), n.getMonth() + 1, 0, 12, 0, 0, 0);
      dueAt = toStoredDueDate(eom);
    } else if (isFollowUp) {
      dueAt = dueDays(2);
    } else if (!isRecurring) {
      dueAt = dueDays(board === "CURRENT" ? 2 : board === "ICEBOX" ? 14 : 7);
    }

    let recurrenceRule: RecurrenceRule | null = null;
    if (isRecurring) {
      if (/daily|every day|each day|times?\s*a\s*day|times?\s*daily/i.test(lower)) {
        recurrenceRule = { frequency: "daily", interval: 1, time: "09:00" };
      } else if (/monthly|every month/i.test(lower)) {
        recurrenceRule = { frequency: "monthly", interval: 1, time: "09:00" };
      } else {
        const dayMap: Record<string, number> = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };
        let byWeekday: number[] | undefined;
        for (const [name, n] of Object.entries(dayMap)) {
          if (lower.includes(name)) byWeekday = [n];
        }
        recurrenceRule = {
          frequency: "weekly",
          interval: 1,
          byWeekday,
          time: "09:00",
        };
      }
      recurrenceRule = enrichRuleWithTimes(recurrenceRule, line);
    }

    const cleanTitle = line.replace(/[.]+$/, "").trim();
    const priority = priorityFromBoard(board) as 1 | 2 | 3 | 4 | 5;
    items.push({
      id: nanoid(10),
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      kind: isRecurring ? "RECURRING_TEMPLATE" : "ONE_TIME",
      areaSlug,
      board,
      priority,
      dueAt,
      scheduledFor: dueAt,
      estimateMinutes: isRecurring ? 15 : board === "CURRENT" ? 45 : 30,
      recurrenceRule,
      isFollowUp,
      personName,
      followUpDueAt: isFollowUp ? dueAt : null,
      aiRationale: isRecurring
        ? "Detected recurring language; scheduled as a repeating task."
        : isFollowUp
          ? "Detected a people follow-up; attached a response deadline."
          : `Classified as ${areaSlug}; lane ${board} from urgency cues.`,
      accepted: false,
      dismissed: false,
    });
  }

  if (items.length === 0 && rawText.trim()) {
    items.push({
      id: nanoid(10),
      title: rawText.trim().slice(0, 120),
      kind: "ONE_TIME",
      areaSlug: "life",
      board: "BACKLOG",
      priority: 3,
      dueAt: dueDays(3),
      estimateMinutes: 30,
      aiRationale: "Single capture item; default life / Backlog with a 3-day target.",
      accepted: false,
      dismissed: false,
    });
  }

  return items;
}
