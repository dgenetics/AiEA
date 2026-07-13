"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TaskRow, type TaskRowData } from "@/components/task-row";
import { TaskEditModal, type AreaOption } from "@/components/task-edit-modal";

export function TaskList({
  initialTasks,
  emptyMessage = "Nothing here yet.",
}: {
  initialTasks: TaskRowData[];
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [editing, setEditing] = useState<TaskRowData | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/areas");
        if (!res.ok) return;
        const data = await res.json();
        setAreas(
          (data.areas ?? []).map(
            (a: { id: string; name: string; slug: string; color: string }) => ({
              id: a.id,
              name: a.name,
              slug: a.slug,
              color: a.color,
            }),
          ),
        );
      } catch {
        /* ignore */
      }
    })();
  }, []);

  async function complete(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "DONE" } : t)),
    );
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
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

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={complete}
            onSnooze={snooze}
            onEdit={setEditing}
          />
        ))}
      </div>

      {editing && (
        <TaskEditModal
          task={editing}
          areas={areas}
          open={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTasks((prev) =>
              prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)),
            );
            router.refresh();
          }}
        />
      )}
    </>
  );
}
