"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskRow, type TaskRowData } from "@/components/task-row";
import { TaskEditModal } from "@/components/task-edit-modal";

export function TaskList({
  initialTasks,
  emptyMessage = "Nothing here yet.",
  /** Archive: completed tasks; checkmark reopens instead of completing */
  mode = "active",
  onArchiveReopen,
  allowSnooze = true,
}: {
  initialTasks: TaskRowData[];
  emptyMessage?: string;
  mode?: "active" | "archive" | "inbox";
  /** Called after a completed task is reopened (archive mode) */
  onArchiveReopen?: (id: string) => void;
  /** Board shows every open task, so Snooze (hide for a day) has no meaning there */
  allowSnooze?: boolean;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState<TaskRowData | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  /** Surface linked BF Maintenance sync failures (local change is kept). */
  async function noteSync(res: Response) {
    const data = (await res.json().catch(() => null)) as {
      bfSyncError?: string | null;
    } | null;
    setSyncError(data?.bfSyncError ?? null);
  }

  async function complete(id: string) {
    if (mode === "archive") {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      onArchiveReopen?.(id);
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      await noteSync(res);
      router.refresh();
      return;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "DONE" } : t)),
    );
    const res = await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    await noteSync(res);
    router.refresh();
  }

  async function accept(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    router.refresh();
  }

  async function dismiss(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    router.refresh();
  }

  async function snooze(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "snooze", snoozeDays: 1 }),
    });
    router.refresh();
  }

  const syncNotice = syncError ? (
    <p
      role="alert"
      className="mb-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
    >
      {syncError}
    </p>
  ) : null;

  if (tasks.length === 0) {
    return (
      <>
        {syncNotice}
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">{emptyMessage}</p>
        </div>
      </>
    );
  }

  return (
    <>
      {syncNotice}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            mode={mode}
            onComplete={mode === "inbox" ? undefined : complete}
            onSnooze={mode === "archive" || mode === "inbox" || !allowSnooze ? undefined : snooze}
            onEdit={setEditing}
            onAccept={mode === "inbox" ? accept : undefined}
            onDismiss={mode === "inbox" ? dismiss : undefined}
          />
        ))}
      </div>

      {editing && (
        <TaskEditModal
          task={editing}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTasks((prev) =>
              prev.map((t) =>
                t.id === updated.id ? { ...t, ...updated } : t,
              ),
            );
            router.refresh();
          }}
          onDeleted={(id) => {
            setTasks((prev) => prev.filter((t) => t.id !== id));
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
