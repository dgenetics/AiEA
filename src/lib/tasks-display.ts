import type { TaskRowData } from "@/components/task-row";

type RawTask = {
  id: string;
  title: string;
  notes?: string | null;
  priority?: number | null;
  dueAt?: Date | string | null;
  status: string;
  isFollowUp?: boolean;
  kind?: string;
  estimateMinutes?: number | null;
  aiRationale?: string | null;
  checkIns?: string | null;
  parentId?: string | null;
  area?: { id?: string; name: string; color: string; slug: string } | null;
  person?: { name: string } | null;
  parent?: { id: string; title: string } | null;
  children?: Array<{
    id: string;
    title: string;
    notes?: string | null;
    priority?: number | null;
    dueAt?: Date | string | null;
    status: string;
    isFollowUp?: boolean;
    kind?: string;
    checkIns?: string | null;
    area?: { id?: string; name: string; color: string; slug: string } | null;
    person?: { name: string } | null;
  }>;
};

function iso(d?: Date | string | null) {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.toISOString();
}

export function toTaskRow(
  t: RawTask,
  extras?: Partial<TaskRowData>,
): TaskRowData {
  const children = (t.children ?? [])
    .filter((c) => c.status !== "CANCELLED")
    .map((c) => ({
      id: c.id,
      title: c.title,
      notes: c.notes,
      priority: c.priority,
      dueAt: iso(c.dueAt),
      status: c.status,
      isFollowUp: c.isFollowUp,
      kind: c.kind,
      checkIns: c.checkIns,
      area: c.area,
      person: c.person,
      parentId: t.id,
      parentTitle: t.title,
    }));

  const open = children.filter((c) => c.status !== "DONE");
  const done = children.filter((c) => c.status === "DONE");

  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    priority: t.priority,
    dueAt: iso(t.dueAt),
    status: t.status,
    isFollowUp: t.isFollowUp,
    kind: t.kind,
    estimateMinutes: t.estimateMinutes,
    aiRationale: t.aiRationale,
    checkIns: t.checkIns,
    area: t.area,
    person: t.person,
    parentId: t.parentId,
    parentTitle: t.parent?.title,
    children,
    subtaskProgress:
      children.length > 0
        ? { done: done.length, total: children.length, open: open.length }
        : undefined,
    ...extras,
  };
}
