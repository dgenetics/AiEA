import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { BOARD_LANES, laneWrite, resolveBoard } from "@/lib/board";
import { prisma } from "@/lib/db";
import { endOfDay, startOfDay } from "date-fns";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "today";

  const baseInclude = {
    area: true,
    person: true,
  } as const;

  if (view === "today") {
    const start = startOfDay(new Date());
    const end = endOfDay(new Date());
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        kind: { not: "RECURRING_TEMPLATE" },
        status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
        OR: [
          { dueAt: { lte: end } },
          { scheduledFor: { gte: start, lte: end } },
          { followUpDueAt: { lte: end } },
          // Current-lane undated — future-dated stay on Upcoming
          { board: "CURRENT", status: "ACTIVE", dueAt: null },
        ],
      },
      include: baseInclude,
      orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
    });
    return NextResponse.json({ tasks });
  }

  if (view === "upcoming") {
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        kind: { not: "RECURRING_TEMPLATE" },
        status: { in: ["ACTIVE", "INBOX"] },
      },
      include: baseInclude,
      orderBy: [{ dueAt: "asc" }, { priority: "asc" }],
      take: 100,
    });
    return NextResponse.json({ tasks });
  }

  if (view === "inbox") {
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        status: { in: ["INBOX", "PROPOSED"] },
      },
      include: baseInclude,
      orderBy: { createdAt: "desc" },
    });
    const captures = await prisma.captureBatch.findMany({
      where: {
        workspaceId,
        status: { in: ["PROPOSED", "PARTIALLY_ACCEPTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ tasks, captures });
  }

  if (view === "recurring") {
    const tasks = await prisma.task.findMany({
      where: { workspaceId, kind: "RECURRING_TEMPLATE", status: "ACTIVE" },
      include: baseInclude,
      orderBy: { nextOccurrenceAt: "asc" },
    });
    return NextResponse.json({ tasks });
  }

  if (view === "children") {
    const parentId = searchParams.get("parentId");
    if (!parentId) {
      return NextResponse.json({ error: "parentId required" }, { status: 400 });
    }
    const parent = await prisma.task.findFirst({
      where: { id: parentId, workspaceId },
    });
    if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        parentId,
        kind: "ONE_TIME",
        status: { not: "CANCELLED" },
      },
      include: baseInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ tasks, parent });
  }

  if (view === "archive") {
    const pageSize = Math.min(
      Math.max(Number(searchParams.get("limit") || 40), 1),
      100,
    );
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const kindFilter = searchParams.get("kind"); // one_time | occurrence | all

    const where = {
      workspaceId,
      status: "DONE" as const,
      kind:
        kindFilter === "one_time"
          ? { equals: "ONE_TIME" as const }
          : kindFilter === "occurrence"
            ? { equals: "OCCURRENCE" as const }
            : { not: "RECURRING_TEMPLATE" as const },
    };

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: baseInclude,
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        take: pageSize,
        skip: offset,
      }),
    ]);

    const nextOffset = offset + tasks.length;
    const hasMore = nextOffset < total;

    return NextResponse.json({
      tasks,
      total,
      hasMore,
      offset,
      nextOffset: hasMore ? nextOffset : null,
      pageSize,
    });
  }

  const tasks = await prisma.task.findMany({
    where: { workspaceId, status: { not: "CANCELLED" } },
    include: baseInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ tasks });
}

const createSchema = z.object({
  title: z.string().min(1).max(300),
  areaId: z.string().optional().nullable(),
  board: z.enum(BOARD_LANES).optional(),
  /** @deprecated Prefer board */
  priority: z.number().int().min(1).max(5).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  /** Parent task id — creates a subtask with its own due date */
  parentId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  const body = createSchema.parse(await req.json());

  let parent: {
    id: string;
    areaId: string | null;
    board: string | null;
    priority: number | null;
    personId: string | null;
  } | null = null;

  if (body.parentId) {
    parent = await prisma.task.findFirst({
      where: {
        id: body.parentId,
        workspaceId,
        kind: { not: "RECURRING_TEMPLATE" },
      },
      select: {
        id: true,
        areaId: true,
        board: true,
        priority: true,
        personId: true,
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
  }

  const lane = resolveBoard({
    board: body.board ?? parent?.board,
    priority: body.priority ?? parent?.priority ?? 3,
  });

  const task = await prisma.task.create({
    data: {
      workspaceId,
      parentId: parent?.id ?? null,
      title: body.title,
      areaId: body.areaId ?? parent?.areaId ?? null,
      ...laneWrite(lane),
      personId: parent?.personId ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notes: body.notes || null,
      kind: "ONE_TIME",
      status: "ACTIVE",
    },
    include: {
      area: true,
      person: true,
      parent: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ task });
}
