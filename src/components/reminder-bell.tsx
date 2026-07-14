"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Reminder = {
  id: string;
  title: string;
  body?: string | null;
  status: string;
  fireAt: string;
};

export function ReminderBell() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      if (!res.ok) return;
      const data = await res.json();
      setReminders(data.reminders ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const fired = reminders.filter((r) => r.status === "SENT");

  async function act(id: string, action: "dismiss" | "snooze") {
    await fetch("/api/reminders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    await load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative rounded-lg border border-white/10 bg-zinc-900/60 p-2 text-zinc-400 transition hover:text-white md:p-2",
          // Mobile top bar: square hit target
          "flex h-9 w-9 items-center justify-center md:inline-flex md:h-auto md:w-auto",
          fired.length > 0 && "text-amber-300",
        )}
        aria-label="Reminders"
      >
        <Bell className="h-4 w-4" />
        {fired.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {fired.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close reminders"
            onClick={() => setOpen(false)}
          />
        <div className="fixed inset-x-3 top-14 z-50 max-h-[70dvh] overflow-hidden rounded-xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-80 md:max-h-none">
          <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
            <p className="text-xs font-medium text-zinc-300">Pings</p>
            <button type="button" onClick={() => setOpen(false)} className="text-zinc-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-[60dvh] overflow-y-auto md:max-h-80">
            {reminders.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-zinc-600">
                No pings right now. You&apos;re clear.
              </p>
            ) : (
              reminders.map((r) => (
                <div
                  key={r.id}
                  className="border-b border-white/5 px-3 py-2.5 last:border-0"
                >
                  <p className="text-sm text-zinc-100">{r.title}</p>
                  {r.body && <p className="mt-0.5 text-[11px] text-zinc-500">{r.body}</p>}
                  <div className="mt-2 flex gap-2">
                    {r.status === "SENT" && (
                      <>
                        <button
                          type="button"
                          onClick={() => act(r.id, "dismiss")}
                          className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => act(r.id, "snooze")}
                          className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10"
                        >
                          Snooze 1h
                        </button>
                      </>
                    )}
                    {r.status === "PENDING" && (
                      <span className="text-[11px] text-zinc-600">
                        Scheduled {new Date(r.fireAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
