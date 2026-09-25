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
  buildBoard,
  laneFromParam,
  laneToParam,
  type BoardCard,
  type BoardLane,
} from "@/lib/board";
import type { TaskRowData } from "@/components/task-row";
import { cn } from "@/lib/utils";

/**
 * The Tasks board: every non-done task, in its lane. Open subtasks nest inside
 * their parent's card (parent's lane); orphaned ones are their own card.
 * Desktop (md+): three side-by-side columns. Mobile: one-lane tabs via ?lane=.
 * No due-date windows, no auto-curation — due dates are shown, never used to
 * pick or move cards. Done tasks live in /archive.
 */
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

  // Placement is buildBoard's; here we only render. "Part of · parent" stays
  // on orphaned subtask cards only; nested subtasks are inside their parent.
  const toRow = (
    c: BoardCard<(typeof tasks)[number]>,
    nested: boolean,
  ): TaskRowData => ({
    ...toTaskRow(c.task),
    ...(nested ? { parentTitle: null } : {}),
    children: c.subtasks.map((s) => toRow(s, true)).sort(byDue),
  });
  const columns = new Map<BoardLane, TaskRowData[]>(
    [...buildBoard(tasks)].map(([lane, cards]) => [
      lane,
      cards.map((c) => toRow(c, false)).sort(byDue),
    ]),
  );

  const laneHref = (lane: BoardLane) =>
    lane === "CURRENT" ? "/tasks" : `/tasks?lane=${laneToParam(lane)}`;

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

      {/* Mobile: one lane at a time via tabs (?lane=). Hidden from md up. */}
      <div data-board-layout="tabs" className="space-y-3 md:hidden">
        <nav
          data-board-tabs
          role="tablist"
          aria-label="Board lanes"
          className="flex gap-1 rounded-xl border border-white/10 bg-zinc-950/50 p-1"
        >
          {BOARD_COLUMNS.map((lane) => {
            const active = lane === selected;
            const count = columns.get(lane)!.length;
            return (
              <Link
                key={lane}
                href={laneHref(lane)}
                role="tab"
                data-lane-tab={lane}
                aria-selected={active}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition",
                  active
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300",
                )}
              >
                {BOARD_META[lane].label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    active
                      ? "bg-white/10 text-zinc-300"
                      : "bg-white/5 text-zinc-600",
                  )}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </nav>
        <section
          data-lane={selected}
          role="tabpanel"
          aria-label={BOARD_META[selected].label}
          className="min-w-0 space-y-3"
        >
          <p className="text-[11px] text-zinc-600">{BOARD_META[selected].hint}</p>
          <TaskList
            initialTasks={columns.get(selected)!}
            emptyMessage="Nothing here."
            allowSnooze={false}
          />
        </section>
      </div>

      {/* Desktop: three side-by-side columns. Hidden below md. */}
      <div
        data-board-layout="columns"
        className="hidden gap-4 md:grid md:grid-cols-3"
      >
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
