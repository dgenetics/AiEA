import Link from "next/link";
import { Archive } from "lucide-react";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";
import { BoardMobileTabs } from "@/components/board-mobile-tabs";
import { TasksRefresh } from "@/components/tasks-refresh";
import { toTaskRow } from "@/lib/tasks-display";
import {
  BOARD_COLUMNS,
  BOARD_META,
  BOARD_STATUSES,
  buildBoard,
  laneFromParam,
  type BoardCard,
  type BoardLane,
} from "@/lib/board";
import type { TaskRowData } from "@/components/task-row";

export default async function TasksBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const sp = await searchParams;
  const raw = Array.isArray(sp.lane) ? sp.lane[0] : sp.lane;
  const selected = laneFromParam(raw);

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      kind: "ONE_TIME",
      status: { in: [...BOARD_STATUSES] },
    },
    include: {
      schedule: { select: { frequency: true, intervalDays: true } },
      component: { select: { name: true, system: { select: { name: true } } } },
      parent: { select: { id: true, title: true } },
      children: {
        where: { kind: "ONE_TIME", status: { not: "CANCELLED" } },
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const byDue = (a: TaskRowData, b: TaskRowData) => {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return ad - bd;
  };

  const toRow = (c: BoardCard<(typeof tasks)[number]>, nested: boolean): TaskRowData => ({
    ...toTaskRow(c.task),
    ...(nested ? { parentTitle: null } : {}),
    children: c.subtasks.map((s) => toRow(s, true)).sort(byDue),
  });
  const columns = Object.fromEntries(
    [...buildBoard(tasks)].map(([lane, cards]) => [
      lane,
      cards.map((c) => toRow(c, false)).sort(byDue),
    ]),
  ) as Record<BoardLane, TaskRowData[]>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">Tasks</h1>
        <Link
          href="/tasks/done"
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-forest-800 hover:text-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:text-forest-950 active:opacity-80"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archive
        </Link>
      </div>

      <TasksRefresh />

      <BoardMobileTabs columns={columns} initialLane={selected} />

      <div data-board-layout="columns" className="hidden gap-4 md:grid md:grid-cols-3">
        {BOARD_COLUMNS.map((lane) => {
          const list = columns[lane];
          return (
            <section key={lane} data-lane={lane} className="min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-ink">{BOARD_META[lane].label}</h2>
                <span className="rounded-full border border-cream-200 bg-cream-50 px-2 py-0.5 text-[11px] text-stone-600">
                  {list.length}
                </span>
                <span className="text-[11px] text-muted">{BOARD_META[lane].hint}</span>
              </div>
              <TaskList initialTasks={list} emptyMessage="Nothing here." allowSnooze={false} />
            </section>
          );
        })}
      </div>

      <div className="pt-2 text-center md:hidden">
        <Link
          href="/tasks/done"
          className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-xs font-medium text-forest-800 hover:text-forest-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-700 active:text-forest-950 active:opacity-80"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archive
        </Link>
      </div>
    </div>
  );
}
