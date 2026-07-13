import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AreasPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const areas = await prisma.area.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: "asc" },
    include: {
      tasks: {
        where: {
          status: { in: ["ACTIVE", "INBOX"] },
          kind: { not: "RECURRING_TEMPLATE" },
        },
        orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
        take: 8,
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Areas
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Life domains</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Work, Home, and Life — neat buckets so nothing collapses into chaos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {areas.map((area) => (
          <div
            key={area.id}
            className="rounded-2xl border border-white/5 bg-zinc-900/40 p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: area.color }}
              />
              <h2 className="font-semibold text-white">{area.name}</h2>
              <span className="ml-auto text-xs text-zinc-500">{area.tasks.length}</span>
            </div>
            <ul className="mt-4 space-y-2">
              {area.tasks.length === 0 && (
                <li className="text-xs text-zinc-600">No active tasks</li>
              )}
              {area.tasks.map((t) => (
                <li
                  key={t.id}
                  className="truncate rounded-lg bg-black/20 px-2 py-1.5 text-sm text-zinc-300"
                >
                  {t.title}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
