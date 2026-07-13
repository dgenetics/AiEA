import { addDays, formatISO, startOfDay } from "date-fns";
import { nanoid } from "nanoid";
import type { ProposedItem, RecurrenceRule } from "@/lib/types";
import { enrichRuleWithTimes } from "@/lib/recurrence";

/** Heuristic fallback when no API key or AI fails — keeps the product usable. */
export function heuristicPropose(rawText: string): ProposedItem[] {
  const lines = rawText
    .split(/\n|;|(?<=[.!?])\s+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((l) => l.length > 3);

  const items: ProposedItem[] = [];
  const today = startOfDay(new Date());

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

    let priority: 1 | 2 | 3 | 4 | 5 = 3;
    if (/urgent|asap|critical|today|immediately/i.test(lower)) priority = 1;
    else if (/soon|this week|important|deadline/i.test(lower)) priority = 2;
    else if (/someday|maybe|nice to have|low priority/i.test(lower)) priority = 5;

    let dueAt: string | null = null;
    if (/today/i.test(lower)) dueAt = formatISO(today);
    else if (/tomorrow/i.test(lower)) dueAt = formatISO(addDays(today, 1));
    else if (/this week/i.test(lower)) dueAt = formatISO(addDays(today, 3));
    else if (/end of (the )?month|eom/i.test(lower)) {
      const eom = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      dueAt = formatISO(eom);
    } else if (isFollowUp) {
      dueAt = formatISO(addDays(today, 2));
    } else if (!isRecurring) {
      dueAt = formatISO(addDays(today, priority <= 2 ? 2 : 7));
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
      // Multi-slot from "3 times a day" / explicit times
      recurrenceRule = enrichRuleWithTimes(recurrenceRule, line);
    }

    const cleanTitle = line.replace(/[.]+$/, "").trim();
    items.push({
      id: nanoid(10),
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      kind: isRecurring ? "RECURRING_TEMPLATE" : "ONE_TIME",
      areaSlug,
      priority,
      dueAt,
      scheduledFor: dueAt,
      estimateMinutes: isRecurring ? 15 : priority <= 2 ? 45 : 30,
      recurrenceRule,
      isFollowUp,
      personName,
      followUpDueAt: isFollowUp ? dueAt : null,
      aiRationale: isRecurring
        ? "Detected recurring language; scheduled as a repeating task."
        : isFollowUp
          ? "Detected a people follow-up; attached a response deadline."
          : `Classified as ${areaSlug}; priority ${priority} from urgency cues.`,
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
      priority: 3,
      dueAt: formatISO(addDays(today, 3)),
      estimateMinutes: 30,
      aiRationale: "Single capture item; default life / medium priority with a 3-day target.",
      accepted: false,
      dismissed: false,
    });
  }

  return items;
}
