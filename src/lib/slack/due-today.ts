import { BOARD_STATUSES } from "@/lib/board";
import { localYmd } from "@/lib/calendar";

export type DueTodayTask = {
  id: string;
  title: string;
  dueAt: Date | string | null;
  status: string;
  kind?: string | null;
  parentId?: string | null;
};

/**
 * Pure filter: open one-time tasks whose due calendar day is today in the
 * app timezone. Mirrors /tasks board openness (ACTIVE | INBOX | SNOOZED).
 */
export function selectDueToday<T extends DueTodayTask>(
  tasks: readonly T[],
  now: Date = new Date(),
): T[] {
  const today = localYmd(now);
  return tasks.filter((t) => {
    if (!(BOARD_STATUSES as readonly string[]).includes(t.status)) return false;
    if (t.kind && t.kind !== "ONE_TIME") return false;
    if (!t.dueAt) return false;
    const due =
      typeof t.dueAt === "string" || t.dueAt instanceof Date
        ? t.dueAt
        : null;
    if (!due) return false;
    return localYmd(new Date(due)) === today;
  });
}
