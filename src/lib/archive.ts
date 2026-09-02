import { resolveBoard } from "@/lib/board";
import { formatRelativeDue } from "@/lib/utils";
import type { TaskRowData } from "@/components/task-row";

/** Shape returned by /api/tasks?view=archive (and server loaders). */
export type ArchiveTaskRaw = {
  id: string;
  title: string;
  notes?: string | null;
  board?: string | null;
  priority?: number | null;
  dueAt?: string | Date | null;
  completedAt?: string | Date | null;
  status: string;
  isFollowUp?: boolean;
  kind?: string;
  estimateMinutes?: number | null;
  aiRationale?: string | null;
  area?: { id?: string; name: string; color: string; slug: string } | null;
  person?: { name: string } | null;
};

export function toArchiveRow(t: ArchiveTaskRaw): TaskRowData {
  const completedAt = t.completedAt
    ? typeof t.completedAt === "string"
      ? t.completedAt
      : t.completedAt.toISOString()
    : null;
  const completedLabel = completedAt
    ? `Completed ${formatRelativeDue(completedAt)}`
    : null;

  return {
    id: t.id,
    title: t.title,
    notes: completedLabel
      ? `${completedLabel}${t.notes ? ` · ${t.notes}` : ""}`
      : t.notes,
    board: resolveBoard({ board: t.board, priority: t.priority }),
    priority: t.priority,
    dueAt: completedAt ?? (t.dueAt ? String(t.dueAt) : null),
    status: t.status,
    isFollowUp: t.isFollowUp,
    kind: t.kind,
    estimateMinutes: t.estimateMinutes,
    aiRationale: t.aiRationale,
    area: t.area,
    person: t.person,
  };
}
