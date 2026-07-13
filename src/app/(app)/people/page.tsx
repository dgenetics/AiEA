import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatRelativeDue } from "@/lib/utils";
import { UserRound } from "lucide-react";

export default async function PeoplePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const people = await prisma.person.findMany({
    where: { workspaceId },
    include: {
      tasks: {
        where: {
          status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
        },
        orderBy: [{ isFollowUp: "desc" }, { followUpDueAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          People
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Relationship radar</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Open loops and follow-ups tied to the humans in your life and work.
        </p>
      </div>

      {people.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <UserRound className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">
            No people yet. Capture a follow-up like “Ping Alex about the lease” and they&apos;ll
            appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {people.map((person) => {
            const openLoops = person.tasks.filter((t) => t.isFollowUp || t.status === "ACTIVE");
            return (
              <div
                key={person.id}
                className="rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-300">
                      {person.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-100">{person.name}</p>
                      <p className="text-xs text-zinc-500">
                        {person.company || person.email || "Contact"}
                        {person.lastContactAt
                          ? ` · last touch ${formatRelativeDue(person.lastContactAt)}`
                          : " · no recent touch logged"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400">
                    {openLoops.length} open
                  </span>
                </div>
                {openLoops.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                    {openLoops.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 text-sm text-zinc-300"
                      >
                        <span className="truncate">
                          {t.isFollowUp && (
                            <span className="mr-1.5 text-[10px] uppercase tracking-wide text-violet-400">
                              Follow-up
                            </span>
                          )}
                          {t.title}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {formatRelativeDue(t.followUpDueAt || t.dueAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
