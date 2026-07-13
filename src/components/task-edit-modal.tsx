"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { TaskRowData } from "@/components/task-row";
import { cn } from "@/lib/utils";

export type AreaOption = { id: string; name: string; slug: string; color: string };

type Props = {
  task: TaskRowData;
  areas: AreaOption[];
  open: boolean;
  onClose: () => void;
  onSaved: (task: TaskRowData) => void;
};

function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function TaskEditModal({ task, areas, open, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task.title);
  const [areaId, setAreaId] = useState(
    areas.find((a) => a.slug === task.area?.slug)?.id ?? areas[0]?.id ?? "",
  );
  const [priority, setPriority] = useState(task.priority ?? 3);
  const [dueAt, setDueAt] = useState(toDateInput(task.dueAt));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [isFollowUp, setIsFollowUp] = useState(Boolean(task.isFollowUp));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(task.title);
    setAreaId(areas.find((a) => a.slug === task.area?.slug)?.id ?? areas[0]?.id ?? "");
    setPriority(task.priority ?? 3);
    setDueAt(toDateInput(task.dueAt));
    setNotes(task.notes ?? "");
    setIsFollowUp(Boolean(task.isFollowUp));
    setError(null);
  }, [open, task, areas]);

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
          dueAt: dueAt ? new Date(`${dueAt}T12:00:00`).toISOString() : null,
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Edit task</h2>
            <p className="text-[11px] text-zinc-500">
              Category fixes train the AI for future captures
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Category (area)</span>
            <div className="grid grid-cols-3 gap-2">
              {areas.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAreaId(a.id)}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-xs font-medium transition",
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

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Priority</span>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
            >
              <option value={1}>P1 · Critical</option>
              <option value={2}>P2 · High</option>
              <option value={3}>P3 · Medium</option>
              <option value={4}>P4 · Low</option>
              <option value={5}>P5 · Someday</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Due date</span>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={isFollowUp}
              onChange={(e) => setIsFollowUp(e.target.checked)}
              className="rounded border-white/20"
            />
            People follow-up
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full resize-y rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !title.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & train AI"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
