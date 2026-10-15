"use client";

import { useEffect, useRef, useState } from "react";

/** Pixels of the visual viewport covered by the keyboard. */
function keyboardCover(): number {
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  return Math.max(0, Math.round(window.innerHeight - (viewport.height + viewport.offsetTop)));
}

function safeAreaBottom(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const height = probe.getBoundingClientRect().height;
  probe.remove();
  return height;
}

/**
 * Put the confirm's bottom (the Delete button) inside the visible area.
 * Sheets cover the tab bar; pages sit above it and any sticky save bar.
 * scroll-margin is applied before scrollIntoView so the alignment leaves
 * room for the safe area, keyboard, and those bars.
 */
function revealDeleteConfirm(el: HTMLElement) {
  const viewport = window.visualViewport;
  const viewportBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
  const inSheet = Boolean(el.closest("[data-sheet-scroll]"));
  const keyboard = keyboardCover();
  let limit = viewportBottom - 8;
  if (keyboard > 100) {
    limit = viewportBottom - 12;
  } else if (!inSheet) {
    const bar = document.querySelector("[data-sticky-save]");
    const nav = document.querySelector('nav[aria-label="Farm Manager"]');
    const obstacle = bar ?? nav;
    if (obstacle) {
      const top = obstacle.getBoundingClientRect().top;
      if (top < limit) limit = top - 8;
    }
  } else {
    limit -= safeAreaBottom();
  }
  el.style.scrollMarginBottom = `${Math.max(0, Math.round(viewportBottom - limit))}px`;
  el.scrollIntoView({ block: "end", behavior: "smooth" });
}

/** Copy for the schedule confirm. Task rows for that schedule are deleted with it. */
export function scheduleDeleteMessage(name: string): string {
  const label = name.trim() || "this schedule";
  return `Delete '${label}'? This also deletes all its tasks, including completed ones.`;
}

function quoted(name: string, fallback: string): string {
  return `'${name.trim() || fallback}'`;
}

function counted(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

/**
 * Component confirm. N is the schedule count. With none, the schedules clause is omitted
 * because there is nothing to name; tasks on the component are still deleted.
 */
export function componentDeleteMessage(name: string, scheduleCount: number): string {
  const label = quoted(name, "this component");
  if (scheduleCount <= 0) {
    return `Delete ${label}? This also deletes all its tasks, including completed ones.`;
  }
  if (scheduleCount === 1) {
    return `Delete ${label}? This also deletes its 1 schedule and all its tasks, including completed ones.`;
  }
  return `Delete ${label}? This also deletes its ${counted(scheduleCount, "schedule")} and all their tasks, including completed ones.`;
}

/** System confirm. N and M are the component and schedule counts on that system. */
export function systemDeleteMessage(
  name: string,
  componentCount: number,
  scheduleCount: number,
): string {
  const label = quoted(name, "this system");
  const schedules =
    scheduleCount === 1
      ? "its 1 schedule and all its tasks"
      : `${counted(scheduleCount, "schedule")}, and all their tasks`;
  return `Delete ${label}? This also deletes its ${counted(componentCount, "component")}, ${schedules}.`;
}

export function DeleteConfirm({
  message,
  onConfirm,
  onDismiss,
  className = "",
}: {
  message: string;
  onConfirm: () => Promise<void> | void;
  onDismiss: () => void;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => revealDeleteConfirm(el));
    return () => cancelAnimationFrame(id);
  }, [error]);

  async function go() {
    if (working) return;
    setWorking(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that");
      setWorking(false);
    }
  }

  return (
    <div
      ref={ref}
      className={`rounded-[14px] border border-[#f3c0c0] bg-[#fdecec] px-3.5 py-3 ${className}`}
    >
      <p className="text-[14px] leading-snug text-[#7f1d1d]">{message}</p>
      {error ? <p className="mt-2 text-xs font-medium text-red-800">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={working}
          onClick={onDismiss}
          className="h-11 flex-1 rounded-[12px] bg-[#e7e0d4] text-[15px] font-semibold text-stone-900 disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={working}
          onClick={() => void go()}
          className="h-11 flex-1 rounded-[12px] bg-[#dc2626] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {working ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

/** Red text control that turns into the confirm box in place. */
export function InlineDelete({
  label,
  message,
  disabled,
  onConfirm,
  className = "mt-5",
  buttonClassName = "flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-[#dc2626] disabled:opacity-40",
}: {
  label: string;
  message: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`${buttonClassName} ${className}`}
      >
        {label}
      </button>
    );
  }
  return (
    <DeleteConfirm
      className={className}
      message={message}
      onDismiss={() => setOpen(false)}
      onConfirm={onConfirm}
    />
  );
}
