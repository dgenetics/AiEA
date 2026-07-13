import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";
import { TaskList } from "@/components/task-list";
import { endOfDay, startOfDay } from "date-fns";
import Link from "next/link";
import { CheckSquare, Repeat, Sparkles } from "lucide-react";

export default async function TodayPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  await materializeDueOccurrences(workspaceId);

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
        { priority: { lte: 2 }, status: "ACTIVE" },
      ],
    },
    include: { area: true, person: true },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
  });

  const oneTime = tasks.filter((t) => t.kind !== "OCCURRENCE");
  const recurring = tasks.filter((t) => t.kind === "OCCURRENCE");

  const followUps = tasks.filter((t) => t.isFollowUp);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const toRow = (t: (typeof tasks)[number]) => ({
    ...t,
    dueAt: t.dueAt?.toISOString() ?? null,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
            Today
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {greeting}, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {oneTime.length} one-time · {recurring.length} recurring ·{" "}
            {followUps.length} follow-up{followUps.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/capture"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/20"
        >
          <Sparkles className="h-4 w-4" />
          Capture
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Focus now", value: tasks.filter((t) => (t.priority ?? 9) <= 2).length },
          { label: "Follow-ups", value: followUps.length },
          {
            label: "Due today",
            value: tasks.filter((t) => t.dueAt && t.dueAt <= end).length,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-indigo-300" />
          <h2 className="text-sm font-semibold text-white">One-time</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {oneTime.length}
          </span>
        </div>
        <TaskList
          initialTasks={oneTime.map(toRow)}
          emptyMessage="No one-time tasks for today."
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-teal-300" />
          <h2 className="text-sm font-semibold text-white">Recurring</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {recurring.length}
          </span>
        </div>
        <TaskList
          initialTasks={recurring.map(toRow)}
          emptyMessage="No recurring tasks due today."
        />
      </section>
    </div>
  );
}

