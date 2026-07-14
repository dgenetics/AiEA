"use client";

import { Check, Clock, Pencil, UserRound } from "lucide-react";
import {
  cn,
  formatRelativeDue,
  priorityColor,
  priorityLabel,
} from "@/lib/utils";
import {
  checkInsProgress,
  formatTimeLabel,
  parseCheckIns,
  type CheckInsState,
} from "@/lib/recurrence";

export type TaskRowData = {
  id: string;
  title: string;
  notes?: string | null;
  priority?: number | null;
  dueAt?: string | Date | null;
  status: string;
  isFollowUp?: boolean;
  kind?: string;
  estimateMinutes?: number | null;
  aiRationale?: string | null;
  checkIns?: string | null;
  area?: { id?: string; name: string; color: string; slug: string } | null;
  person?: { name: string } | null;
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
  onCheckIn,
  dense,
  nested,
}: {
  task: TaskRowData;
  onComplete?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onEdit?: (task: TaskRowData) => void;
  onCheckIn?: (id: string, slotIndex: number, done: boolean) => void;
  dense?: boolean;
  nested?: boolean;
}) {
  const done = task.status === "DONE";
  const checkIns = parseCheckIns(task.checkIns);
  const multi = checkIns && checkIns.slots.length > 1;
  const progress = checkInsProgress(checkIns);
  const openChildren = (task.children ?? []).filter((c) => c.status !== "DONE");

  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-zinc-900/40 transition hover:border-white/10 hover:bg-zinc-900/70",
        nested && "border-l-2 border-l-indigo-500/30 bg-zinc-950/40",
        done && "opacity-50",
      )}
    >
      <div
        className={cn(
          "group flex items-start gap-3 px-3",
          dense ? "py-2.5" : "py-3",
        )}
      >
        {!multi ? (
          <button
            type="button"
            onClick={() => onComplete?.(task.id)}
            className={cn(
              // Mobile: larger hit target; desktop (md+): original size
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition md:h-5 md:w-5",
              done
                ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
                : "border-zinc-600 text-transparent hover:border-indigo-400 hover:text-indigo-300",
            )}
            aria-label={done ? "Completed" : "Mark complete"}
          >
            <Check className="h-4 w-4 md:h-3 md:w-3" />
          </button>
        ) : (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-teal-500/30 bg-teal-500/10 text-[10px] font-semibold text-teal-300 md:h-5 md:w-5 md:text-[9px]">
            {progress.done}/{progress.total}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit?.(task)}
            className="w-full text-left"
            disabled={!onEdit}
          >
            {task.parentTitle && (
              <p className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                Part of · {task.parentTitle}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-sm font-medium text-zinc-100",
                  done && "line-through decoration-zinc-600",
                )}
              >
                {task.title}
              </p>
              {task.isFollowUp && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                  <UserRound className="h-3 w-3" />
                  Follow-up
                </span>
              )}
              {task.kind === "OCCURRENCE" && (
                <span className="rounded-full border border-teal-500/30 bg-teal-500/10 px-1.5 py-0.5 text-[10px] text-teal-300">
                  Recurring
                </span>
              )}
              {multi && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                  {progress.done}/{progress.total} today
                </span>
              )}
              {task.subtaskProgress && task.subtaskProgress.total > 0 && (
                <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">
                  {task.subtaskProgress.done}/{task.subtaskProgress.total} parts
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              {task.area && (
                <span
                  className="rounded-full px-1.5 py-0.5 font-medium"
                  style={{
                    color: task.area.color,
                    backgroundColor: `${task.area.color}18`,
                    border: `1px solid ${task.area.color}40`,
                  }}
                >
                  {task.area.name}
                </span>
              )}
              {task.priority != null && (
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 font-medium",
                    priorityColor(task.priority),
                  )}
                >
                  {priorityLabel(task.priority)}
                </span>
              )}
              {task.dueAt && !multi && (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <Clock className="h-3 w-3" />
                  {formatRelativeDue(task.dueAt)}
                </span>
              )}
              {task.person && (
                <span className="text-zinc-500">· {task.person.name}</span>
              )}
              {task.estimateMinutes ? (
                <span className="text-zinc-600">· {task.estimateMinutes}m</span>
              ) : null}
            </div>
          </button>

          {multi && checkIns && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {checkIns.slots.map((slot, i) => (
                <button
                  key={`${slot.time}-${i}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCheckIn?.(task.id, i, !slot.done);
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition md:min-h-0 md:px-2.5 md:py-1.5",
                    slot.done
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                      : "border-white/10 bg-zinc-950/50 text-zinc-300 hover:border-indigo-400/40 hover:text-white",
                  )}
                  aria-label={`${slot.done ? "Unmark" : "Mark"} check-in at ${formatTimeLabel(slot.time)}`}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      slot.done
                        ? "border-emerald-400/50 bg-emerald-500/30 text-emerald-200"
                        : "border-zinc-600",
                    )}
                  >
                    {slot.done ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                  {formatTimeLabel(slot.time)}
                </button>
              ))}
            </div>
          )}

          {task.notes && !dense && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
              {task.notes}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="rounded-md p-2.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200 md:p-1.5"
              title="Edit task"
            >
              <Pencil className="h-4 w-4 md:h-3.5 md:w-3.5" />
            </button>
          )}
          {onSnooze && !done && (
            <button
              type="button"
              onClick={() => onSnooze(task.id)}
              className="rounded-md px-2.5 py-1.5 text-[11px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 md:px-2 md:py-1"
            >
              Snooze
            </button>
          )}
        </div>
      </div>

      {openChildren.length > 0 && (
        <div className="space-y-1.5 border-t border-white/5 px-3 py-2.5 pl-8">
          <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
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
              onCheckIn={onCheckIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export type { CheckInsState };
