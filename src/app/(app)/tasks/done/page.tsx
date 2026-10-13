import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ArchiveBoard } from "@/components/archive-board";
import { toArchiveRow } from "@/lib/archive";

const PAGE_SIZE = 40;

export default async function DonePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const where = {
    workspaceId,
    status: "DONE" as const,
    kind: "ONE_TIME" as const,
  };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: {
        schedule: { select: { frequency: true, intervalDays: true } },
        component: { select: { name: true, system: { select: { name: true } } } },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE,
      skip: 0,
    }),
  ]);

  const nextOffset = tasks.length;
  const hasMore = nextOffset < total;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Done</h1>
        <p className="mt-1 text-sm text-zinc-500">Completed tasks, newest first.</p>
      </div>
      <ArchiveBoard
        initial={{
          tasks: tasks.map(toArchiveRow),
          nextOffset: hasMore ? nextOffset : null,
          hasMore,
          total,
        }}
        grandTotal={total}
      />
    </div>
  );
}
