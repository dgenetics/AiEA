"use client";

import { useState } from "react";

/** Copy for the schedule confirm. Task rows for that schedule are deleted with it. */
export function scheduleDeleteMessage(name: string): string {
  const label = name.trim() || "this schedule";
  return `Delete '${label}'? This also deletes all its tasks, including completed ones.`;
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
    <div className={`rounded-[14px] border border-[#f3c0c0] bg-[#fdecec] px-3.5 py-3 ${className}`}>
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
}: {
  label: string;
  message: string;
  disabled?: boolean;
  onConfirm: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-5 flex min-h-11 w-full items-center justify-center text-[15px] font-semibold text-[#dc2626] disabled:opacity-40"
      >
        {label}
      </button>
    );
  }
  return (
    <DeleteConfirm
      className="mt-5"
      message={message}
      onDismiss={() => setOpen(false)}
      onConfirm={onConfirm}
    />
  );
}
