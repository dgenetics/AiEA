"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Loader2, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

type Settings = {
  configured: boolean;
  baseUrl: string | null;
  hasSecret: boolean;
  connected: boolean;
  openSuggestionCount: number | null;
  error: string | null;
  bfAutoPullEnabled: boolean;
  bfLastAutoPullAt: string | null;
};

export function BfMaintenanceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/bf-maintenance/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSettings(data as Settings);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleAutoPull(next: boolean) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/integrations/bf-maintenance/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bfAutoPullEnabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings((prev) =>
        prev
          ? {
              ...prev,
              bfAutoPullEnabled: data.bfAutoPullEnabled,
              bfLastAutoPullAt: data.bfLastAutoPullAt,
            }
          : prev,
      );
      setMessage(
        next
          ? "Auto-pull enabled — new farm tasks land in Inbox as Proposed."
          : "Auto-pull disabled.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !settings) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking farm connection…
      </div>
    );
  }

  const connected = Boolean(settings?.connected);
  const configured = Boolean(settings?.configured);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            connected
              ? "bg-emerald-500/15 text-emerald-300"
              : configured
                ? "bg-amber-500/15 text-amber-200"
                : "bg-zinc-500/15 text-zinc-400",
          )}
        >
          <Sprout className="h-3.5 w-3.5" />
          {connected
            ? "Connected to BF Maintenance"
            : configured
              ? "Configured · unreachable"
              : "Not configured"}
        </span>
        {connected && settings?.openSuggestionCount != null && (
          <span className="text-xs text-zinc-500">
            {settings.openSuggestionCount} open suggestion
            {settings.openSuggestionCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {settings?.baseUrl && (
        <p className="text-xs text-zinc-500">
          Endpoint:{" "}
          <span className="font-mono text-zinc-400">{settings.baseUrl}</span>
        </p>
      )}

      {settings?.error && !connected && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          {settings.error}
        </p>
      )}

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
        <input
          type="checkbox"
          className="mt-1"
          disabled={!configured || saving}
          checked={Boolean(settings?.bfAutoPullEnabled)}
          onChange={(e) => void toggleAutoPull(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">
            Auto-pull farm maintenance
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Once a day (server cron), import new open BF Maintenance tasks into
            Inbox as Proposed — you accept them onto the board.
          </p>
          {settings?.bfLastAutoPullAt && (
            <p className="mt-1 text-[11px] text-zinc-600">
              Last auto-pull:{" "}
              {format(parseISO(settings.bfLastAutoPullAt), "MMM d, yyyy h:mm a")}
            </p>
          )}
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />}
      </label>

      {message && (
        <p className="text-xs text-zinc-400">{message}</p>
      )}

      <button
        type="button"
        onClick={() => void load()}
        className="text-xs text-indigo-300 hover:text-indigo-200"
      >
        Refresh connection status
      </button>
    </div>
  );
}
