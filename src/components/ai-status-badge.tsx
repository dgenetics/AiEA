"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = {
  configured?: boolean;
  ready?: boolean;
  model?: string;
  keyHint?: string | null;
  hint?: string;
  ok?: boolean;
  error?: string;
};

export function AiStatusBadge() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setStatus(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) {
    return (
      <div className="hidden items-center gap-1.5 rounded-lg border border-white/5 bg-zinc-900/50 px-2.5 py-1.5 text-[11px] text-zinc-600 sm:flex">
        <Sparkles className="h-3 w-3" />
        AI…
      </div>
    );
  }

  const on = Boolean(status.configured || status.ok);

  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] sm:flex",
        on
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/20 bg-amber-500/10 text-amber-300",
      )}
      title={status.hint || status.error || (on ? "SpaceXAI ready" : "Set XAI_API_KEY")}
    >
      <Sparkles className="h-3 w-3" />
      {on ? (
        <span>
          SpaceXAI
          {status.model ? ` · ${status.model}` : ""}
          {status.keyHint ? ` · ${status.keyHint}` : ""}
        </span>
      ) : (
        <span>AI offline · set XAI_API_KEY</span>
      )}
    </div>
  );
}
