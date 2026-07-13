import { nanoid } from "nanoid";
import type { ProposedItem, RecurrenceRule } from "@/lib/types";
import type { AiProposedItem } from "@/lib/ai/schemas";

const AREA = new Set(["work", "home", "life"]);

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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeRecurrence(
  rule: AiProposedItem["recurrenceRule"],
  kind: string,
): RecurrenceRule | null {
  if (kind !== "RECURRING_TEMPLATE") return null;
  if (!rule) {
    return { frequency: "weekly", interval: 1, time: "09:00" };
  }
  return {
    frequency: rule.frequency,
    interval: rule.interval || 1,
    byWeekday: rule.byWeekday?.length ? rule.byWeekday : undefined,
    time: rule.time || "09:00",
  };
}

/** Map validated AI items → app ProposedItem with ids and safe defaults. */
export function normalizeProposals(raw: AiProposedItem[]): ProposedItem[] {
  const out: ProposedItem[] = [];

  for (const p of raw) {
    const title = cleanTitle(p.title || "");
    if (!title) continue;

    const kind = p.kind === "RECURRING_TEMPLATE" ? "RECURRING_TEMPLATE" : "ONE_TIME";
    const areaSlug = AREA.has(p.areaSlug) ? p.areaSlug : "life";
    const priority = clampPriority(p.priority);
    const isFollowUp = Boolean(p.isFollowUp);
    const dueAt = parseDate(p.dueAt);
    const scheduledFor = parseDate(p.scheduledFor) ?? dueAt;
    const followUpDueAt = isFollowUp
      ? parseDate(p.followUpDueAt) ?? dueAt
      : null;
    const personName =
      isFollowUp && p.personName?.trim() ? p.personName.trim().slice(0, 120) : null;

    out.push({
      id: nanoid(10),
      title,
      notes: p.notes?.trim() || undefined,
      kind,
      areaSlug,
      priority,
      dueAt: kind === "RECURRING_TEMPLATE" ? null : dueAt,
      scheduledFor: kind === "RECURRING_TEMPLATE" ? null : scheduledFor,
      estimateMinutes: p.estimateMinutes ?? (kind === "RECURRING_TEMPLATE" ? 15 : 30),
      recurrenceRule: normalizeRecurrence(p.recurrenceRule, kind),
      isFollowUp,
      personName,
      followUpDueAt,
      aiRationale: (p.aiRationale || "AI classification").slice(0, 500),
      accepted: false,
      dismissed: false,
    });
  }

  return out;
}
