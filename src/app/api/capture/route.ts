import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { proposeFromCapture } from "@/lib/ai";
import {
  formatCorrectionsForPrompt,
  getRecentCorrections,
  recordCorrections,
} from "@/lib/ai/corrections";
import { prisma } from "@/lib/db";
import { acceptProposals } from "@/lib/workspace";
import type { ProposedItem } from "@/lib/types";

const proposeSchema = z.object({
  text: z.string().min(1).max(8000),
});

const proposalSubtaskSchema = z.object({
  title: z.string(),
  dueAt: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const proposalEditSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  areaSlug: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  dueAt: z.string().nullable().optional(),
  kind: z.enum(["ONE_TIME", "RECURRING_TEMPLATE", "OCCURRENCE"]).optional(),
  isFollowUp: z.boolean().optional(),
  personName: z.string().nullable().optional(),
  notes: z.string().optional().nullable(),
  estimateMinutes: z.number().optional().nullable(),
  aiRationale: z.string().optional(),
  recurrenceRule: z.any().optional().nullable(),
  scheduledFor: z.string().nullable().optional(),
  followUpDueAt: z.string().nullable().optional(),
  subtasks: z.array(proposalSubtaskSchema).optional(),
  accepted: z.boolean().optional(),
  dismissed: z.boolean().optional(),
});

const acceptSchema = z.object({
  captureId: z.string(),
  selectedIds: z.array(z.string()),
  /** Optional edited proposals (user fixed categories etc. before accept) */
  items: z.array(proposalEditSchema).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const json = await req.json();
  const action = (json.action as string) || "propose";

  if (action === "propose") {
    const body = proposeSchema.parse(json);
    const training = formatCorrectionsForPrompt(
      await getRecentCorrections(workspaceId, 40),
    );
    const result = await proposeFromCapture(body.text, {
      userName: user.name,
      workspaceId,
      trainingBlock: training || undefined,
    });

    const capture = await prisma.captureBatch.create({
      data: {
        workspaceId,
        userId: user.id,
        rawText: body.text,
        status: "PROPOSED",
        proposals: JSON.stringify(result.items),
      },
    });

    return NextResponse.json({
      captureId: capture.id,
      items: result.items,
      source: result.source,
      model: result.model ?? null,
      fallbackReason: result.fallbackReason ?? null,
      trainingExamplesUsed: training ? true : false,
    });
  }

  if (action === "accept") {
    const body = acceptSchema.parse(json);
    const capture = await prisma.captureBatch.findFirst({
      where: { id: body.captureId, workspaceId },
    });
    if (!capture) return NextResponse.json({ error: "Capture not found" }, { status: 404 });

    const original = JSON.parse(capture.proposals) as ProposedItem[];
    const byId = new Map(original.map((p) => [p.id, p]));

    // Merge user edits onto stored proposals (full pre-accept edit surface)
    let proposals: ProposedItem[] = original;
    if (body.items?.length) {
      const editedById = new Map(body.items.map((i) => [i.id, i]));
      proposals = original.map((p) => {
        const e = editedById.get(p.id);
        if (!e) return p;
        const kind = (e.kind as ProposedItem["kind"]) ?? p.kind;
        return {
          ...p,
          title: e.title?.trim() || p.title,
          areaSlug: e.areaSlug ?? p.areaSlug,
          priority: (e.priority as ProposedItem["priority"]) ?? p.priority,
          dueAt: e.dueAt !== undefined ? e.dueAt : p.dueAt,
          scheduledFor:
            e.scheduledFor !== undefined
              ? e.scheduledFor
              : e.dueAt !== undefined
                ? e.dueAt
                : p.scheduledFor,
          kind,
          isFollowUp: e.isFollowUp ?? p.isFollowUp,
          personName: e.personName !== undefined ? e.personName : p.personName,
          notes:
            e.notes !== undefined
              ? e.notes?.trim() || undefined
              : p.notes,
          estimateMinutes:
            e.estimateMinutes !== undefined ? e.estimateMinutes : p.estimateMinutes,
          followUpDueAt:
            e.followUpDueAt !== undefined ? e.followUpDueAt : p.followUpDueAt,
          recurrenceRule:
            e.recurrenceRule !== undefined
              ? e.recurrenceRule
              : kind === "RECURRING_TEMPLATE"
                ? p.recurrenceRule
                : null,
          subtasks:
            e.subtasks !== undefined
              ? e.subtasks
                  .map((s) => ({
                    title: s.title.trim(),
                    dueAt: s.dueAt ?? null,
                    notes: s.notes,
                  }))
                  .filter((s) => s.title.length > 0)
              : p.subtasks,
        };
      });

      // Train AI: log field changes vs original proposal
      const corrections: Array<{
        field: string;
        taskTitle: string;
        beforeValue?: string | null;
        afterValue: string;
      }> = [];
      for (const p of proposals) {
        if (!body.selectedIds.includes(p.id)) continue;
        const o = byId.get(p.id);
        if (!o) continue;
        if (p.areaSlug && o.areaSlug && p.areaSlug !== o.areaSlug) {
          corrections.push({
            field: "area",
            taskTitle: p.title,
            beforeValue: o.areaSlug,
            afterValue: p.areaSlug,
          });
        }
        if (p.priority != null && o.priority != null && p.priority !== o.priority) {
          corrections.push({
            field: "priority",
            taskTitle: p.title,
            beforeValue: String(o.priority),
            afterValue: String(p.priority),
          });
        }
        if (Boolean(p.isFollowUp) !== Boolean(o.isFollowUp)) {
          corrections.push({
            field: "isFollowUp",
            taskTitle: p.title,
            beforeValue: String(Boolean(o.isFollowUp)),
            afterValue: String(Boolean(p.isFollowUp)),
          });
        }
        if (p.kind !== o.kind) {
          corrections.push({
            field: "kind",
            taskTitle: p.title,
            beforeValue: o.kind,
            afterValue: p.kind,
          });
        }
      }
      await recordCorrections(workspaceId, corrections);
    }

    const taskIds = await acceptProposals(
      workspaceId,
      capture.id,
      proposals,
      body.selectedIds,
    );

    return NextResponse.json({ ok: true, taskIds, count: taskIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
