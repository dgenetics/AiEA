import { NextResponse } from "next/server";
import { requireIntegrationAuth } from "@/lib/integration-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/integrations/bf-maintenance/complete
 * Body: { bfTaskId: string }
 *
 * Called by BF after a linked chore is completed there.
 * Marks the AiEA task DONE by externalId only — does NOT call syncBfComplete
 * (loop prevention).
 */
export async function POST(req: Request) {
  const denied = requireIntegrationAuth(req);
  if (denied) return denied;

  let body: { bfTaskId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const bfTaskId = body.bfTaskId?.trim();
  if (!bfTaskId) {
    return NextResponse.json({ error: "bfTaskId is required" }, { status: 400 });
  }

  const externalId = `bf-task:${bfTaskId}`;
  const tasks = await prisma.task.findMany({
    where: {
      externalSource: "bf-maintenance",
      externalId,
    },
  });

  if (tasks.length === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const open = tasks.filter((t) => t.status !== "DONE" && t.status !== "CANCELLED");
  if (open.length === 0) {
    return NextResponse.json({
      source: "aiea",
      alreadyComplete: true,
      updated: 0,
      taskIds: tasks.map((t) => t.id),
    });
  }

  const now = new Date();
  const ids = open.map((t) => t.id);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { status: "DONE", completedAt: now },
  });
  await prisma.reminder.updateMany({
    where: { taskId: { in: ids }, status: "PENDING" },
    data: { status: "DISMISSED" },
  });

  return NextResponse.json({
    source: "aiea",
    alreadyComplete: false,
    updated: ids.length,
    taskIds: ids,
  });
}
