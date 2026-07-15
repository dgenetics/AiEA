import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import {
  bfSuggestionSchema,
  type BfSuggestion,
} from "@/lib/api/maintenance";
import { prisma } from "@/lib/db";
import { stringifyRecurrenceRule } from "@/lib/recurrence";
import type { RecurrenceRule } from "@/lib/types";

const importSchema = z.object({
  suggestions: z.array(bfSuggestionSchema).min(1).max(100),
  /** PROPOSED = inbox review; ACTIVE = immediately on board */
  asStatus: z.enum(["PROPOSED", "ACTIVE", "INBOX"]).default("PROPOSED"),
});

/**
 * Map BF Maintenance schedule cadence → AiEA recurrence rule.
 * BF remains authoritative for *when* work is due; this rule is stored so
 * promoted templates can expand later if the user activates them.
 */
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

/** Structured provenance block for notes / future auto-sync. */
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

/**
 * POST /api/integrations/bf-maintenance/import
 * Body: { suggestions: BfSuggestion[], asStatus?: "PROPOSED" | "ACTIVE" | "INBOX" }
 *
 * Imports BF open maintenance tasks as AiEA tasks (idempotent via externalId).
 * Recurring schedules become RECURRING_TEMPLATE when a rule can be mapped;
 * otherwise ONE_TIME. Status defaults to PROPOSED for review in Inbox.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  let body: z.infer<typeof importSchema>;
  try {
    body = importSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  // Ensure Farm area exists for organization
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

  const imported: {
    id: string;
    title: string;
    externalId: string;
    kind: string;
  }[] = [];
  const skipped: { externalId: string; reason: string }[] = [];

  for (const s of body.suggestions) {
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
    // Instance tasks stay ONE_TIME so BF remains the due-date authority.
    // When recurring, still store recurrenceRule for context / later expand.
    // Only use RECURRING_TEMPLATE if user imports as ACTIVE and wants AiEA
    // ownership — default PROPOSED keeps kind ONE_TIME for pull-based workflow.
    const kind = "ONE_TIME";
    const recurrenceRule = rule ? stringifyRecurrenceRule(rule) : null;

    const task = await prisma.task.create({
      data: {
        workspaceId,
        title: s.title,
        notes: buildNotes(s),
        kind,
        status: body.asStatus,
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

  return NextResponse.json({
    imported,
    skipped,
    importedCount: imported.length,
    skippedCount: skipped.length,
  });
}
