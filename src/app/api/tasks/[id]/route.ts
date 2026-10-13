import { NextResponse } from "next/server";
import { z } from "zod";
import { correctionsForCaptureEdit, recordCorrections } from "@/lib/ai/corrections";
import { BOARD_LANES, laneWrite, resolveBoard } from "@/lib/board";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/require-workspace";
import { completeTaskAndMaybeAdvance } from "@/lib/schedule-tasks";

const patchSchema = z.object({
  action: z.enum(["complete", "reopen", "snooze", "update", "cancel"]).optional(),
  title: z.string().min(1).max(300).optional(),
  board: z.enum(BOARD_LANES).optional(),
  priority: z.number().int().min(1).max(5).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  estimateMinutes: z.number().int().min(1).max(480).optional().nullable(),
  snoozeDays: z.number().int().min(1).max(30).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspace();
    if ("error" in auth) return auth.error;
    const { workspaceId } = auth;

    const { id } = await params;
    const task = await prisma.task.findFirst({ where: { id, workspaceId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(await req.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: err.issues[0]?.message ?? "Invalid input" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const action = body.action || "update";

    if (action === "complete") {
      const result = await completeTaskAndMaybeAdvance(prisma, workspaceId, id);
      if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ task: result.task, next: result.next });
    }

    if (action === "reopen") {
      if (task.scheduleId) {
        const other = await prisma.task.findFirst({
          where: {
            scheduleId: task.scheduleId,
            id: { not: task.id },
            status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
          },
        });
        if (other) {
          return NextResponse.json(
            { error: "This schedule already has an open task." },
            { status: 409 },
          );
        }
      }
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "ACTIVE", completedAt: null },
      });
      return NextResponse.json({ task: updated });
    }

    if (action === "cancel") {
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ task: updated });
    }

    if (action === "snooze") {
      const days = body.snoozeDays ?? 1;
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "SNOOZED", snoozedUntil: until, dueAt: until },
      });
      return NextResponse.json({ task: updated });
    }

    const prevBoard = resolveBoard({ board: task.board, priority: task.priority });
    const nextBoard =
      body.board !== undefined || body.priority !== undefined
        ? resolveBoard({
            board: body.board ?? task.board,
            priority: body.priority !== undefined ? body.priority : task.priority,
          })
        : null;

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(nextBoard ? laneWrite(nextBoard) : {}),
        ...(body.dueAt !== undefined
          ? { dueAt: body.dueAt ? new Date(body.dueAt) : null }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.estimateMinutes !== undefined
          ? { estimateMinutes: body.estimateMinutes }
          : {}),
      },
    });

    const edits = correctionsForCaptureEdit({
      sourceCaptureId: task.sourceCaptureId,
      createdAt: task.createdAt,
      prevTitle: task.title,
      nextTitle: body.title,
      prevBoard,
      nextBoard,
    });
    if (edits.length) {
      try {
        await recordCorrections(workspaceId, edits);
      } catch (trainErr) {
        console.error("AI training log failed (task still saved):", trainErr);
      }
    }

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error("PATCH /api/tasks/[id] failed:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireWorkspace();
    if ("error" in auth) return auth.error;
    const { workspaceId } = auth;

    const { id } = await params;
    const task = await prisma.task.findFirst({ where: { id, workspaceId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const children = await prisma.task.findMany({
      where: { parentId: id, workspaceId },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length) {
      await prisma.task.deleteMany({ where: { id: { in: childIds } } });
    }
    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ ok: true, deletedChildren: childIds.length });
  } catch (err) {
    console.error("DELETE /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
