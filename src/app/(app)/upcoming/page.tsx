import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";

export default async function UpcomingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      kind: { not: "RECURRING_TEMPLATE" },
      status: { in: ["ACTIVE", "INBOX"] },
    },
    include: { area: true, person: true },
    orderBy: [{ dueAt: "asc" }, { priority: "asc" }],
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Upcoming
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Timeline</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Everything active, ordered by deadline and priority.
        </p>
      </div>
      <TaskList
        initialTasks={tasks.map((t) => ({
          ...t,
          dueAt: t.dueAt?.toISOString() ?? null,
        }))}
        emptyMessage="No upcoming tasks. Your future self is free."
      />
    </div>
  );
}
