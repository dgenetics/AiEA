"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { BoardLanePicker } from "@/components/board-lane-picker";
import type { TaskRowData } from "@/components/task-row";
import { boardLabel, laneOf, type BoardLane } from "@/lib/board";
import { cn, formatRelativeDue } from "@/lib/utils";
import { toDateInputValue, toStoredDueDate } from "@/lib/calendar";
import { DateField } from "@/components/date-field";

type Subtask = {
  id: string;
  title: string;
  dueAt?: string | null;
  status: string;
};

type Props = {
  task: TaskRowData;
  open: boolean;
  onClose: () => void;
  onSaved: (task: TaskRowData) => void;
  /** Called after the task is permanently deleted */
  onDeleted?: (id: string) => void;
  /** Lane the capture model chose. Shows the teaching hint under the due date. */
  aiBoard?: BoardLane;
};

function toDateInput(value?: string | Date | null): string {
  return toDateInputValue(value);
}

export function TaskEditModal({ task, open, onClose, onSaved, onDeleted, aiBoard }: Props) {
  const [title, setTitle] = useState(task.title);
  const [board, setBoard] = useState<BoardLane>(
    laneOf(task),
  );
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt));
  const [notes, setNotes] = useState(task.notes ?? "");
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
    setBoard(laneOf(task));
    setDueAt(toDateInput(task.dueAt));
    setNotes(task.notes ?? "");
    setError(null);
    setNewSubTitle("");
    setNewSubDue("");
    void loadSubtasks();
  }, [open, task, loadSubtasks]);

  if (!open) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: title.trim(),
          board,
          dueAt: dueAt ? toStoredDueDate(dueAt) : null,
          notes: notes.trim() || null,
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
          board,
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

  // text-base on mobile (≥16px) prevents iOS Safari focus-zoom; denser on md+
  const fieldClass =
    "box-border block w-full max-w-full min-w-0 rounded-lg border border-cream-300 bg-cream-50 px-3 py-2 text-base text-ink focus:border-forest-700 focus:outline-none md:text-sm";

  return (
    <div className="fixed inset-0 z-[100] flex max-w-[100vw] items-end justify-center overflow-x-hidden md:items-center md:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative box-border flex max-h-[92dvh] w-full max-w-md min-w-0 flex-col overflow-hidden rounded-t-2xl border border-cream-200 bg-cream-50 shadow-2xl safe-bottom md:max-h-[90vh] md:rounded-2xl">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4 md:p-5">
          <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink">Edit task</h2>
              <p className="text-[11px] leading-snug text-muted">
                Break big work into parts with their own due dates
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-cream-200/60 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 space-y-3">
            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-stone-600">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldClass}
              />
            </label>

            <div className="block min-w-0">
              <span className="mb-1 block text-xs text-stone-600">Board</span>
              <BoardLanePicker value={board} onChange={setBoard} />
            </div>

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-stone-600">
                Overall due date (optional if you use parts)
              </span>
              <DateField value={dueAt} onChange={setDueAt} />
            </label>

            {aiBoard ? (
              <p className="text-[11px] text-forest-700">
                ✦ AI picked {boardLabel(aiBoard)}. Your change teaches it.
              </p>
            ) : null}
            {task.boardReason && !aiBoard ? (
              <p className="text-[11px] text-muted" title={task.boardReason}>
                AI: {task.boardReason}
              </p>
            ) : null}
            {task.scheduleId ? (
              <a
                href={`/schedules?id=${task.scheduleId}`}
                className="text-[12px] text-green-800 underline underline-offset-2"
              >
                Schedule ›
              </a>
            ) : null}

            <label className="block min-w-0">
              <span className="mb-1 block text-xs text-stone-600">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={cn(fieldClass, "resize-y")}
              />
            </label>

            {canHaveSubtasks && (
              <div className="min-w-0 rounded-xl border border-cream-200 bg-cream-100 p-3">
                <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-semibold text-ink">
                    Parts / subtasks
                  </p>
                  <span className="shrink-0 text-[10px] text-muted">
                    {subtasks.length === 0
                      ? "None yet"
                      : `${openCount} open · ${subtasks.length} total`}
                  </span>
                </div>
                <p className="mb-3 text-[11px] leading-snug text-muted">
                  Split this into smaller steps, each with its own due date. Parts due today show
                  on Today even if the parent is later.
                </p>

                {loadingSubs ? (
                  <p className="text-xs text-muted">Loading…</p>
                ) : (
                  <ul className="mb-3 min-w-0 space-y-1.5">
                    {subtasks.map((sub) => (
                      <li
                        key={sub.id}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-cream-200 bg-cream-50 px-2 py-1.5"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubtask(sub)}
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                            sub.status === "DONE"
                              ? "border-forest-700 bg-forest-700 text-white"
                              : "border-stone-400",
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
                              "truncate text-xs text-ink",
                              sub.status === "DONE" && "line-through text-muted",
                            )}
                          >
                            {sub.title}
                          </p>
                          <p className="truncate text-[10px] text-muted">
                            {sub.dueAt
                              ? formatRelativeDue(sub.dueAt)
                              : "No due date"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSubtask(sub.id)}
                          className="shrink-0 rounded p-1 text-muted hover:bg-cream-200/60 hover:text-rose-700"
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
                    type="text"
                    value={newSubTitle}
                    onChange={(e) => setNewSubTitle(e.target.value)}
                    placeholder="e.g. Outline first draft"
                    enterKeyHint="done"
                    autoComplete="off"
                    className="box-border block w-full max-w-full min-w-0 rounded-lg border border-cream-300 bg-cream-50 px-2.5 py-2 text-base text-ink placeholder:text-muted focus:border-forest-700 focus:outline-none md:py-1.5 md:text-xs"
                  />
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
                    <div className="min-w-0 w-full sm:min-w-0 sm:flex-1">
                      <DateField
                        value={newSubDue}
                        onChange={setNewSubDue}
                        muted
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={addingSub || !newSubTitle.trim()}
                      className="inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-forest-900 px-2.5 py-2.5 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50 sm:w-auto sm:py-2 sm:text-xs"
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
              <p className="break-words rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </p>
            )}

            <div className="flex min-w-0 flex-col gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={deleteTask}
                disabled={deleting || saving}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2.5 text-sm text-rose-800 transition hover:bg-rose-50 disabled:opacity-50 sm:w-auto sm:py-2"
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
                  className="min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm text-stone-600 hover:bg-cream-200/60 hover:text-ink sm:flex-none sm:py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || deleting || !title.trim()}
                  className="min-w-0 flex-1 rounded-lg bg-forest-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-800 disabled:opacity-50 sm:flex-none sm:py-2"
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
