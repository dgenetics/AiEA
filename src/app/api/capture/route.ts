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

const proposalEditSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  areaSlug: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  dueAt: z.string().nullable().optional(),
  kind: z.enum(["ONE_TIME", "RECURRING_TEMPLATE", "OCCURRENCE"]).optional(),
  isFollowUp: z.boolean().optional(),
  personName: z.string().nullable().optional(),
  notes: z.string().optional(),
  estimateMinutes: z.number().optional().nullable(),
  aiRationale: z.string().optional(),
  recurrenceRule: z.any().optional().nullable(),
  scheduledFor: z.string().nullable().optional(),
  followUpDueAt: z.string().nullable().optional(),
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

    // Merge user edits onto stored proposals
    let proposals: ProposedItem[] = original;
    if (body.items?.length) {
      const editedById = new Map(body.items.map((i) => [i.id, i]));
      proposals = original.map((p) => {
        const e = editedById.get(p.id);
        if (!e) return p;
        return {
          ...p,
          title: e.title ?? p.title,
          areaSlug: e.areaSlug ?? p.areaSlug,
          priority: (e.priority as ProposedItem["priority"]) ?? p.priority,
          dueAt: e.dueAt !== undefined ? e.dueAt : p.dueAt,
          kind: (e.kind as ProposedItem["kind"]) ?? p.kind,
          isFollowUp: e.isFollowUp ?? p.isFollowUp,
          personName: e.personName !== undefined ? e.personName : p.personName,
          notes: e.notes ?? p.notes,
          estimateMinutes:
            e.estimateMinutes !== undefined ? e.estimateMinutes : p.estimateMinutes,
        };
      });

      // Train AI: log area/priority changes vs original proposal
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
