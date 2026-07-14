"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import type { TaskRowData } from "@/components/task-row";
import { cn, formatRelativeDue } from "@/lib/utils";
import { toDateInputValue, toStoredDueDate } from "@/lib/calendar";

export type AreaOption = { id: string; name: string; slug: string; color: string };

type Subtask = {
  id: string;
  title: string;
  dueAt?: string | null;
  status: string;
};

type Props = {
  task: TaskRowData;
  areas: AreaOption[];
  open: boolean;
  onClose: () => void;
  onSaved: (task: TaskRowData) => void;
  /** Called after the task is permanently deleted */
  onDeleted?: (id: string) => void;
};

function toDateInput(value?: string | Date | null): string {
  return toDateInputValue(value);
}

export function TaskEditModal({ task, areas, open, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(task.title);
  const [areaId, setAreaId] = useState(
    areas.find((a) => a.slug === task.area?.slug)?.id ?? areas[0]?.id ?? "",
  );
  const [priority, setPriority] = useState(task.priority ?? 3);
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [isFollowUp, setIsFollowUp] = useState(Boolean(task.isFollowUp));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [newSubDue, setNewSubDue] = useState("");
  const [addingSub, setAddingSub] = useState(false);

  // Subtasks only for top-level one-time tasks (not nested under another, not occurrences)
  const canHaveSubtasks =
    !task.parentId && task.kind !== "OCCURRENCE" && task.kind !== "RECURRING_TEMPLATE";

  const loadSubtasks = useCallback(async () => {
    if (!canHaveSubtasks) {
      setSubtasks([]);
      return;
    }
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/tasks?view=children&parentId=${task.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setSubtasks(
        (data.tasks ?? []).map(
          (t: { id: string; title: string; dueAt?: string | null; status: string }) => ({
            id: t.id,
            title: t.title,
            dueAt: t.dueAt ?? null,
            status: t.status,
          }),
        ),
      );
    } finally {
      setLoadingSubs(false);
    }
  }, [task.id, canHaveSubtasks]);

  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setAreaId(areas.find((a) => a.slug === task.area?.slug)?.id ?? areas[0]?.id ?? "");
    setPriority(task.priority ?? 3);
    setDueAt(toDateInput(task.dueAt));
    setNotes(task.notes ?? "");
    setIsFollowUp(Boolean(task.isFollowUp));
    setError(null);
    setNewSubTitle("");
    setNewSubDue("");
    void loadSubtasks();
  }, [open, task, areas, loadSubtasks]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (!areaId) {
        throw new Error("Pick a category (Work / Life) first");
      }
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: title.trim(),
          areaId,
          priority,
          dueAt: dueAt ? toStoredDueDate(dueAt) : null,
          notes: notes.trim() || null,
          isFollowUp,
          trainAi: true,
        }),
      });
      const raw = await res.text();
      let data: { error?: string; task?: TaskRowData & { dueAt?: string | null } } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(
            res.ok
              ? "Server returned invalid JSON"
              : `Save failed (HTTP ${res.status}). Restart npm run dev and try again.`,
          );
        }
      } else if (!res.ok) {
        throw new Error(`Save failed (HTTP ${res.status}). Restart npm run dev and try again.`);
      }
      if (!res.ok) throw new Error(data.error || `Save failed (HTTP ${res.status})`);
      if (!data.task) throw new Error("Save succeeded but no task returned");
      onSaved({
        ...task,
        ...data.task,
        dueAt: data.task.dueAt ?? null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addSubtask(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubTitle.trim() || addingSub) return;
    setAddingSub(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSubTitle.trim(),
          parentId: task.id,
          dueAt: newSubDue ? toStoredDueDate(newSubDue) : null,
          areaId: areaId || null,
          priority,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add subtask");
      setNewSubTitle("");
      setNewSubDue("");
      await loadSubtasks();
      onSaved(task); // trigger parent list refresh via router in TaskList
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add subtask");
    } finally {
      setAddingSub(false);
    }
  }

  async function toggleSubtask(sub: Subtask) {
    const action = sub.status === "DONE" ? "reopen" : "complete";
    await fetch(`/api/tasks/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await loadSubtasks();
  }

  async function deleteSubtask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    await loadSubtasks();
  }

  async function deleteTask() {
    const hasParts = subtasks.length > 0;
    const ok = window.confirm(
      hasParts
        ? `Delete “${task.title}” and its ${subtasks.length} part(s)? This cannot be undone.`
        : `Delete “${task.title}”? This cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete task");
      onDeleted?.(task.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete task");
    } finally {
      setDeleting(false);
    }
  }

  const openCount = subtasks.filter((s) => s.status !== "DONE").length;

  const fieldClass =
    "box-border block w-full max-w-full min-w-0 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none";

  return (
    <div className="fixed inset-0 z-[100] flex max-w-[100vw] items-end justify-center overflow-x-hidden md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative box-border flex max-h-[92dvh] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-zinc-950 shadow-2xl safe-bottom md:max-h-[90vh] md:rounded-2xl">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 md:p-5">
          <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white">Edit task</h2>
              <p className="text-[11px] leading-snug text-zinc-500">
                Break big work into parts with their own due dates
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 space-y-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-400">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-400">Category (area)</span>
              <div className="grid min-w-0 grid-cols-2 gap-2">
                {areas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAreaId(a.id)}
                    className={cn(
                      "min-w-0 truncate rounded-lg border px-2 py-2 text-xs font-medium transition",
                      areaId === a.id
                        ? "border-white/30 bg-white/10 text-white"
                        : "border-white/5 bg-zinc-900 text-zinc-400 hover:border-white/15",
                    )}
                    style={
                      areaId === a.id
                        ? { borderColor: `${a.color}80`, color: a.color }
                        : undefined
                    }
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-400">Priority</span>
              <select
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className={fieldClass}
              >
                <option value={1}>P1 · Critical</option>
                <option value={2}>P2 · High</option>
                <option value={3}>P3 · Medium</option>
                <option value={4}>P4 · Low</option>
                <option value={5}>P5 · Someday</option>
              </select>
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-400">
                Overall due date (optional if you use parts)
              </span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className={cn(fieldClass, "date-field")}
              />
            </label>

            <label className="flex min-w-0 items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={isFollowUp}
                onChange={(e) => setIsFollowUp(e.target.checked)}
                className="shrink-0 rounded border-white/20"
              />
              People follow-up
            </label>

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-zinc-400">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={cn(fieldClass, "resize-y")}
              />
            </label>

            {canHaveSubtasks && (
              <div className="min-w-0 rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold text-zinc-200">
                    Parts / subtasks
                  </p>
                  <span className="shrink-0 text-[10px] text-zinc-500">
                    {subtasks.length === 0
                      ? "None yet"
                      : `${openCount} open · ${subtasks.length} total`}
                  </span>
                </div>
                <p className="mb-3 text-[11px] leading-snug text-zinc-500">
                  Split this into smaller steps, each with its own due date. Parts due today show
                  on Today even if the parent is later.
                </p>

                {loadingSubs ? (
                  <p className="text-xs text-zinc-600">Loading…</p>
                ) : (
                  <ul className="mb-3 min-w-0 space-y-1.5">
                    {subtasks.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-white/5 bg-zinc-950/60 px-2 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubtask(sub)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                            sub.status === "DONE"
                              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                              : "border-zinc-600",
                          )}
                          aria-label={
                            sub.status === "DONE" ? "Reopen part" : "Complete part"
                          }
                        >
                          {sub.status === "DONE" ? (
                            <Check className="h-2.5 w-2.5" />
                          ) : null}
                        </button>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p
                            className={cn(
                              "truncate text-xs text-zinc-200",
                              sub.status === "DONE" && "line-through text-zinc-500",
                            )}
                          >
                            {sub.title}
                          </p>
                          <p className="truncate text-[10px] text-zinc-600">
                            {sub.dueAt
                              ? formatRelativeDue(sub.dueAt)
                              : "No due date"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSubtask(sub.id)}
                          className="shrink-0 rounded p-1 text-zinc-600 hover:bg-white/5 hover:text-rose-300"
                          title="Delete part"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={addSubtask} className="min-w-0 space-y-2">
                  <input
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    placeholder="e.g. Outline first draft"
                    className="box-border block w-full max-w-full min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none"
                  />
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                    <input
                      type="date"
                      value={newSubDue}
                      onChange={(e) => setNewSubDue(e.target.value)}
                      className="date-field box-border block w-full max-w-full min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500/40 focus:outline-none sm:flex-1"
                    />
                    <button
                      type="submit"
                      disabled={addingSub || !newSubTitle.trim()}
                      className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 sm:w-auto"
                    >
                      {addingSub ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Add
                    </button>
                  </div>
                </form>
              </div>
            )}

            {error && (
              <p className="break-words rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {error}
              </p>
            )}

            <div className="flex min-w-0 flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={deleteTask}
                disabled={deleting || saving}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 px-3 py-2.5 text-sm text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50 sm:w-auto sm:py-2"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <div className="flex min-w-0 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 sm:flex-none sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || deleting || !title.trim()}
                  className="min-w-0 flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 sm:flex-none sm:py-2"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
