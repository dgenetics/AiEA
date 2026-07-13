import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ArchiveBoard } from "@/components/archive-board";
import { toArchiveRow } from "@/lib/archive";
import { Archive } from "lucide-react";

const PAGE_SIZE = 40;

async function loadArchivePage(
  workspaceId: string,
  kind: "ONE_TIME" | "OCCURRENCE",
) {
  const where = {
    workspaceId,
    status: "DONE" as const,
    kind,
  };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: { area: true, person: true },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: 0,
    }),
  ]);

  const nextOffset = tasks.length;
  const hasMore = nextOffset < total;

  return {
    tasks: tasks.map(toArchiveRow),
    nextOffset: hasMore ? nextOffset : null,
    hasMore,
    total,
  };
}

export default async function ArchivePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const [oneTime, recurring, grandTotal] = await Promise.all([
    loadArchivePage(workspaceId, "ONE_TIME"),
    loadArchivePage(workspaceId, "OCCURRENCE"),
    prisma.task.count({
      where: {
        workspaceId,
        status: "DONE",
        kind: { not: "RECURRING_TEMPLATE" },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Archive
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-white">
          <Archive className="h-6 w-6 text-zinc-400" />
          Completed
        </h1>
      </div>

      <ArchiveBoard
        initialOneTime={oneTime}
        initialRecurring={recurring}
        grandTotal={grandTotal}
      />
    </div>
  );
}
