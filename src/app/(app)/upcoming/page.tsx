import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TaskList } from "@/components/task-list";
import { toTaskRow } from "@/lib/tasks-display";

export default async function UpcomingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  // Show one-time top-level tasks + recurring occurrences.
  // OCCURRENCEs always have parentId → template, so we must not require parentId: null.
  // Subtasks (ONE_TIME with a parent) nest under their parent cards.
  const tasks = await prisma.task.findMany({
    where: {
      workspaceId,
      status: { in: ["ACTIVE", "INBOX"] },
      OR: [
        { kind: "ONE_TIME", parentId: null },
        { kind: "OCCURRENCE" },
      ],
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
