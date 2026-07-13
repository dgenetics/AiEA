"use client";

import { Check, Clock, Pencil, UserRound } from "lucide-react";
import { cn, formatRelativeDue, priorityColor, priorityLabel } from "@/lib/utils";

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
  area?: { id?: string; name: string; color: string; slug: string } | null;
  person?: { name: string } | null;
};

export function TaskRow({
  task,
  onComplete,
  onSnooze,
  onEdit,
  dense,
}: {
  task: TaskRowData;
  onComplete?: (id: string) => void;
  onSnooze?: (id: string) => void;
  onEdit?: (task: TaskRowData) => void;
  dense?: boolean;
}) {
  const done = task.status === "DONE";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-white/5 bg-zinc-900/40 px-3 transition hover:border-white/10 hover:bg-zinc-900/70",
        dense ? "py-2.5" : "py-3",
        done && "opacity-50",
      )}
    >
      <button
        type="button"
        onClick={() => onComplete?.(task.id)}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition",
          done
            ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300"
            : "border-zinc-600 text-transparent hover:border-indigo-400 hover:text-indigo-300",
        )}
        aria-label={done ? "Completed" : "Mark complete"}
      >
        <Check className="h-3 w-3" />
      </button>

      <button
        type="button"
        onClick={() => onEdit?.(task)}
        className="min-w-0 flex-1 text-left"
        disabled={!onEdit}
      >
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
          {task.dueAt && (
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

        {task.aiRationale && !dense && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
            {task.aiRationale}
          </p>
        )}
      </button>

      <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 transition group-hover:opacity-100">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
            title="Edit task"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {onSnooze && !done && (
          <button
            type="button"
            onClick={() => onSnooze(task.id)}
            className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            Snooze
          </button>
        )}
      </div>
    </div>
  );
}
