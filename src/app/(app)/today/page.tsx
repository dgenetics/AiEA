import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";
import { TaskList } from "@/components/task-list";
import { TodayLaneFilters } from "@/components/today-lane-filters";
import { toTaskRow } from "@/lib/tasks-display";
import { addDays, endOfDay } from "date-fns";
import Link from "next/link";
import {
  matchesCurrentDefault,
  matchesLaneFilter,
  parseTodayLane,
  taskBoard,
  todayWindow,
  type TodayLaneFilter,
} from "@/lib/today-filters";
import { CheckSquare, Sparkles } from "lucide-react";

type SearchParams = { lane?: string | string[] };

export default async function TodayPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const rawParams = searchParams ? await Promise.resolve(searchParams) : {};
  const lane = parseTodayLane(rawParams.lane);

  await materializeDueOccurrences(workspaceId);

  const window = todayWindow();
  const { start, end } = window;
  // Broader candidate set for All / Backlog / Icebox chips (legacy due-soon window).
  const dueSoonEnd = endOfDay(addDays(new Date(), 14));

  const matching = await prisma.task.findMany({
    where: {
      workspaceId,
      kind: { in: ["ONE_TIME", "OCCURRENCE"] },
      status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
      OR: [
        { dueAt: { lte: dueSoonEnd } },
        { scheduledFor: { gte: start, lte: end } },
        { followUpDueAt: { lte: end } },
        // Undated Current — reachable via All / Current chip when not on default due scope
        {
          board: "CURRENT",
          status: "ACTIVE",
          dueAt: null,
        },
      ],
    },
    include: {
      area: true,
      person: true,
      parent: { select: { id: true, title: true, kind: true } },
    },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
  });

  // Chip counts: Current = tight default; other lanes = firehose ∩ lane
  const currentDefaultSet = matching.filter((t) =>
    matchesCurrentDefault(t, window),
  );
  const counts: Record<TodayLaneFilter, number> = {
    all: matching.length,
    current: currentDefaultSet.length,
    backlog: matching.filter((t) => taskBoard(t) === "BACKLOG").length,
    icebox: matching.filter((t) => taskBoard(t) === "ICEBOX").length,
  };

  // Visible set for the active chip
  const visible =
    lane === "current"
      ? currentDefaultSet
      : matching.filter((t) => matchesLaneFilter(t, lane));

  const hiddenCount = Math.max(0, matching.length - visible.length);

  // Recurring day-instances (parent is RECURRING_TEMPLATE) — always top-level cards
  const occurrences = visible.filter((t) => t.kind === "OCCURRENCE");

  // Real one-time tasks (not subtasks)
  const topOneTime = visible.filter(
    (t) => t.kind === "ONE_TIME" && !t.parentId,
  );

  // Subtasks matching today (parent is another ONE_TIME task, not a template)
  const subtasksDue = visible.filter(
    (t) =>
      t.kind === "ONE_TIME" &&
      Boolean(t.parentId) &&
      t.parent?.kind !== "RECURRING_TEMPLATE",
  );

  // Ensure parent cards exist for due subtasks
  const parentIdsNeeded = [
    ...new Set(subtasksDue.map((t) => t.parentId as string)),
  ];
  const missingParentIds = parentIdsNeeded.filter(
    (id) => !topOneTime.some((t) => t.id === id),
  );
  const extraParents =
    missingParentIds.length > 0
      ? await prisma.task.findMany({
          where: {
            workspaceId,
            id: { in: missingParentIds },
            kind: "ONE_TIME",
            status: { not: "CANCELLED" },
          },
          include: {
            area: true,
            person: true,
            parent: { select: { id: true, title: true, kind: true } },
          },
        })
      : [];

  const oneTimeParents = [...topOneTime, ...extraParents];
  const parentIds = oneTimeParents.map((t) => t.id);

  // All parts under those parents (for nesting)
  const children =
    parentIds.length > 0
      ? await prisma.task.findMany({
          where: {
            workspaceId,
            parentId: { in: parentIds },
            kind: "ONE_TIME",
            status: { not: "CANCELLED" },
          },
          include: { area: true, person: true },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        })
      : [];

  const childrenByParent = new Map<string, typeof children>();
  for (const c of children) {
    if (!c.parentId) continue;
    const list = childrenByParent.get(c.parentId) ?? [];
    list.push(c);
    childrenByParent.set(c.parentId, list);
  }

  const oneTimeRows = oneTimeParents.map((t) =>
    toTaskRow({
      ...t,
      children: childrenByParent.get(t.id) ?? [],
    }),
  );

  // Subtasks whose parent didn't load (edge case)
  const orphanSubtaskRows = subtasksDue
    .filter((t) => !parentIds.includes(t.parentId as string))
    .map((t) => toTaskRow(t));

  // Nest parts under today's recurring occurrences when present
  const occurrenceIds = occurrences.map((t) => t.id);
  const occurrenceChildren =
    occurrenceIds.length > 0
      ? await prisma.task.findMany({
          where: {
            workspaceId,
            parentId: { in: occurrenceIds },
            kind: "ONE_TIME",
            status: { not: "CANCELLED" },
          },
          include: { area: true, person: true },
          orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        })
      : [];
  const childrenByOccurrence = new Map<string, typeof occurrenceChildren>();
  for (const c of occurrenceChildren) {
    if (!c.parentId) continue;
    const list = childrenByOccurrence.get(c.parentId) ?? [];
    list.push(c);
    childrenByOccurrence.set(c.parentId, list);
  }
  const recurringRows = occurrences.map((t) =>
    toTaskRow({
      ...t,
      children: childrenByOccurrence.get(t.id) ?? [],
    }),
  );

  const followUps = visible.filter((t) => t.isFollowUp);
  const overdueInPlay = currentDefaultSet.filter((t) => {
    if (!t.dueAt) return false;
    const d = t.dueAt instanceof Date ? t.dueAt : new Date(t.dueAt);
    return d < start;
  }).length;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const oneTimeDisplay = [...oneTimeRows, ...orphanSubtaskRows];
  const listCount = oneTimeDisplay.length + recurringRows.length;

  const inboxCount = await prisma.task.count({
    where: {
      workspaceId,
      status: { in: ["PROPOSED", "INBOX"] },
      kind: { in: ["ONE_TIME", "OCCURRENCE"] },
    },
  });

  const emptyMessage =
    lane === "current"
      ? "Nothing in play today"
      : "Nothing in this lane for the due window.";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
            Today
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white md:text-2xl">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-xs text-zinc-500 md:text-sm">
            {listCount} task{listCount === 1 ? "" : "s"}
            {" · "}
            {followUps.length} follow-up{followUps.length === 1 ? "" : "s"}
            {inboxCount > 0 ? ` · ${inboxCount} in inbox` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          {inboxCount > 0 && (
            <Link
              href="/inbox"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-amber-500/15 sm:text-sm"
            >
              Inbox · {inboxCount}
            </Link>
          )}
          <Link
            href="/capture"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20"
          >
            <Sparkles className="h-4 w-4" />
            Capture
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          {
            label: "In play",
            value: counts.current,
          },
          { label: "Follow-ups", value: followUps.length },
          {
            label: "Overdue",
            value: overdueInPlay,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/5 bg-zinc-900/40 px-2.5 py-2.5 md:px-4 md:py-3"
          >
            <p className="text-[10px] uppercase tracking-wide text-zinc-500 md:text-[11px]">
              {s.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold text-white md:mt-1 md:text-2xl">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <TodayLaneFilters
        active={lane}
        counts={counts}
        hiddenCount={hiddenCount}
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-indigo-300" />
          <h2 className="text-sm font-semibold text-white">Tasks</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {listCount}
          </span>
        </div>
        {listCount === 0 && lane === "current" ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-200">
              Nothing in play today
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Current + due today / overdue is empty. Parked work stays in
              Backlog or Icebox.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/today?lane=backlog"
                className="inline-flex items-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-500/15"
              >
                Backlog
                {counts.backlog > 0 ? ` · ${counts.backlog}` : ""}
              </Link>
              <Link
                href="/capture"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-xs font-medium text-white"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Capture
              </Link>
            </div>
          </div>
        ) : (
          <TaskList
            initialTasks={[...oneTimeDisplay, ...recurringRows]}
            emptyMessage={emptyMessage}
          />
        )}
      </section>
    </div>
  );
}

