import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { recordCorrections } from "@/lib/ai/corrections";
import { prisma } from "@/lib/db";
import {
  advanceFrom,
  checkInsProgress,
  parseCheckIns,
  parseRecurrenceRule,
  slotDateTime,
  stringifyCheckIns,
} from "@/lib/recurrence";

const patchSchema = z.object({
  action: z
    .enum(["complete", "reopen", "snooze", "update", "cancel", "checkIn", "uncheckIn"])
    .optional(),
  title: z.string().min(1).max(300).optional(),
  priority: z.number().int().min(1).max(5).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  areaId: z.string().optional().nullable(),
  isFollowUp: z.boolean().optional(),
  estimateMinutes: z.number().int().min(1).max(480).optional().nullable(),
  snoozeDays: z.number().int().min(1).max(30).optional(),
  /** Index into multi-slot checkIns.slots */
  slotIndex: z.number().int().min(0).max(23).optional(),
  /** When true, log field changes as AI training corrections */
  trainAi: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

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

    if (action === "checkIn" || action === "uncheckIn") {
      const state = parseCheckIns(task.checkIns);
      if (!state?.slots?.length) {
        return NextResponse.json(
          { error: "This task has no multi-slot check-ins" },
          { status: 400 },
        );
      }
      const idx = body.slotIndex ?? 0;
      if (idx < 0 || idx >= state.slots.length) {
        return NextResponse.json({ error: "Invalid slotIndex" }, { status: 400 });
      }

      const now = new Date();
      state.slots[idx] = {
        ...state.slots[idx],
        done: action === "checkIn",
        completedAt: action === "checkIn" ? now.toISOString() : null,
      };

      const progress = checkInsProgress(state);
      const nextSlot = state.slots.find((s) => !s.done);
      const dueAt = nextSlot
        ? slotDateTime(state.day, nextSlot.time)
        : now;

      if (progress.allDone) {
        const updated = await prisma.task.update({
          where: { id },
          data: {
            checkIns: stringifyCheckIns(state),
            status: "DONE",
            completedAt: now,
            dueAt,
          },
          include: { area: true, person: true },
        });

        await prisma.reminder.updateMany({
          where: { taskId: id, status: "PENDING" },
          data: { status: "DISMISSED" },
        });

        if (task.parentId) {
          const parent = await prisma.task.findUnique({
            where: { id: task.parentId },
          });
          if (parent?.kind === "RECURRING_TEMPLATE") {
            const rule = parseRecurrenceRule(parent.recurrenceRule);
            if (rule) {
              await prisma.task.update({
                where: { id: parent.id },
                data: { nextOccurrenceAt: advanceFrom(rule, now) },
              });
            }
          }
        }

        return NextResponse.json({ task: updated, allDone: true });
      }

      const updated = await prisma.task.update({
        where: { id },
        data: {
          checkIns: stringifyCheckIns(state),
          status: "ACTIVE",
          completedAt: null,
          dueAt,
          scheduledFor: dueAt,
        },
        include: { area: true, person: true },
      });
      return NextResponse.json({ task: updated, allDone: false });
    }

    if (action === "complete") {
      // Multi-slot: complete only marks all remaining slots if forced, else first incomplete
      const multi = parseCheckIns(task.checkIns);
      if (multi?.slots?.length && multi.slots.some((s) => !s.done)) {
        const incomplete = multi.slots.findIndex((s) => !s.done);
        body.action = "checkIn";
        body.slotIndex = incomplete;
        // re-enter as checkIn by recursive logic inline:
        multi.slots[incomplete] = {
          ...multi.slots[incomplete],
          done: true,
          completedAt: new Date().toISOString(),
        };
        const progress = checkInsProgress(multi);
        if (!progress.allDone) {
          const nextSlot = multi.slots.find((s) => !s.done)!;
          const dueAt = slotDateTime(multi.day, nextSlot.time);
          const updated = await prisma.task.update({
            where: { id },
            data: {
              checkIns: stringifyCheckIns(multi),
              dueAt,
              scheduledFor: dueAt,
            },
            include: { area: true, person: true },
          });
          return NextResponse.json({ task: updated, allDone: false });
        }
        // all done — fall through to full complete with updated checkIns
        await prisma.task.update({
          where: { id },
          data: { checkIns: stringifyCheckIns(multi) },
        });
      }

      const updated = await prisma.task.update({
        where: { id },
        data: { status: "DONE", completedAt: new Date() },
        include: { area: true, person: true },
      });

      await prisma.reminder.updateMany({
        where: { taskId: id, status: "PENDING" },
        data: { status: "DISMISSED" },
      });

      if (task.personId) {
        await prisma.person.update({
          where: { id: task.personId },
          data: { lastContactAt: new Date() },
        });
      }

      if (task.parentId) {
        const parent = await prisma.task.findUnique({ where: { id: task.parentId } });
        if (parent?.kind === "RECURRING_TEMPLATE") {
          const rule = parseRecurrenceRule(parent.recurrenceRule);
          if (rule) {
            const next = advanceFrom(rule, new Date());
            await prisma.task.update({
              where: { id: parent.id },
              data: { nextOccurrenceAt: next },
            });
          }
        }
      }

      return NextResponse.json({ task: updated });
    }

    if (action === "reopen") {
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "ACTIVE", completedAt: null },
        include: { area: true, person: true },
      });
      return NextResponse.json({ task: updated });
    }

    if (action === "cancel") {
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { area: true, person: true },
      });
      return NextResponse.json({ task: updated });
    }

    if (action === "snooze") {
      const days = body.snoozeDays ?? 1;
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: "SNOOZED",
          snoozedUntil: until,
          dueAt: until,
        },
        include: { area: true, person: true },
      });
      return NextResponse.json({ task: updated });
    }

    // --- update (title / area / priority / etc.) ---
    let nextAreaSlug: string | null = null;
    if (body.areaId !== undefined && body.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: body.areaId, workspaceId },
      });
      if (!area) {
        return NextResponse.json({ error: "Invalid area" }, { status: 400 });
      }
      nextAreaSlug = area.slug;
    }

    const prevArea = task.areaId
      ? await prisma.area.findUnique({ where: { id: task.areaId } })
      : null;

    // Save task first — never block on AI training
    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.priority !== undefined ? { priority: body.priority } : {}),
        ...(body.dueAt !== undefined
          ? { dueAt: body.dueAt ? new Date(body.dueAt) : null }
          : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.areaId !== undefined ? { areaId: body.areaId } : {}),
        ...(body.isFollowUp !== undefined ? { isFollowUp: body.isFollowUp } : {}),
        ...(body.estimateMinutes !== undefined
          ? { estimateMinutes: body.estimateMinutes }
          : {}),
      },
      include: { area: true, person: true },
    });

    // Best-effort training log (must not fail the save)
    const trainAi = body.trainAi !== false;
    if (trainAi) {
      try {
        const corrections: Array<{
          field: string;
          taskTitle: string;
          beforeValue?: string | null;
          afterValue: string;
        }> = [];

        if (body.areaId !== undefined && body.areaId !== task.areaId) {
          corrections.push({
            field: "area",
            taskTitle: (body.title ?? task.title).slice(0, 300),
            beforeValue: prevArea?.slug ?? null,
            afterValue: nextAreaSlug ?? "life",
          });
        }
        if (body.priority !== undefined && body.priority !== task.priority) {
          corrections.push({
            field: "priority",
            taskTitle: (body.title ?? task.title).slice(0, 300),
            beforeValue: task.priority != null ? String(task.priority) : null,
            afterValue: body.priority != null ? String(body.priority) : "3",
          });
        }
        if (body.isFollowUp !== undefined && body.isFollowUp !== task.isFollowUp) {
          corrections.push({
            field: "isFollowUp",
            taskTitle: (body.title ?? task.title).slice(0, 300),
            beforeValue: String(task.isFollowUp),
            afterValue: String(body.isFollowUp),
          });
        }

        if (corrections.length > 0) {
          await recordCorrections(workspaceId, corrections);
        }
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const workspaceId = await getPrimaryWorkspaceId(user.id);
    if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

    const { id } = await params;
    const task = await prisma.task.findFirst({ where: { id, workspaceId } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Cascade: delete subtasks / occurrences under this task, then the task itself
    // (parent relation is SetNull, so children would otherwise be orphaned)
    const children = await prisma.task.findMany({
      where: { parentId: id, workspaceId },
      select: { id: true },
    });
    const childIds = children.map((c) => c.id);
    if (childIds.length) {
      await prisma.reminder.deleteMany({ where: { taskId: { in: childIds } } });
      await prisma.task.deleteMany({ where: { id: { in: childIds } } });
    }
    await prisma.reminder.deleteMany({ where: { taskId: id } });
    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ ok: true, deletedChildren: childIds.length });
  } catch (err) {
    console.error("DELETE /api/tasks/[id] failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
