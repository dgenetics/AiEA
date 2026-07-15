"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckSquare,
  Loader2,
  MapPin,
  Sprout,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Suggestion = {
  externalId: string;
  source: "bf-maintenance";
  title: string;
  description: string;
  dueAt: string;
  priority: number;
  status: string;
  systemId: string;
  systemName: string;
  componentId: string;
  componentName: string;
  componentLocation: string;
  scheduleId: string | null;
  scheduleName: string | null;
  frequency?: string | null;
  intervalDays?: number | null;
  isRecurring?: boolean;
  taskId: string;
  reason: string;
  alreadyImported?: boolean;
  existingTaskId?: string | null;
  existingTaskStatus?: string | null;
};

type PullPayload = {
  count: number;
  newCount: number;
  materialized: number;
  suggestions: Suggestion[];
};

const statusTone: Record<string, string> = {
  OVERDUE: "bg-rose-500/15 text-rose-300",
  DUE_SOON: "bg-amber-500/15 text-amber-200",
  PENDING: "bg-zinc-500/15 text-zinc-300",
};

function priorityLabel(p: number) {
  if (p <= 1) return "Urgent";
  if (p === 2) return "High";
  if (p === 3) return "Normal";
  return `P${p}`;
}

export function FarmMaintenancePullButton({
  className,
  label = "Pull farm maintenance",
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payload, setPayload] = useState<PullPayload | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pull = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setPayload(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/integrations/bf-maintenance/pull");
      let data: { error?: string } & Partial<PullPayload>;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          res.ok
            ? "Unexpected response from AiEA"
            : `Pull failed (HTTP ${res.status}). Try again in a moment.`,
        );
      }
      if (!res.ok) {
        const msg = data.error || "Pull failed";
        if (
          res.status === 502 ||
          /cannot reach|unavailable|not set|rejected/i.test(msg)
        ) {
          throw new Error(
            `${msg} Open Account → Farm maintenance to check connection status.`,
          );
        }
        throw new Error(msg);
      }
      setPayload(data as PullPayload);
      const auto = new Set(
        ((data.suggestions as Suggestion[]) ?? [])
          .filter((s) => !s.alreadyImported)
          .map((s) => s.externalId),
      );
      setSelected(auto);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pull failed");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllNew() {
    if (!payload) return;
    setSelected(
      new Set(
        payload.suggestions
          .filter((s) => !s.alreadyImported)
          .map((s) => s.externalId),
      ),
    );
  }

  async function importSelected() {
    if (!payload) return;
    const suggestions = payload.suggestions.filter((s) =>
      selected.has(s.externalId),
    );
    if (suggestions.length === 0) {
      setError("Select at least one new task to import");
      return;
    }
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/integrations/bf-maintenance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestions,
          asStatus: "PROPOSED",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setSuccess(
        `Imported ${data.importedCount} task${data.importedCount === 1 ? "" : "s"} to Inbox (Proposed).${
          data.skippedCount ? ` Skipped ${data.skippedCount}.` : ""
        }`,
      );
      router.refresh();
      const refresh = await fetch("/api/integrations/bf-maintenance/pull");
      if (refresh.ok) {
        const next = (await refresh.json()) as PullPayload;
        setPayload(next);
        setSelected(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void pull()}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/15 disabled:opacity-60",
          className,
        )}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sprout className="h-4 w-4" />
        )}
        {loading ? "Pulling…" : label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-[#0c0c12] shadow-2xl sm:rounded-2xl"
            role="dialog"
            aria-labelledby="farm-pull-title"
          >
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <div>
                <h2
                  id="farm-pull-title"
                  className="text-base font-semibold text-zinc-100"
                >
                  Farm maintenance
                </h2>
                <p className="text-xs text-zinc-500">
                  Suggestions from BF Maintenance · select to import
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {error && (
                <div className="flex gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              {success && (
                <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                  {success}
                </p>
              )}

              {!payload && !error && (
                <p className="text-sm text-zinc-500">Loading…</p>
              )}

              {payload && payload.suggestions.length === 0 && (
                <p className="text-sm text-zinc-400">
                  No open maintenance tasks in BF Maintenance. Add schedules on
                  a component and try again.
                </p>
              )}

              {payload && payload.newCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={selectAllNew}
                    className="text-xs text-indigo-300 hover:text-indigo-200"
                  >
                    Select all new
                  </button>
                </div>
              )}

              {payload?.suggestions.map((s) => {
                const disabled = Boolean(s.alreadyImported);
                const checked = selected.has(s.externalId);
                return (
                  <label
                    key={s.externalId}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3 transition",
                      disabled && "cursor-default opacity-60",
                      checked &&
                        !disabled &&
                        "border-emerald-500/30 bg-emerald-500/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={disabled}
                      checked={disabled ? true : checked}
                      onChange={() => !disabled && toggle(s.externalId)}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-100">{s.title}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            statusTone[s.status] ?? statusTone.PENDING,
                          )}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                        {s.alreadyImported && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckSquare className="h-3 w-3" /> Imported
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400">
                        <span className="text-zinc-300">{s.systemName}</span>
                        <span className="text-zinc-600"> · </span>
                        {s.componentName}
                      </p>

                      {s.componentLocation ? (
                        <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {s.componentLocation}
                        </p>
                      ) : null}

                      <p className="text-xs text-zinc-500">{s.reason}</p>

                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
                        <span>
                          Due{" "}
                          <span className="text-zinc-300">
                            {format(parseISO(s.dueAt), "MMM d, yyyy")}
                          </span>
                        </span>
                        <span>
                          Priority{" "}
                          <span className="text-zinc-300">
                            {priorityLabel(s.priority)}
                          </span>
                        </span>
                        {s.scheduleName ? (
                          <span>
                            Schedule{" "}
                            <span className="text-zinc-300">
                              {s.scheduleName}
                            </span>
                          </span>
                        ) : null}
                        {s.frequency ? (
                          <span>
                            Every{" "}
                            <span className="text-zinc-300">{s.frequency}</span>
                          </span>
                        ) : s.isRecurring ? (
                          <span className="text-zinc-300">Recurring</span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-3">
              <p className="text-xs text-zinc-500">
                {payload
                  ? `${payload.newCount} new · ${payload.count} total`
                  : ""}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-3 py-2 text-sm text-zinc-400 hover:bg-white/5"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={importing || !payload || selected.size === 0}
                  onClick={() => void importSelected()}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Import selected
                  {selected.size > 0 ? ` (${selected.size})` : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
