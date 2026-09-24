"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateField } from "@/components/date-field";
import type { BoardLane } from "@/lib/board";
import { toStoredDueDate } from "@/lib/calendar";

export type StaleTask = {
  id: string;
  title: string;
  board: BoardLane;
  overdueDays: number;
};

async function patchTask(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    // Triage moves are not AI classification corrections
    body: JSON.stringify({ trainAi: false, ...body }),
  });
  return res.ok;
}

/**
 * Collapsed "Stale · N" row (Current items overdue 8+ days) with inline Review.
 * Actions reuse PATCH /api/tasks/[id] (board / dueAt / complete).
 */
export function TodayStaleReview({
  initialTasks,
  todayYmd,
}: {
  initialTasks: StaleTask[];
  /** Server-computed local date (app timezone) — Reschedule default */
  todayYmd: string;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [open, setOpen] = useState(false);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [date, setDate] = useState(todayYmd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<StaleTask[] | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync after router.refresh() delivers new server props
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (initialTasks !== prevInitial) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
  }

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  async function act(task: StaleTask, body: Record<string, unknown>) {
    setError(null);
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setRescheduling(null);
    const ok = await patchTask(task.id, body);
    if (!ok) {
      setTasks((prev) => [task, ...prev]);
      setError(`Couldn't update "${task.title}"`);
      return;
    }
    router.refresh();
  }

  async function moveAllToBacklog() {
    const moved = tasks;
    if (moved.length === 0) return;
    setBusy(true);
    setError(null);
    setTasks([]);
    const results = await Promise.all(
      moved.map((t) => patchTask(t.id, { board: "BACKLOG" })),
    );
    const failed = moved.filter((_, i) => !results[i]);
    const ok = moved.filter((_, i) => results[i]);
    if (failed.length) {
      setTasks(failed);
      setError(`${failed.length} couldn't be moved`);
    }
    setBusy(false);
    if (ok.length) {
      setUndo(ok);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(null), 10000);
    }
    router.refresh();
  }

  async function undoMoveAll() {
    const batch = undo;
    if (!batch) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    setBusy(true);
    // Restore each item's previous board
    await Promise.all(batch.map((t) => patchTask(t.id, { board: t.board })));
    setTasks((prev) => [...batch, ...prev.filter((p) => !batch.some((b) => b.id === p.id))]);
    setBusy(false);
    router.refresh();
  }

  const btn =
    "rounded-md border border-white/10 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:border-white/20 hover:text-white disabled:opacity-50";

  return (
    <>
      {tasks.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-zinc-950/40">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-xs font-medium text-zinc-400">
              Stale · {tasks.length}
              <span className="ml-2 text-[11px] font-normal text-zinc-600">
                Current, overdue 8+ days
              </span>
            </p>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className={btn}
            >
              {open ? "Hide" : "Review"}
            </button>
          </div>
          {open && (
            <div className="space-y-2 border-t border-white/5 px-3 py-2">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={moveAllToBacklog}
                  disabled={busy}
                  className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-medium text-sky-200 hover:bg-sky-500/15 disabled:opacity-50"
                >
                  Move all to Backlog
                </button>
              </div>
              <ul className="space-y-1.5">
                {tasks.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-lg border border-white/5 bg-zinc-900/40 px-2.5 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-200">{t.title}</p>
                        <p className="text-[11px] text-rose-300/70">
                          {t.overdueDays}d overdue
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          className={btn}
                          disabled={busy}
                          onClick={() => act(t, { board: "BACKLOG" })}
                        >
                          Backlog
                        </button>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy}
                          onClick={() => {
                            setDate(todayYmd);
                            setRescheduling(rescheduling === t.id ? null : t.id);
                          }}
                        >
                          Reschedule
                        </button>
                        <button
                          type="button"
                          className={btn}
                          disabled={busy}
                          onClick={() => act(t, { action: "complete" })}
                        >
                          Done
                        </button>
                      </div>
                    </div>
                    {rescheduling === t.id && (
                      <div className="mt-2 flex items-center gap-2">
                        <DateField value={date} onChange={setDate} className="max-w-[11rem]" />
                        <button
                          type="button"
                          className={btn}
                          disabled={!date}
                          onClick={() => act(t, { dueAt: toStoredDueDate(date) })}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      {undo && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit items-center gap-3 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 shadow-lg md:bottom-6"
        >
          Moved {undo.length} to Backlog
          <button
            type="button"
            onClick={undoMoveAll}
            className="font-semibold text-indigo-300 hover:text-indigo-200"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}
