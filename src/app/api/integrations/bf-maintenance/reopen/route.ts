import { NextResponse } from "next/server";
import { requireIntegrationAuth } from "@/lib/integration-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/integrations/bf-maintenance/reopen
 * Body: { bfTaskId: string }
 *
 * Called by BF when a linked chore is reopened there.
 * Sets the AiEA task ACTIVE — does NOT call BF again (loop prevention).
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

  const closed = tasks.filter((t) => t.status === "DONE");
  if (closed.length === 0) {
    return NextResponse.json({
      source: "aiea",
      alreadyOpen: true,
      updated: 0,
      taskIds: tasks.map((t) => t.id),
    });
  }

  const ids = closed.map((t) => t.id);
  await prisma.task.updateMany({
    where: { id: { in: ids } },
    data: { status: "ACTIVE", completedAt: null },
  });

  return NextResponse.json({
    source: "aiea",
    alreadyOpen: false,
    updated: ids.length,
    taskIds: ids,
  });
}
