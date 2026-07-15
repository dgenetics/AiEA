import {
  fetchBfMaintenanceSuggestions,
  type BfSuggestion,
} from "@/lib/api/maintenance";
import { prisma } from "@/lib/db";
import { stringifyRecurrenceRule } from "@/lib/recurrence";
import type { RecurrenceRule } from "@/lib/types";

function recurrenceFromBf(s: BfSuggestion): RecurrenceRule | null {
  if (!s.isRecurring) return null;
  const days = s.intervalDays ?? null;
  const freq = (s.frequency ?? "").toLowerCase();

  if (freq === "7d" || days === 7) {
    return { frequency: "weekly", interval: 1 };
  }
  if (freq === "14d" || days === 14) {
    return { frequency: "weekly", interval: 2 };
  }
  if (freq === "30d" || days === 30) {
    return { frequency: "monthly", interval: 1 };
  }
  if (freq === "90d" || days === 90) {
    return { frequency: "monthly", interval: 3 };
  }
  if (freq === "6mo" || days === 182 || days === 180) {
    return { frequency: "monthly", interval: 6 };
  }
  if (freq === "1y" || freq === "12mo" || days === 365) {
    return { frequency: "monthly", interval: 12 };
  }
  if (days && days > 0) {
    if (days % 7 === 0) {
      return { frequency: "weekly", interval: days / 7 };
    }
    if (days % 30 === 0) {
      return { frequency: "monthly", interval: days / 30 };
    }
    return { frequency: "custom", interval: days };
  }
  return null;
}

function buildNotes(s: BfSuggestion): string {
  const meta = [
    "---",
    "source: bf-maintenance",
    `componentId: ${s.componentId}`,
    s.scheduleId ? `scheduleId: ${s.scheduleId}` : null,
    `taskId: ${s.taskId}`,
    s.frequency ? `frequency: ${s.frequency}` : null,
    s.intervalDays != null ? `intervalDays: ${s.intervalDays}` : null,
    s.isRecurring ? "isRecurring: true" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [s.description.trim(), meta].filter(Boolean).join("\n\n");
}

export async function ensureFarmArea(workspaceId: string) {
  let farmArea = await prisma.area.findFirst({
    where: { workspaceId, slug: "farm" },
  });
  if (!farmArea) {
    farmArea = await prisma.area.create({
      data: {
        workspaceId,
        name: "Farm",
        slug: "farm",
        color: "#2d4a3e",
        icon: "sprout",
        sortOrder: 50,
      },
    });
  }
  return farmArea;
}

export type ImportResult = {
  imported: { id: string; title: string; externalId: string; kind: string }[];
  skipped: { externalId: string; reason: string }[];
  importedCount: number;
  skippedCount: number;
};

/**
 * Import BF suggestions into a workspace as ACTIVE tasks (Farm area).
 * Idempotent via externalSource + externalId.
 * ACTIVE is the default so items appear on Today / Upcoming immediately.
 */
export async function importBfSuggestions(
  workspaceId: string,
  suggestions: BfSuggestion[],
  asStatus: "PROPOSED" | "ACTIVE" | "INBOX" = "ACTIVE",
): Promise<ImportResult> {
  const farmArea = await ensureFarmArea(workspaceId);
  const imported: ImportResult["imported"] = [];
  const skipped: ImportResult["skipped"] = [];

  for (const s of suggestions) {
    const existing = await prisma.task.findFirst({
      where: {
        workspaceId,
        externalSource: "bf-maintenance",
        externalId: s.externalId,
      },
    });
    if (existing) {
      skipped.push({
        externalId: s.externalId,
        reason: `Already imported (${existing.status})`,
      });
      continue;
    }

    const rule = recurrenceFromBf(s);
    const recurrenceRule = rule ? stringifyRecurrenceRule(rule) : null;

    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: s.title,
        notes: buildNotes(s),
        kind: "ONE_TIME",
        status: asStatus,
        priority: s.priority,
        dueAt: new Date(s.dueAt),
        areaId: farmArea.id,
        aiRationale: [
          `Suggested from Farm Maintenance: ${s.reason}`,
          s.scheduleName ? `Schedule: ${s.scheduleName}` : null,
          s.frequency ? `Cadence: ${s.frequency}` : null,
          `componentId=${s.componentId}`,
          s.scheduleId ? `scheduleId=${s.scheduleId}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        externalSource: "bf-maintenance",
        externalId: s.externalId,
        recurrenceRule,
      },
    });

    imported.push({
      id: task.id,
      title: task.title,
      externalId: s.externalId,
      kind: task.kind,
    });
  }

  return {
    imported,
    skipped,
    importedCount: imported.length,
    skippedCount: skipped.length,
  };
}

/** Pull from BF and import only new suggestions for a workspace. */
export async function autoPullWorkspace(
  workspaceId: string,
): Promise<ImportResult & { fetched: number }> {
  const payload = await fetchBfMaintenanceSuggestions();
  const result = await importBfSuggestions(
    workspaceId,
    payload.suggestions,
    "ACTIVE",
  );
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { bfLastAutoPullAt: new Date() },
  });
  return { ...result, fetched: payload.count };
}
