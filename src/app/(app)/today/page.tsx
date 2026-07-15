import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";
import { TaskList } from "@/components/task-list";
import { toTaskRow } from "@/lib/tasks-display";
import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { CheckSquare, Repeat, Sparkles } from "lucide-react";
import { FarmMaintenancePullButton } from "@/components/farm-maintenance-pull";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  await materializeDueOccurrences(workspaceId);

  const start = startOfDay(new Date());
  const end = endOfDay(new Date());

  const matching = await prisma.task.findMany({
    where: {
      workspaceId,
      // Never list templates themselves — only occurrences + one-time tasks
      kind: { in: ["ONE_TIME", "OCCURRENCE"] },
      status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
      OR: [
        // Due today or overdue
        { dueAt: { lte: end } },
        // Explicitly scheduled for today
        { scheduledFor: { gte: start, lte: end } },
        // Follow-up due today or overdue
        { followUpDueAt: { lte: end } },
        // High priority only when there's no future due date
        // (P1/P2 with due tomorrow+ stay on Upcoming until that day)
        {
          priority: { lte: 2 },
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

  // Recurring day-instances (parent is RECURRING_TEMPLATE) — always top-level cards
  const occurrences = matching.filter((t) => t.kind === "OCCURRENCE");

  // Real one-time tasks (not subtasks)
  const topOneTime = matching.filter(
    (t) => t.kind === "ONE_TIME" && !t.parentId,
  );

  // Subtasks matching today (parent is another ONE_TIME task, not a template)
  const subtasksDue = matching.filter(
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

  const followUps = matching.filter((t) => t.isFollowUp);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const oneTimeDisplay = [...oneTimeRows, ...orphanSubtaskRows];

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
            {oneTimeDisplay.length} one-time · {recurringRows.length} recurring ·{" "}
            {followUps.length} follow-up{followUps.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <FarmMaintenancePullButton className="text-xs sm:text-sm" />
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
            label: "Focus now",
            value: matching.filter((t) => (t.priority ?? 9) <= 2).length,
          },
          { label: "Follow-ups", value: followUps.length },
          {
            label: "Due today",
            value: matching.filter((t) => t.dueAt && t.dueAt <= end).length,
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-indigo-300" />
          <h2 className="text-sm font-semibold text-white">One-time</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {oneTimeDisplay.length}
          </span>
        </div>
        <TaskList
          initialTasks={oneTimeDisplay}
          emptyMessage="No one-time tasks for today."
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Recurring</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {recurringRows.length}
          </span>
        </div>
        <TaskList
          initialTasks={recurringRows}
          emptyMessage="No recurring tasks due today."
        />
      </section>
    </div>
  );
}
