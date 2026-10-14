import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { intervalDaysFromFrequency, mapSchedule } from "@/lib/maintenance";
import { requireWorkspace } from "@/lib/require-workspace";
import { syncScheduleOpenTask } from "@/lib/schedule-tasks";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const schedule = await prisma.maintenanceSchedule.findFirst({
    where: { id, workspaceId: auth.workspaceId },
  });
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mapSchedule(schedule));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  let body: {
    name?: string;
    description?: string | null;
    frequency?: string | null;
    intervalDays?: number | null;
    isRecurring?: boolean;
    nextDueDate?: string | null;
    lastCompletedAt?: string | null;
    componentId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.maintenanceSchedule.findFirst({
    where: { id, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let nextDueDate: Date | undefined;
  if (body.nextDueDate !== undefined) {
    if (!body.nextDueDate) {
      return NextResponse.json({ error: "nextDueDate cannot be empty" }, { status: 400 });
    }
    nextDueDate = new Date(body.nextDueDate);
    if (Number.isNaN(nextDueDate.getTime())) {
      return NextResponse.json({ error: "nextDueDate is invalid" }, { status: 400 });
    }
  }

  let lastCompletedAt: Date | null | undefined;
  if (body.lastCompletedAt !== undefined) {
    if (!body.lastCompletedAt) lastCompletedAt = null;
    else {
      lastCompletedAt = new Date(body.lastCompletedAt);
      if (Number.isNaN(lastCompletedAt.getTime())) {
        return NextResponse.json({ error: "lastCompletedAt is invalid" }, { status: 400 });
      }
    }
  }

  const frequency =
    body.frequency !== undefined ? body.frequency?.trim() || null : undefined;
  let intervalDays: number | null | undefined;
  if (body.intervalDays !== undefined) {
    intervalDays =
      body.intervalDays != null && Number.isFinite(body.intervalDays)
        ? Math.trunc(body.intervalDays)
        : null;
  } else if (frequency !== undefined) {
    intervalDays = intervalDaysFromFrequency(frequency);
  }

  if (body.componentId) {
    const component = await prisma.component.findFirst({
      where: { id: body.componentId, workspaceId: auth.workspaceId },
    });
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }
  }

  const updated = await prisma.maintenanceSchedule.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description?.trim() || null } : {}),
      ...(frequency !== undefined ? { frequency } : {}),
      ...(intervalDays !== undefined ? { intervalDays } : {}),
      ...(body.isRecurring !== undefined ? { isRecurring: body.isRecurring } : {}),
      ...(nextDueDate !== undefined ? { nextDueDate } : {}),
      ...(lastCompletedAt !== undefined ? { lastCompletedAt } : {}),
      ...(body.componentId ? { componentId: body.componentId } : {}),
    },
  });

  if (updated.isRecurring) {
    await syncScheduleOpenTask(prisma, updated);
  }
  return NextResponse.json(mapSchedule(updated));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.maintenanceSchedule.findFirst({
    where: { id, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.$transaction([
    prisma.task.deleteMany({
      where: { scheduleId: id, workspaceId: auth.workspaceId },
    }),
    prisma.maintenanceSchedule.delete({ where: { id } }),
  ]);
  return new NextResponse(null, { status: 204 });
}
