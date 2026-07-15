import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";
import { toTaskRow } from "@/lib/tasks-display";
import { FarmMaintenancePullButton } from "@/components/farm-maintenance-pull";
import { Inbox as InboxIcon, Sprout } from "lucide-react";
import Link from "next/link";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const proposed = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { in: ["PROPOSED", "INBOX"] },
      kind: { in: ["ONE_TIME", "OCCURRENCE"] },
    },
    include: {
      area: true,
      person: true,
      parent: { select: { id: true, title: true, kind: true } },
    },
    orderBy: [{ priority: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const farmProposed = proposed.filter(
    (t) => t.externalSource === "bf-maintenance",
  );
  const otherProposed = proposed.filter(
    (t) => t.externalSource !== "bf-maintenance",
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Inbox
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-white">
          <InboxIcon className="h-6 w-6 text-amber-300" />
          Review &amp; accept
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Proposed tasks wait here until you accept them onto Today / Upcoming.
          Farm maintenance imports land here first.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <p className="text-sm font-medium text-emerald-100">
                Pull farm maintenance
              </p>
              <p className="mt-0.5 text-xs text-emerald-200/70">
                Import open schedules from BF Maintenance as proposed tasks —
                then accept the ones you want on your board.
              </p>
            </div>
          </div>
          <FarmMaintenancePullButton className="shrink-0" />
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sprout className="h-4 w-4 text-emerald-300" />
          <h2 className="text-sm font-semibold text-white">Farm maintenance</h2>
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
            {farmProposed.length}
          </span>
        </div>
        <TaskList
          mode="inbox"
          initialTasks={farmProposed.map((t) => toTaskRow(t))}
          emptyMessage="No proposed farm tasks. Pull farm maintenance above to import suggestions."
        />
      </section>

      {otherProposed.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <InboxIcon className="h-4 w-4 text-amber-300" />
            <h2 className="text-sm font-semibold text-white">Other proposed</h2>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-500">
              {otherProposed.length}
            </span>
          </div>
          <TaskList
            mode="inbox"
            initialTasks={otherProposed.map((t) => toTaskRow(t))}
            emptyMessage="Nothing else in the inbox."
          />
        </section>
      )}

      {proposed.length === 0 && (
        <p className="text-center text-xs text-zinc-600">
          After you accept, tasks show on{" "}
          <Link href="/today" className="text-indigo-300 hover:underline">
            Today
          </Link>{" "}
          and{" "}
          <Link href="/upcoming" className="text-indigo-300 hover:underline">
            Upcoming
          </Link>
          .
        </p>
      )}
    </div>
  );
}
