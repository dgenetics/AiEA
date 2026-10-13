"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { TaskEditModal } from "@/components/task-edit-modal";
import type { TaskRowData } from "@/components/task-row";
import { boardLabel, isBoardLane, type BoardLane } from "@/lib/board";
import { cn, formatRelativeDue } from "@/lib/utils";

type ReviewTask = {
  id: string;
  title: string;
  board: BoardLane;
  dueAt: string | null;
  boardReason: string | null;
  /** Lane chosen when the task was captured. Stays put if the row is edited. */
  aiBoard: BoardLane;
};

type CaptureResponse = {
  ok?: boolean;
  error?: string;
  captureId?: string;
  tasks?: Array<{
    id: string;
    title: string;
    board: string;
    dueAt?: string | null;
    boardReason?: string | null;
  }>;
  rawFallback?: boolean;
};

const CHIP: Record<BoardLane, string> = {
  CURRENT: "bg-forest-100 text-forest-900",
  BACKLOG: "bg-[#f3ead3] text-[#7a5b16]",
  ICEBOX: "bg-[#e6edf2] text-[#3d5a6e]",
};

function asLane(value: string): BoardLane {
  return isBoardLane(value) ? value : "ICEBOX";
}

function toEditTask(task: ReviewTask): TaskRowData {
  return {
    id: task.id,
    title: task.title,
    board: task.board,
    dueAt: task.dueAt,
    status: "ACTIVE",
    boardReason: task.boardReason,
  };
}

export function CaptureComposer({
  onCreated,
}: {
  onCreated: (ids: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewTask[] | null>(null);
  const [rawFallback, setRawFallback] = useState(false);
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [editing, setEditing] = useState<ReviewTask | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      for (const id of timers.current) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "c" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault();
        box.current?.focus();
      }
      if (e.key === "Escape" && document.activeElement === box.current) {
        if (text.trim() && !window.confirm("Discard this capture?")) return;
        setText("");
        setError(null);
        box.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [text]);

  async function submit(mode: "parse" | "raw" = "parse") {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, action: mode }),
      });
      const data = (await res.json().catch(() => ({}))) as CaptureResponse;
      if (!res.ok || !data.ok || !data.captureId || !data.tasks) {
        throw new Error(data.error || "Could not make tasks");
      }
      const rows = data.tasks.map((task) => {
        const board = asLane(task.board);
        return {
          id: task.id,
          title: task.title,
          board,
          dueAt: task.dueAt ?? null,
          boardReason: task.boardReason ?? null,
          aiBoard: board,
        };
      });
      setText("");
      setLeaving(new Set());
      setRawFallback(Boolean(data.rawFallback));
      setReview(rows.length ? rows : null);
      onCreated(rows.map((task) => task.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make tasks");
    } finally {
      setBusy(false);
    }
  }

  function accept(id: string) {
    setLeaving((current) => new Set(current).add(id));
    const timer = window.setTimeout(() => {
      setReview((rows) => {
        if (!rows) return null;
        const next = rows.filter((task) => task.id !== id);
        return next.length ? next : null;
      });
      setLeaving((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      setEditing((current) => (current?.id === id ? null : current));
    }, 150);
    timers.current.push(timer);
  }

  function acceptAll() {
    setReview(null);
    setLeaving(new Set());
    setEditing(null);
  }

  return (
    <div className="space-y-2">
      <form
        className="flex items-end gap-2 rounded-2xl border border-cream-300 bg-cream-50 p-2 pl-3.5 shadow-[0_1px_2px_#1c19170d] focus-within:border-forest-700"
        onSubmit={(e) => {
          e.preventDefault();
          void submit("parse");
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Capture</span>
          <textarea
            ref={box}
            value={text}
            disabled={busy}
            rows={1}
            placeholder="Type a task…"
            className="max-h-36 min-h-10 w-full resize-none bg-transparent py-2 text-sm text-ink outline-none placeholder:text-muted"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit("parse");
              }
            }}
          />
        </label>
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-9 shrink-0 rounded-xl bg-forest-900 px-3.5 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
        </button>
      </form>

      <div aria-live="polite" className="min-h-5 text-xs text-muted">
        {busy && "Making tasks…"}
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className="underline" onClick={() => void submit("parse")}>
            Retry
          </button>
          <button type="button" className="underline" onClick={() => void submit("raw")}>
            Save as one task
          </button>
        </div>
      )}

      {review && (
        <div className="overflow-hidden rounded-[14px] border border-cream-200 bg-cream-50">
          <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-3 py-[9px] text-xs">
            <p className="min-w-0">
              <span className="font-semibold text-ink">Added {review.length}</span>
              <span className="text-muted">
                {" "}
                · check the buckets
                {rawFallback ? " · saved as one task" : ""}
              </span>
            </p>
            <button
              type="button"
              onClick={acceptAll}
              className="shrink-0 font-semibold text-forest-900 underline underline-offset-2"
            >
              Accept all
            </button>
          </div>
          {review.map((task, index) => {
            const gone = leaving.has(task.id);
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 transition-all duration-150",
                  index > 0 && !gone && "border-t border-cream-200",
                  gone && "max-h-0 overflow-hidden border-t-0 py-0 opacity-0",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{task.title}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", CHIP[task.board])}>
                      {boardLabel(task.board)}
                    </span>
                    {task.dueAt ? <span>Due {formatRelativeDue(task.dueAt)}</span> : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(task)}
                  className="shrink-0 rounded-[9px] border border-cream-300 bg-cream-50 px-2.5 py-1.5 text-[13px] text-forest-900"
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label={`Accept ${task.title}`}
                  onClick={() => accept(task.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest-900 text-white"
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing ? (
        <TaskEditModal
          task={toEditTask(editing)}
          open
          aiBoard={editing.aiBoard}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            const board = asLane(String(saved.board ?? editing.aiBoard));
            const due =
              saved.dueAt == null
                ? null
                : saved.dueAt instanceof Date
                  ? saved.dueAt.toISOString()
                  : String(saved.dueAt);
            setReview((rows) =>
              rows?.map((task) =>
                task.id === saved.id
                  ? { ...task, title: saved.title, board, dueAt: due }
                  : task,
              ) ?? null,
            );
            onCreated([]);
          }}
          onDeleted={(id) => {
            setReview((rows) => {
              const next = (rows ?? []).filter((task) => task.id !== id);
              return next.length ? next : null;
            });
            setEditing(null);
            onCreated([]);
          }}
        />
      ) : null}
    </div>
  );
}
