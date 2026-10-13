import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { intervalDaysFromFrequency, mapSchedule } from "@/lib/maintenance";
import { requireWorkspace } from "@/lib/require-workspace";
import { materializeScheduleTask } from "@/lib/schedule-tasks";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { searchParams } = new URL(req.url);
  const componentId = searchParams.get("componentId")?.trim() || undefined;
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(componentId ? { componentId } : {}),
    },
    orderBy: { nextDueDate: "asc" },
  });
  return NextResponse.json(schedules.map(mapSchedule));
}

export async function POST(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;

  let body: {
    componentId?: string;
    name?: string;
    description?: string | null;
    frequency?: string | null;
    intervalDays?: number | null;
    isRecurring?: boolean;
    nextDueDate?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const componentId = body.componentId?.trim();
  const name = body.name?.trim();
  if (!componentId) {
    return NextResponse.json({ error: "componentId is required" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!body.nextDueDate) {
    return NextResponse.json({ error: "nextDueDate is required" }, { status: 400 });
  }
  const nextDueDate = new Date(body.nextDueDate);
  if (Number.isNaN(nextDueDate.getTime())) {
    return NextResponse.json({ error: "nextDueDate is invalid" }, { status: 400 });
  }

  const component = await prisma.component.findFirst({
    where: { id: componentId, workspaceId: auth.workspaceId },
  });
  if (!component) {
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  const frequency = body.frequency?.trim() || null;
  const intervalDays =
    body.intervalDays != null && Number.isFinite(body.intervalDays)
      ? Math.trunc(body.intervalDays)
      : intervalDaysFromFrequency(frequency);

  const created = await prisma.maintenanceSchedule.create({
    data: {
      workspaceId: auth.workspaceId,
      componentId,
      name,
      description: body.description?.trim() || null,
      frequency,
      intervalDays,
      isRecurring: body.isRecurring ?? true,
      nextDueDate,
    },
  });
  await materializeScheduleTask(prisma, created);
  return NextResponse.json(mapSchedule(created), { status: 201 });
}
