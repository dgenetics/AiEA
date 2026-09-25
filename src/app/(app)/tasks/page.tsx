import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";
import { toTaskRow } from "@/lib/tasks-display";
import {
  BOARD_COLUMNS,
  BOARD_META,
  BOARD_STATUSES,
  laneOf,
  type BoardLane,
} from "@/lib/board";
import type { TaskRowData } from "@/components/task-row";

/**
 * The Tasks board: every non-done task, one card each, in its lane.
 * No due-date windows, no auto-curation — due dates are shown, never used to
 * pick or move cards. Done tasks live in /archive.
 */
export default async function TasksBoardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      // Repeating chores arrive from BF Maintenance as ONE_TIME rows; legacy
      // native RECURRING_TEMPLATE / OCCURRENCE rows are not rendered (#7).
      kind: "ONE_TIME",
      status: { in: [...BOARD_STATUSES] },
    },
    include: {
      area: true,
      person: true,
      parent: { select: { id: true, title: true } },
      children: {
        where: { kind: "ONE_TIME", status: { not: "CANCELLED" } },
        select: { id: true, title: true, status: true },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  // Undated last; otherwise soonest due first. Order only — never the lane.
  const byDue = (a: TaskRowData, b: TaskRowData) => {
    const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return ad - bd;
  };

  const columns = new Map<BoardLane, TaskRowData[]>(
    BOARD_COLUMNS.map((lane) => [lane, []]),
  );
  for (const t of tasks) {
    // Each task is its own card (subtasks show "Part of · parent"); keep the
    // parts badge on parents but don't nest, so no task renders twice.
    const row = { ...toTaskRow(t), children: [] };
    columns.get(laneOf(t))!.push(row);
  }
  for (const list of columns.values()) list.sort(byDue);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            Tasks
          </h1>
          <p className="mt-1 text-xs text-zinc-500 md:text-sm">
            {tasks.length} open task{tasks.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/capture"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20"
        >
          <Sparkles className="h-4 w-4" />
          Capture
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {BOARD_COLUMNS.map((lane) => {
          const list = columns.get(lane)!;
          return (
            <section key={lane} data-lane={lane} className="min-w-0 space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white">
                  {BOARD_META[lane].label}
                </h2>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
                  {list.length}
                </span>
                <span className="text-[11px] text-zinc-600">
                  {BOARD_META[lane].hint}
                </span>
              </div>
              <TaskList
                initialTasks={list}
                emptyMessage="Nothing here."
                allowSnooze={false}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
