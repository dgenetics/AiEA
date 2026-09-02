import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { generateDailyBrief } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { materializeDueOccurrences } from "@/lib/workspace";
import { addDays, startOfDay } from "date-fns";
import Link from "next/link";

export default async function BriefPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

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

  const sourceLabel =
    brief.source === "ai"
      ? `Polished with Grok${brief.model ? ` · ${brief.model}` : ""}`
      : brief.source === "cached"
        ? "Cached polish · no new capture (no Grok charge)"
        : "Local summary · no Grok charge";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Daily Brief
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">{brief.greeting}</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{brief.summary}</p>
        <p className="mt-2 text-[11px] text-zinc-600" title={brief.aiSkipReason}>
          {sourceLabel}
          {brief.aiSkipReason && brief.source !== "ai" ? ` · ${brief.aiSkipReason}` : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-white/5 bg-gradient-to-br from-indigo-500/10 to-violet-600/5 p-5">
        <h2 className="text-sm font-semibold text-white">Top priorities</h2>
        <ul className="mt-3 space-y-2">
          {brief.topPriorities.length === 0 && (
            <li className="text-sm text-zinc-500">No priorities loaded. Capture or relax.</li>
          )}
          {brief.topPriorities.map((p, i) => (
            <li key={p.id} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs text-indigo-200">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-zinc-100">{p.title}</p>
                <p className="text-xs text-zinc-500">{p.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">People to reach</h2>
          <ul className="mt-2 space-y-2">
            {brief.followUps.length === 0 && (
              <li className="text-xs text-zinc-500">No open follow-ups.</li>
            )}
            {brief.followUps.map((f) => (
              <li key={f.id} className="text-sm text-zinc-300">
                <span className="text-violet-300">{f.personName}</span> — {f.title}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">Overdue / watch</h2>
          <ul className="mt-2 space-y-2">
            {brief.overdue.length === 0 && (
              <li className="text-xs text-zinc-500">Nothing overdue. Nice.</li>
            )}
            {brief.overdue.map((o) => (
              <li key={o.id} className="text-sm text-rose-300/90">
                {o.title}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {brief.recurringDue.length > 0 && (
        <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
          <h2 className="text-sm font-semibold text-white">Recurring due</h2>
          <ul className="mt-2 space-y-1">
            {brief.recurringDue.map((r) => (
              <li key={r.id} className="text-sm text-zinc-300">
                {r.title}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-white/5 bg-zinc-900/40 p-4">
        <h2 className="text-sm font-semibold text-white">Coach notes</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          {brief.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </section>

      <Link href="/today" className="inline-block text-sm text-indigo-300 hover:text-indigo-200">
        Open Today board →
      </Link>
    </div>
  );
}
