"use client";

import { Check, Clock, Pencil, Sprout } from "lucide-react";
import { cadencePhrase, choreDuePresentation } from "@/lib/chore-display";
import {
  boardColor,
  boardLabel,
  laneOf,
  type BoardLane,
} from "@/lib/board";
import { cn, formatRelativeDue } from "@/lib/utils";

export type TaskRowData = {
  id: string;
  title: string;
  notes?: string | null;
  board?: BoardLane | string | null;
  /** @deprecated Prefer board */
  priority?: number | null;
  dueAt?: string | Date | null;
  status: string;
  isFollowUp?: boolean;
  kind?: string;
  estimateMinutes?: number | null;
  aiRationale?: string | null;
  boardReason?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  highlight?: boolean;
  scheduleId?: string | null;
  schedule?: { frequency?: string | null; intervalDays?: number | null } | null;
  component?: { name: string; system?: { name: string } | null } | null;
  parentId?: string | null;
  parentTitle?: string | null;
  children?: TaskRowData[];
  subtaskProgress?: { done: number; total: number; open: number };
};

export function TaskRow({
  task,
  onComplete,
  onSnooze,
  onEdit,
  onAccept,
  onDismiss,
  dense,
  nested,
  mode = "active",
}: {
  task: TaskRowData;
  onComplete?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onEdit?: (task: TaskRowData) => void;
  onAccept?: (id: string) => void;
  onDismiss?: (id: string) => void;
  dense?: boolean;
  nested?: boolean;
  mode?: "active" | "archive" | "inbox";
}) {
  const done = task.status === "DONE";
  const openChildren = (task.children ?? []).filter((c) => c.status !== "DONE");
  const fromSchedule = Boolean(task.scheduleId && task.component?.system?.name);
  const cadence = fromSchedule
    ? cadencePhrase(task.schedule?.frequency, task.schedule?.intervalDays)
    : null;
  const dueState = fromSchedule ? choreDuePresentation(task.dueAt) : null;
  const inboxMode = mode === "inbox";
  const lane = laneOf(task);

  return (
    <div
      data-task-id={task.id}
      className={cn(
        "rounded-xl border border-cream-200 bg-cream-50 shadow-[0_1px_2px_#1c19170d] transition hover:border-cream-300 hover:bg-white",
        nested && "border-l-2 border-l-forest-600/40 bg-cream-100",
        fromSchedule && "border-[#c9dccf]",
        task.highlight && "task-flash",
        done && "opacity-50",
      )}
    >
      <div
        className={cn(
          "group flex items-start gap-3 px-3",
          dense ? "py-2.5" : "py-3",
        )}
      >
        {inboxMode ? (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-[10px] font-semibold text-amber-800 md:h-5 md:w-5 md:text-[9px]">
            ?
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onComplete?.(task.id)}
            className={cn(
              // Mobile: larger hit target; desktop (md+): original size
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition md:h-5 md:w-5",
              done
                ? "border border-forest-700 bg-forest-700 text-white"
                : "border-[1.5px] border-stone-400 text-transparent hover:border-forest-700 hover:text-forest-700",
            )}
            aria-label={done ? "Completed" : "Mark complete"}
          >
            <Check className="h-4 w-4 md:h-3 md:w-3" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className="w-full text-left"
            disabled={!onEdit}
          >
            {task.parentTitle && (
              <p className="mb-0.5 text-[10px] uppercase tracking-wide text-muted">
                Part of · {task.parentTitle}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-sm font-medium text-ink",
                  done && "line-through text-muted decoration-stone-400",
                )}
              >
                {task.title}
              </p>
              {fromSchedule && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#c9dccf] bg-forest-100 px-1.5 py-0.5 text-[10px] text-forest-900">
                  <Sprout className="h-3 w-3" />
                  {task.component?.system?.name} · {task.component?.name}
                </span>
              )}
              {cadence && (
                <span className="text-[11px] font-medium text-forest-700">↻ {cadence}</span>
              )}
              {task.subtaskProgress && task.subtaskProgress.total > 0 && (
                <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800">
                  {task.subtaskProgress.done}/{task.subtaskProgress.total} parts
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              {!fromSchedule && lane === "ICEBOX" && (
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 font-medium",
                    boardColor(lane),
                  )}
                  title={task.boardReason || lane}
                >
                  {boardLabel(lane)}
                </span>
              )}
              {task.boardReason && !fromSchedule && (
                <span className="text-muted" title={task.boardReason}>
                  AI: {task.boardReason}
                </span>
              )}
              {dueState ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 font-medium",
                    dueState.tone === "overdue" && "text-rose-700",
                    dueState.tone === "soon" && "font-medium text-amber-700",
                    dueState.tone === "later" && "text-muted",
                  )}
                >
                  {dueState.tone === "later" && <Clock className="h-3 w-3" />}
                  {dueState.text}
                </span>
              ) : task.dueAt ? (
                <span className="inline-flex items-center gap-1 text-muted">
                  <Clock className="h-3 w-3" />
                  {formatRelativeDue(task.dueAt)}
                </span>
              ) : null}
              {fromSchedule && task.scheduleId && (
                <a
                  href={`/schedules?id=${task.scheduleId}`}
                  className="text-green-800 underline underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  Schedule ›
                </a>
              )}
              {task.estimateMinutes ? (
                <span className="text-muted">· {task.estimateMinutes}m</span>
              ) : null}
            </div>
          </button>

          {task.notes && !dense && (
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted">
              {task.notes.split("\n---")[0]?.trim() || task.notes}
            </p>
          )}
          {task.boardReason && fromSchedule && !dense && (
            <p className="mt-1 text-[10px] text-muted">{task.boardReason}</p>
          )}
        </div>

        {inboxMode ? (
          <div className="flex shrink-0 flex-col items-stretch gap-1.5">
            {onAccept && (
              <button
                type="button"
                onClick={() => onAccept(task.id)}
                className="rounded-lg bg-forest-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-800"
              >
                Accept
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(task.id)}
                className="rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-cream-200/60 hover:text-ink"
              >
                Dismiss
              </button>
            )}
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="rounded-lg p-1.5 text-muted hover:bg-cream-200/60 hover:text-ink"
                title="Edit"
              >
                <Pencil className="mx-auto h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(task)}
                className="rounded-md p-2.5 text-muted hover:bg-cream-200/60 hover:text-ink md:p-1.5"
                title="Edit task"
              >
                <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
              </button>
            )}
            {onSnooze && !done && (
              <button
                type="button"
                onClick={() => onSnooze(task.id)}
                className="rounded-md px-2.5 py-1.5 text-[11px] text-muted hover:bg-cream-200/60 hover:text-ink md:px-2 md:py-1"
              >
                Snooze
              </button>
            )}
          </div>
        )}
      </div>

      {openChildren.length > 0 && (
        <div className="space-y-1.5 border-t border-cream-200 px-3 py-2.5 pl-8">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
            Next parts
          </p>
          {openChildren.map((child) => (
            <TaskRow
              key={child.id}
              task={child}
              nested
              dense
              onComplete={onComplete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

