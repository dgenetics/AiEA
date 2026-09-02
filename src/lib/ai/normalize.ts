import { nanoid } from "nanoid";
import type { ProposedItem, ProposedSubtask, RecurrenceRule } from "@/lib/types";
import type { AiProposedItem } from "@/lib/ai/schemas";
import { priorityFromBoard, resolveBoard } from "@/lib/board";
import { enrichRuleWithTimes } from "@/lib/recurrence";
import { attachSubtasksIfMissing } from "@/lib/subtasks-parse";
import { toStoredDueDate } from "@/lib/calendar";

function clampPriority(n: number | undefined): 1 | 2 | 3 | 4 | 5 {
  if (!n || n < 1) return 3;
  if (n > 5) return 5;
  return n as 1 | 2 | 3 | 4 | 5;
}

function cleanTitle(title: string): string {
  return title
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function parseDate(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
  }
  try {
    return toStoredDueDate(value);
  } catch {
    return null;
  }
}

function normalizeRecurrence(
  rule: AiProposedItem["recurrenceRule"],
  kind: string,
  title: string,
  notes?: string | null,
): RecurrenceRule | null {
  if (kind !== "RECURRING_TEMPLATE") return null;
  let base: RecurrenceRule = rule
    ? {
        frequency: rule.frequency,
        interval: rule.interval || 1,
        byWeekday: rule.byWeekday?.length ? rule.byWeekday : undefined,
        time: rule.time || "09:00",
        times: rule.times?.length ? rule.times : undefined,
      }
    : { frequency: "weekly", interval: 1, time: "09:00" };

  base = enrichRuleWithTimes(base, notes, title);
  return base;
}

function normalizeSubtasks(
  raw: AiProposedItem["subtasks"],
  parentDue: string | null,
  title: string,
  notes: string | undefined,
  rawCapture?: string,
): ProposedSubtask[] {
  const fromAi = (raw ?? [])
    .map((s) => ({
      title: cleanTitle(s.title || ""),
      dueAt: parseDate(s.dueAt) ?? parentDue,
      notes: s.notes?.trim() || undefined,
    }))
    .filter((s) => s.title.length > 1);

  const merged = attachSubtasksIfMissing(title, notes, fromAi, rawCapture);
  return merged
    .map((s) => ({
      title: cleanTitle(s.title),
      dueAt: s.dueAt ? parseDate(s.dueAt) ?? parentDue : parentDue,
      notes: "notes" in s ? (s as ProposedSubtask).notes : undefined,
    }))
    .filter((s) => s.title.length > 1);
}

/** Map validated AI items → app ProposedItem with ids and safe defaults. */
export function normalizeProposals(
  raw: AiProposedItem[],
  rawCapture?: string,
): ProposedItem[] {
  const out: ProposedItem[] = [];

  for (const p of raw) {
    let title = cleanTitle(p.title || "");
    if (!title) continue;

    const kind = p.kind === "RECURRING_TEMPLATE" ? "RECURRING_TEMPLATE" : "ONE_TIME";
    const rawArea = String(p.areaSlug || "life");
    const areaSlug = rawArea === "work" ? "work" : "life";
    const board = resolveBoard({
      board: (p as { board?: string }).board,
      priority: p.priority != null ? clampPriority(p.priority) : null,
    });
    const priority = priorityFromBoard(board) as 1 | 2 | 3 | 4 | 5;
    const isFollowUp = Boolean(p.isFollowUp);
    let dueAt = parseDate(p.dueAt);
    const scheduledFor = parseDate(p.scheduledFor) ?? dueAt;
    const followUpDueAt = isFollowUp
      ? parseDate(p.followUpDueAt) ?? dueAt
      : null;
    const personName =
      isFollowUp && p.personName?.trim() ? p.personName.trim().slice(0, 120) : null;

    // If title is basically a subtask dump, improve parent title
    const notes = p.notes?.trim() || undefined;
    if (/^subtasks?\b/i.test(title) && rawCapture) {
      title = "Work on listed subtasks";
    }

    // Subtasks apply to one-time parents and recurring templates
    // (parts hang off the first occurrence when accepted)
    const subtasks = normalizeSubtasks(
      p.subtasks,
      dueAt,
      title,
      notes,
      rawCapture,
    );

    // If we only got parts from a subtask list, parent may share due
    if (subtasks.length >= 2 && !dueAt && subtasks[0]?.dueAt) {
      dueAt = subtasks[0].dueAt ?? null;
    }

    // Prefer a short parent title when rooms/parts are in parentheses or notes
    let displayTitle = title;
    let displayNotes = notes;
    if (subtasks.length >= 2) {
      const paren = title.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (paren && paren[1].trim().length > 2) {
        displayTitle = cleanTitle(paren[1]);
        const roomNote = subtasks.map((s) => s.title).join(", ");
        displayNotes = notes
          ? `${notes}\nRooms: ${roomNote}`
          : `Rooms: ${roomNote}`;
      } else if (!displayNotes) {
        displayNotes = `Parts: ${subtasks.map((s) => s.title).join(", ")}`;
      }
    }

    out.push({
      id: nanoid(10),
      title: displayTitle,
      notes: displayNotes,
      kind,
      areaSlug,
      board,
      priority,
      dueAt: kind === "RECURRING_TEMPLATE" ? null : dueAt,
      scheduledFor: kind === "RECURRING_TEMPLATE" ? null : scheduledFor ?? dueAt,
      estimateMinutes: p.estimateMinutes ?? (kind === "RECURRING_TEMPLATE" ? 15 : 30),
      recurrenceRule: normalizeRecurrence(p.recurrenceRule, kind, title, p.notes),
      isFollowUp,
      personName,
      followUpDueAt,
      subtasks: subtasks.length ? subtasks : undefined,
      aiRationale: (
        p.aiRationale ||
        (subtasks.length
          ? `Parent with ${subtasks.length} parts`
          : "AI classification")
      ).slice(0, 500),
      accepted: false,
      dismissed: false,
    });
  }

  // If AI returned nothing useful but raw capture is pure subtask list, synthesize parent
  if (out.length === 0 && rawCapture) {
    const parts = attachSubtasksIfMissing("", rawCapture, [], rawCapture);
    if (parts.length >= 2) {
      const dueAt = parts[0]?.dueAt ?? null;
      out.push({
        id: nanoid(10),
        title: "Work on listed subtasks",
        notes: rawCapture.trim().slice(0, 500),
        kind: "ONE_TIME",
        areaSlug: "life",
        board: "CURRENT",
        priority: 1,
        dueAt,
        scheduledFor: dueAt,
        estimateMinutes: 30,
        subtasks: parts,
        aiRationale: `Parsed ${parts.length} subtasks from capture`,
        accepted: false,
        dismissed: false,
      });
    }
  }

  // If AI flattened subtasks into multiple top-level items but capture was one list, leave as-is;
  // attachSubtasksIfMissing on each item handles "Subtasks:" in notes.

  return out;
}
