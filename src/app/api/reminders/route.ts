import { NextResponse } from "next/server";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  await materializeDueOccurrences(workspaceId);

  const now = new Date();
  // Fire any due reminders into SENT so they show in the bell
  await prisma.reminder.updateMany({
    where: {
      workspaceId,
      status: "PENDING",
      fireAt: { lte: now },
    },
    data: { status: "SENT", sentAt: now },
  });

  const reminders = await prisma.reminder.findMany({
    where: {
      workspaceId,
      status: { in: ["SENT", "PENDING"] },
      fireAt: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    },
    include: {
      task: { include: { area: true, person: true } },
      person: true,
    },
    orderBy: { fireAt: "asc" },
    take: 50,
  });

  return NextResponse.json({ reminders });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { id, action } = (await req.json()) as { id: string; action: "dismiss" | "snooze" };
  const reminder = await prisma.reminder.findFirst({ where: { id, workspaceId } });
  if (!reminder) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "dismiss") {
    await prisma.reminder.update({
      where: { id },
      data: { status: "DISMISSED" },
    });
  } else if (action === "snooze") {
    await prisma.reminder.update({
      where: { id },
      data: {
        status: "PENDING",
        fireAt: new Date(Date.now() + 60 * 60 * 1000),
        sentAt: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
