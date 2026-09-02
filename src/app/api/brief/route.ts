import { NextResponse } from "next/server";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { generateDailyBrief } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";
import { addDays, startOfDay } from "date-fns";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  await materializeDueOccurrences(workspaceId);

  const horizon = addDays(startOfDay(new Date()), 7);
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      kind: { not: "RECURRING_TEMPLATE" },
      status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
      OR: [
        { dueAt: { lte: horizon } },
        { scheduledFor: { lte: horizon } },
        { followUpDueAt: { lte: horizon } },
        { board: "CURRENT" },
      ],
    },
    include: { person: true },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
    take: 50,
  });

  const brief = await generateDailyBrief({
    userName: user.name,
    workspaceId,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      board: t.board,
      priority: t.priority,
      dueAt: t.dueAt,
      isFollowUp: t.isFollowUp,
      kind: t.kind,
      personName: t.person?.name,
      status: t.status,
    })),
  });

  return NextResponse.json({ brief });
}
