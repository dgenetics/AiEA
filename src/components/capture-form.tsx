"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { ProposedItem, ProposedSubtask, RecurrenceRule } from "@/lib/types";
import { cn, priorityColor, priorityLabel } from "@/lib/utils";
import { toDateInputValue } from "@/lib/calendar";
import { DateField } from "@/components/date-field";

const AREAS = [
  { slug: "work", label: "Work" },
  { slug: "life", label: "Life" },
] as const;

const WEEKDAYS = [
  { v: 0, label: "Sun" },
  { v: 1, label: "Mon" },
  { v: 2, label: "Tue" },
  { v: 3, label: "Wed" },
  { v: 4, label: "Thu" },
  { v: 5, label: "Fri" },
  { v: 6, label: "Sat" },
] as const;

function defaultRule(): RecurrenceRule {
  return { frequency: "weekly", interval: 1, byWeekday: [0], time: "09:00" };
}

export function CaptureForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [items, setItems] = useState<ProposedItem[]>([]);
  const [originalItems, setOriginalItems] = useState<ProposedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"ai" | "heuristic" | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [trainingUsed, setTrainingUsed] = useState(false);
  /** Expanded edit panels (all open by default so edits are obvious) */
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function propose(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setFallbackReason(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCaptureId(data.captureId);
      setItems(data.items);
      setOriginalItems(data.items);
      setSelected(new Set(data.items.map((i: ProposedItem) => i.id)));
      setExpanded(new Set(data.items.map((i: ProposedItem) => i.id)));
      setSource(data.source);
      setModel(data.model ?? null);
      setFallbackReason(data.fallbackReason ?? null);
      setTrainingUsed(Boolean(data.trainingExamplesUsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateItem(id: string, patch: Partial<ProposedItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function updateSubtask(
    itemId: string,
    index: number,
    patch: Partial<ProposedSubtask>,
  ) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId || !i.subtasks) return i;
        const subtasks = i.subtasks.map((s, idx) =>
          idx === index ? { ...s, ...patch } : s,
        );
        return { ...i, subtasks };
      }),
    );
  }

  function removeSubtask(itemId: string, index: number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId || !i.subtasks) return i;
        const subtasks = i.subtasks.filter((_, idx) => idx !== index);
        return { ...i, subtasks: subtasks.length ? subtasks : undefined };
      }),
    );
  }

  function addSubtask(itemId: string) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const subtasks = [
          ...(i.subtasks ?? []),
          { title: "", dueAt: i.dueAt ?? null },
        ];
        return { ...i, subtasks };
      }),
    );
  }

  function setKind(id: string, kind: "ONE_TIME" | "RECURRING_TEMPLATE") {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        if (kind === "RECURRING_TEMPLATE") {
          return {
            ...i,
            kind,
            dueAt: null,
            scheduledFor: null,
            recurrenceRule: i.recurrenceRule ?? defaultRule(),
          };
        }
        return {
          ...i,
          kind,
          recurrenceRule: null,
        };
      }),
    );
  }

  function updateRule(id: string, patch: Partial<RecurrenceRule>) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const base = i.recurrenceRule ?? defaultRule();
        return { ...i, recurrenceRule: { ...base, ...patch } };
      }),
    );
  }

  function toggleWeekday(id: string, day: number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const base = i.recurrenceRule ?? defaultRule();
        const set = new Set(base.byWeekday ?? []);
        if (set.has(day)) set.delete(day);
        else set.add(day);
        const byWeekday = [...set].sort((a, b) => a - b);
        return {
          ...i,
          recurrenceRule: {
            ...base,
            byWeekday: byWeekday.length ? byWeekday : [day],
          },
        };
      }),
    );
  }

  async function accept() {
    if (!captureId || selected.size === 0) return;

    // Drop empty part titles before save
    const cleaned = items.map((i) => ({
      ...i,
      title: i.title.trim(),
      subtasks: i.subtasks
        ?.map((s) => ({ ...s, title: s.title.trim() }))
        .filter((s) => s.title.length > 0),
    }));

    const invalid = cleaned.find(
      (i) => selected.has(i.id) && !i.title.trim(),
    );
    if (invalid) {
      setError("Selected items need a title before you can accept.");
      return;
    }

    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "accept",
          captureId,
          selectedIds: Array.from(selected),
          items: cleaned,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setText("");
      setItems([]);
      setOriginalItems([]);
      setCaptureId(null);
      setSelected(new Set());
      setExpanded(new Set());
      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  function discardProposals() {
    setItems([]);
    setOriginalItems([]);
    setCaptureId(null);
    setSelected(new Set());
    setExpanded(new Set());
    setError(null);
  }

  const editedCount = items.filter((i) => {
    const o = originalItems.find((x) => x.id === i.id);
    if (!o) return false;
    return (
      i.areaSlug !== o.areaSlug ||
      i.priority !== o.priority ||
      i.title !== o.title ||
      i.dueAt !== o.dueAt ||
      i.kind !== o.kind ||
      i.notes !== o.notes ||
      Boolean(i.isFollowUp) !== Boolean(o.isFollowUp) ||
      (i.personName || "") !== (o.personName || "") ||
      JSON.stringify(i.subtasks ?? []) !== JSON.stringify(o.subtasks ?? []) ||
      JSON.stringify(i.recurrenceRule ?? null) !==
        JSON.stringify(o.recurrenceRule ?? null)
    );
  }).length;

  return (
    <div className="space-y-6">
      <form onSubmit={propose} className="space-y-3">
        <label className="block text-sm font-medium text-zinc-300">
          Dump anything on your mind
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={`Examples:\n• Call plumber about the kitchen leak\n• Follow up with Sarah on the Q3 deck by Thursday\n• Water plants every Sunday\n• Renew car registration before end of month`}
          className="w-full resize-y rounded-xl border border-white/10 bg-zinc-950/80 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50 md:w-auto md:py-2"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Organize with AI
          </button>
          <p className="text-xs text-zinc-500 md:flex-1">
            Review and edit every field before you accept — that trains future captures
          </p>
        </div>
      </form>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white">
                Review &amp; edit before accept
              </h2>
              <p className="text-xs text-zinc-500">
                {source === "ai" ? (
                  <>
                    Source:{" "}
                    <span className="text-emerald-400/90">
                      SpaceXAI{model ? ` · ${model}` : ""}
                    </span>
                    {trainingUsed ? " · using your past corrections" : ""}
                  </>
                ) : (
                  <>
                    Source:{" "}
                    <span className="text-amber-400/90">Local heuristics</span>
                    {fallbackReason ? ` · ${fallbackReason}` : ""}
                  </>
                )}
                {editedCount > 0 && (
                  <span className="text-indigo-300">
                    {" "}
                    · {editedCount} edit{editedCount === 1 ? "" : "s"} will train AI
                  </span>
                )}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <button
                type="button"
                onClick={discardProposals}
                disabled={accepting}
                className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 hover:text-zinc-200 disabled:opacity-50 md:py-1.5"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={accept}
                disabled={accepting || selected.size === 0}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 md:flex-none md:py-1.5"
              >
                {accepting
                  ? "Saving…"
                  : `Accept ${selected.size} item${selected.size === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const on = selected.has(item.id);
              const orig = originalItems.find((x) => x.id === item.id);
              const areaChanged = orig && item.areaSlug !== orig.areaSlug;
              const isOpen = expanded.has(item.id);
              const rule = item.recurrenceRule ?? defaultRule();
              const isRecurring = item.kind === "RECURRING_TEMPLATE";

              return (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border px-4 py-3 transition",
                    on
                      ? "border-indigo-500/40 bg-indigo-500/10"
                      : "border-white/5 bg-zinc-900/40 opacity-60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={cn(
                        "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                        on
                          ? "border-indigo-400 bg-indigo-500 text-white"
                          : "border-zinc-600",
                      )}
                      aria-label="Toggle select"
                    >
                      {on ? "✓" : ""}
                    </button>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start gap-2">
                        <input
                          value={item.title}
                          onChange={(e) =>
                            updateItem(item.id, { title: e.target.value })
                          }
                          placeholder="Task title"
                          className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-sm font-medium text-zinc-100 focus:border-indigo-500/40 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })
                          }
                          className="shrink-0 rounded-md border border-white/10 px-2 py-1.5 text-[11px] text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        >
                          {isOpen ? "Collapse" : "Edit"}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="space-y-3 border-t border-white/5 pt-3">
                          {/* Category */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                              Category
                              {areaChanged ? (
                                <span className="ml-1 text-indigo-300">(fixed)</span>
                              ) : null}
                            </span>
                            {AREAS.map((a) => (
                              <button
                                key={a.slug}
                                type="button"
                                onClick={() =>
                                  updateItem(item.id, { areaSlug: a.slug })
                                }
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                                  item.areaSlug === a.slug
                                    ? "border-indigo-400/50 bg-indigo-500/20 text-indigo-200"
                                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
                                )}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>

                          {/* Kind */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                              Type
                            </span>
                            {(
                              [
                                ["ONE_TIME", "One-time"],
                                ["RECURRING_TEMPLATE", "Recurring"],
                              ] as const
                            ).map(([k, label]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setKind(item.id, k)}
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-[11px] font-medium transition",
                                  item.kind === k
                                    ? "border-teal-400/50 bg-teal-500/15 text-teal-200"
                                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
                                )}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          {/* Priority + due */}
                          <div className="grid gap-2 sm:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                                Priority
                              </span>
                              <div className="flex items-center gap-2">
                                <select
                                  value={item.priority ?? 3}
                                  onChange={(e) =>
                                    updateItem(item.id, {
                                      priority: Number(e.target.value) as
                                        | 1
                                        | 2
                                        | 3
                                        | 4
                                        | 5,
                                    })
                                  }
                                  className="w-full rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 focus:border-indigo-500/40 focus:outline-none"
                                >
                                  {[1, 2, 3, 4, 5].map((p) => (
                                    <option key={p} value={p}>
                                      P{p} ·{" "}
                                      {
                                        ["", "Critical", "High", "Medium", "Low", "Someday"][
                                          p
                                        ]
                                      }
                                    </option>
                                  ))}
                                </select>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px]",
                                    priorityColor(item.priority),
                                  )}
                                >
                                  {priorityLabel(item.priority)}
                                </span>
                              </div>
                            </label>

                            {!isRecurring && (
                              <label className="block">
                                <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                                  Due date
                                </span>
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <div className="min-w-0 flex-1">
                                    <DateField
                                      muted
                                      value={toDateInputValue(item.dueAt)}
                                      onChange={(v) => {
                                        // Keep YYYY-MM-DD while reviewing — ISO round-trip
                                        // breaks year spin/edit on date inputs.
                                        const dueAt = v || null;
                                        updateItem(item.id, {
                                          dueAt,
                                          scheduledFor: dueAt,
                                          ...(item.isFollowUp
                                            ? { followUpDueAt: dueAt }
                                            : {}),
                                        });
                                      }}
                                    />
                                  </div>
                                  {item.dueAt && (
                                    <button
                                      type="button"
                                      title="Clear due date"
                                      onClick={() =>
                                        updateItem(item.id, {
                                          dueAt: null,
                                          scheduledFor: null,
                                          followUpDueAt: item.isFollowUp
                                            ? null
                                            : item.followUpDueAt,
                                        })
                                      }
                                      className="shrink-0 rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </label>
                            )}
                          </div>

                          {/* Recurrence controls */}
                          {isRecurring && (
                            <div className="space-y-2 rounded-lg border border-teal-500/20 bg-teal-500/5 p-2.5">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-300/90">
                                Schedule
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                  Every
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={rule.interval ?? 1}
                                    onChange={(e) =>
                                      updateRule(item.id, {
                                        interval: Math.max(
                                          1,
                                          Number(e.target.value) || 1,
                                        ),
                                      })
                                    }
                                    className="w-14 rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200"
                                  />
                                </label>
                                <select
                                  value={rule.frequency}
                                  onChange={(e) =>
                                    updateRule(item.id, {
                                      frequency: e.target
                                        .value as RecurrenceRule["frequency"],
                                    })
                                  }
                                  className="rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200"
                                >
                                  <option value="daily">day(s)</option>
                                  <option value="weekly">week(s)</option>
                                  <option value="monthly">month(s)</option>
                                </select>
                                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                                  at
                                  <input
                                    type="time"
                                    value={rule.time ?? "09:00"}
                                    onChange={(e) =>
                                      updateRule(item.id, {
                                        time: e.target.value || "09:00",
                                      })
                                    }
                                    className="rounded border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-200"
                                  />
                                </label>
                              </div>
                              {rule.frequency === "weekly" && (
                                <div className="flex flex-wrap gap-1">
                                  {WEEKDAYS.map((d) => {
                                    const active = (rule.byWeekday ?? []).includes(
                                      d.v,
                                    );
                                    return (
                                      <button
                                        key={d.v}
                                        type="button"
                                        onClick={() =>
                                          toggleWeekday(item.id, d.v)
                                        }
                                        className={cn(
                                          "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                          active
                                            ? "border-teal-400/50 bg-teal-500/20 text-teal-100"
                                            : "border-white/10 text-zinc-500 hover:border-white/20",
                                        )}
                                      >
                                        {d.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Follow-up */}
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={Boolean(item.isFollowUp)}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    isFollowUp: e.target.checked,
                                    followUpDueAt: e.target.checked
                                      ? item.followUpDueAt ?? item.dueAt
                                      : null,
                                    personName: e.target.checked
                                      ? item.personName
                                      : null,
                                  })
                                }
                                className="rounded border-white/20"
                              />
                              People follow-up
                            </label>
                            {item.isFollowUp && (
                              <input
                                value={item.personName ?? ""}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    personName: e.target.value || null,
                                  })
                                }
                                placeholder="Person name"
                                className="min-w-[10rem] flex-1 rounded-md border border-white/10 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500/40 focus:outline-none"
                              />
                            )}
                          </div>

                          {/* Notes */}
                          <label className="block">
                            <span className="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500">
                              Notes
                            </span>
                            <textarea
                              value={item.notes ?? ""}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  notes: e.target.value || undefined,
                                })
                              }
                              rows={2}
                              placeholder="Optional details…"
                              className="w-full resize-y rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-indigo-500/40 focus:outline-none"
                            />
                          </label>

                          {/* Parts / subtasks */}
                          <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2.5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300/90">
                                Parts ({item.subtasks?.length ?? 0})
                              </p>
                              <button
                                type="button"
                                onClick={() => addSubtask(item.id)}
                                className="inline-flex items-center gap-1 rounded border border-sky-500/30 px-1.5 py-0.5 text-[10px] text-sky-200 hover:bg-sky-500/10"
                              >
                                <Plus className="h-3 w-3" />
                                Add part
                              </button>
                            </div>
                            {(!item.subtasks || item.subtasks.length === 0) && (
                              <p className="text-[11px] text-zinc-500">
                                Optional. Split into smaller steps with their own due
                                dates.
                              </p>
                            )}
                            <ul className="space-y-1.5">
                              {(item.subtasks ?? []).map((s, i) => (
                                <li
                                  key={`${item.id}-sub-${i}`}
                                  className="flex flex-wrap items-center gap-1.5"
                                >
                                  <span className="w-4 shrink-0 text-[10px] text-zinc-500">
                                    {i + 1}.
                                  </span>
                                  <input
                                    value={s.title}
                                    onChange={(e) =>
                                      updateSubtask(item.id, i, {
                                        title: e.target.value,
                                      })
                                    }
                                    placeholder="Part title"
                                    className="min-w-0 flex-1 rounded border border-white/10 bg-zinc-950 px-1.5 py-1 text-[11px] text-zinc-200 focus:border-sky-500/40 focus:outline-none"
                                  />
                                  <div className="w-full min-w-0 sm:w-[9.5rem] sm:shrink-0">
                                    <DateField
                                      muted
                                      value={toDateInputValue(s.dueAt)}
                                      onChange={(v) =>
                                        updateSubtask(item.id, i, {
                                          dueAt: v || null,
                                        })
                                      }
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    title="Remove part"
                                    onClick={() => removeSubtask(item.id, i)}
                                    className="shrink-0 rounded p-1 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-300"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {item.aiRationale && (
                            <p className="text-[11px] text-zinc-500">
                              AI: {item.aiRationale}
                            </p>
                          )}
                        </div>
                      )}

                      {!isOpen && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span className="rounded-full border border-white/10 px-1.5 py-0.5">
                            {item.areaSlug === "work" ? "Work" : "Life"}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-1.5 py-0.5 text-[10px]",
                              priorityColor(item.priority),
                            )}
                          >
                            {priorityLabel(item.priority)}
                          </span>
                          <span className="rounded-full border border-white/10 px-1.5 py-0.5">
                            {isRecurring ? "Recurring" : "One-time"}
                          </span>
                          {item.dueAt && (
                            <span>
                              Due{" "}
                              {toDateInputValue(item.dueAt) || "—"}
                            </span>
                          )}
                          {item.subtasks && item.subtasks.length > 0 && (
                            <span className="text-sky-400/80">
                              {item.subtasks.length} part
                              {item.subtasks.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1 md:justify-end">
            <button
              type="button"
              onClick={discardProposals}
              disabled={accepting}
              className="rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-white/5 disabled:opacity-50 md:py-1.5"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={accept}
              disabled={accepting || selected.size === 0}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 md:flex-none md:py-1.5"
            >
              {accepting
                ? "Saving…"
                : `Accept ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
