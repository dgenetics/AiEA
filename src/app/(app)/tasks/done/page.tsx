import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
        <Link
          href="/tasks"
          className="-ml-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-md px-1.5 text-sm text-zinc-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 active:text-white active:opacity-80"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Tasks
        </Link>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-white md:text-2xl">Archive</h1>
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
