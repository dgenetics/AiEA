"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import type { ProposedItem } from "@/lib/types";
import { cn, priorityColor, priorityLabel } from "@/lib/utils";

const AREAS = [
  { slug: "work", label: "Work" },
  { slug: "life", label: "Life" },
] as const;

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

  async function accept() {
    if (!captureId || selected.size === 0) return;
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
          items, // include edits so categories are saved + AI is trained
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setText("");
      setItems([]);
      setOriginalItems([]);
      setCaptureId(null);
      setSelected(new Set());
      router.push("/today");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    } finally {
      setAccepting(false);
    }
  }

  const editedCount = items.filter((i) => {
    const o = originalItems.find((x) => x.id === i.id);
    if (!o) return false;
    return (
      i.areaSlug !== o.areaSlug ||
      i.priority !== o.priority ||
      i.title !== o.title ||
      Boolean(i.isFollowUp) !== Boolean(o.isFollowUp)
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
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Organize with AI
          </button>
          <p className="text-xs text-zinc-500">
            Fix categories before accept — that trains future captures
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
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">Proposed plan</h2>
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
            <button
              type="button"
              onClick={accept}
              disabled={accepting || selected.size === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {accepting
                ? "Saving…"
                : `Accept ${selected.size} item${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>

          <div className="space-y-3">
            {items.map((item) => {
              const on = selected.has(item.id);
              const orig = originalItems.find((x) => x.id === item.id);
              const areaChanged = orig && item.areaSlug !== orig.areaSlug;

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

                    <div className="min-w-0 flex-1 space-y-2">
                      <input
                        value={item.title}
                        onChange={(e) => updateItem(item.id, { title: e.target.value })}
                        className="w-full rounded-md border border-white/10 bg-zinc-950/60 px-2 py-1.5 text-sm font-medium text-zinc-100 focus:border-indigo-500/40 focus:outline-none"
                      />

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
                            onClick={() => updateItem(item.id, { areaSlug: a.slug })}
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

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                          Priority
                          <select
                            value={item.priority ?? 3}
                            onChange={(e) =>
                              updateItem(item.id, {
                                priority: Number(e.target.value) as 1 | 2 | 3 | 4 | 5,
                              })
                            }
                            className="rounded-md border border-white/10 bg-zinc-950 px-1.5 py-0.5 text-[11px] text-zinc-200"
                          >
                            {[1, 2, 3, 4, 5].map((p) => (
                              <option key={p} value={p}>
                                P{p}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-0.5 text-[10px]",
                            priorityColor(item.priority),
                          )}
                        >
                          {priorityLabel(item.priority)}
                        </span>
                        <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {item.kind === "RECURRING_TEMPLATE" ? "Recurring" : "One-time"}
                        </span>
                        {item.isFollowUp && (
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                            Follow-up{item.personName ? ` · ${item.personName}` : ""}
                          </span>
                        )}
                        {item.dueAt && (
                          <span className="text-[11px] text-zinc-500">
                            Due {new Date(item.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {item.aiRationale && (
                        <p className="text-[11px] text-zinc-500">{item.aiRationale}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
