import { NextResponse } from "next/server";
import { z } from "zod";
import { BOARD_LANES, BOARD_STATUSES, laneWrite, resolveBoard } from "@/lib/board";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/require-workspace";

const taskInclude = {
  schedule: { select: { id: true, name: true, frequency: true, intervalDays: true } },
  component: {
    select: {
      id: true,
      name: true,
      system: { select: { id: true, name: true } },
    },
  },
  parent: { select: { id: true, title: true } },
} as const;

export async function GET(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { workspaceId } = auth;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") || "board";

  if (view === "board" || view === "today" || view === "upcoming") {
    const tasks = await prisma.task.findMany({
      where: {
        workspaceId,
        kind: "ONE_TIME",
        status: { in: [...BOARD_STATUSES] },
      },
      include: taskInclude,
      orderBy: [{ createdAt: "asc" }],
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
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ tasks, parent });
  }

  if (view === "archive") {
    const pageSize = Math.min(Math.max(Number(searchParams.get("limit") || 40), 1), 100);
    const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
    const where = {
      workspaceId,
      status: "DONE" as const,
      kind: "ONE_TIME" as const,
    };
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: taskInclude,
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
    where: { workspaceId, kind: "ONE_TIME", status: { not: "CANCELLED" } },
    include: taskInclude,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ tasks });
}

const createSchema = z.object({
  title: z.string().min(1).max(300),
  board: z.enum(BOARD_LANES).optional(),
  priority: z.number().int().min(1).max(5).optional().nullable(),
  dueAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export async function POST(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { workspaceId } = auth;

  const body = createSchema.parse(await req.json());

  let parent: { id: string; board: string | null; priority: number | null } | null = null;
  if (body.parentId) {
    parent = await prisma.task.findFirst({
      where: { id: body.parentId, workspaceId, kind: "ONE_TIME" },
      select: { id: true, board: true, priority: true },
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
      ...laneWrite(lane),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notes: body.notes || null,
      kind: "ONE_TIME",
      status: "ACTIVE",
    },
    include: taskInclude,
  });
  return NextResponse.json({ task });
}
