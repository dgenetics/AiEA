import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeRecurrence, parseRecurrenceRule } from "@/lib/recurrence";
import { formatRelativeDue } from "@/lib/utils";
import { Repeat } from "lucide-react";

export default async function RecurringPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return null;

  const templates = await prisma.task.findMany({
    where: { workspaceId, kind: "RECURRING_TEMPLATE", status: "ACTIVE" },
    include: { area: true },
    orderBy: { nextOccurrenceAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-indigo-300/80">
          Recurring
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">Habits & routines</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Templates AiEA schedules for you. Occurrences show up on Today when due.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <Repeat className="mx-auto h-8 w-8 text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-500">
            No recurring tasks yet. Capture something like “Water plants every Sunday”.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const rule = parseRecurrenceRule(t.recurrenceRule);
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-4 py-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-300">
                  <Repeat className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-100">{t.title}</p>
                  <p className="text-xs text-zinc-500">
                    {describeRecurrence(rule)}
                    {t.area ? ` · ${t.area.name}` : ""}
                    {t.nextOccurrenceAt
                      ? ` · next ${formatRelativeDue(t.nextOccurrenceAt)}`
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
