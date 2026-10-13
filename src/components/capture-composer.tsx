"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type Created = {
  id: string;
  title: string;
  board: "CURRENT" | "BACKLOG" | "ICEBOX";
};

type CaptureResponse = {
  ok?: boolean;
  error?: string;
  captureId?: string;
  tasks?: Created[];
  counts?: { CURRENT: number; BACKLOG: number; ICEBOX: number };
  rawFallback?: boolean;
};

const LANE_LABEL = { CURRENT: "Current", BACKLOG: "Backlog", ICEBOX: "Icebox" } as const;

export function CaptureComposer({
  onCreated,
}: {
  onCreated: (ids: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    captureId: string;
    tasks: Created[];
    counts: { CURRENT: number; BACKLOG: number; ICEBOX: number };
    rawFallback: boolean;
  } | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);

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
      setText("");
      setToast({
        captureId: data.captureId,
        tasks: data.tasks,
        counts: data.counts ?? { CURRENT: 0, BACKLOG: 0, ICEBOX: data.tasks.length },
        rawFallback: Boolean(data.rawFallback),
      });
      onCreated(data.tasks.map((t) => t.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not make tasks");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!toast) return;
    const id = toast.captureId;
    setToast(null);
    await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undo", captureId: id }),
    });
    onCreated([]);
  }

  const counts = toast?.counts;
  const summary = counts
    ? `Added ${toast.tasks.length} · ${counts.CURRENT} Current · ${counts.BACKLOG} Backlog · ${counts.ICEBOX} Icebox`
    : "";

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

      {toast && (
        <div className="rounded-xl border border-cream-200 bg-cream-50 px-3 py-2 text-sm text-ink">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              {toast.rawFallback ? `${summary} · saved the raw text` : summary}
            </span>
            <button type="button" className="text-forest-800 underline" onClick={() => void undo()}>
              Undo
            </button>
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-stone-600">
            {toast.tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    document.querySelector(`[data-task-id="${task.id}"] button`)?.dispatchEvent(
                      new MouseEvent("click", { bubbles: true }),
                    );
                  }}
                >
                  {task.title}
                </button>
                {" · "}
                {LANE_LABEL[task.board]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
