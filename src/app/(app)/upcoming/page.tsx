import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";
import { toTaskRow } from "@/lib/tasks-display";

export default async function UpcomingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  // Top-level one-time tasks only. Subtasks (ONE_TIME with a parent) nest under
  // their parent cards. Repeating chores arrive from BF Maintenance as ONE_TIME
  // rows (farm pull / linked-task bridge); legacy native OCCURRENCE rows are not shown.
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "INBOX"] },
      kind: "ONE_TIME",
      parentId: null,
    },
    include: {
      area: true,
      person: true,
      children: {
        where: {
          kind: "ONE_TIME",
          status: { not: "CANCELLED" },
        },
        include: { area: true, person: true },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      },
    },
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
          Active work ordered by deadline. Open a task to break it into parts with their own
          due dates.
        </p>
      </div>
      <TaskList
        initialTasks={tasks.map((t) => toTaskRow(t))}
        emptyMessage="No upcoming tasks. Your future self is free."
      />
    </div>
  );
}
