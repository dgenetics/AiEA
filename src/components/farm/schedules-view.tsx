"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/farm/data-context";
import { Modal } from "@/components/farm/Modal";
import { ScheduleForm } from "@/components/farm/ScheduleForm";
import { Button } from "@/components/farm/ui";
import { maintenanceApi } from "@/lib/farm-api";
import { cadencePhrase, choreDuePresentation } from "@/lib/chore-display";
import { formatCalendarDate } from "@/lib/calendar";
import type { ScheduleJson } from "@/lib/maintenance";

type OpenCard = {
  id: string;
  scheduleId: string | null;
  board: string | null;
  dueAt: string | null;
  status: string;
};

export function SchedulesView() {
  const { assets } = useData();
  const params = useSearchParams();
  const focusId = params.get("id");
  const [schedules, setSchedules] = useState<ScheduleJson[]>([]);
  const [openCards, setOpenCards] = useState<OpenCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [componentId, setComponentId] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [rows, taskRes] = await Promise.all([
        maintenanceApi.listSchedules(),
        fetch("/api/tasks?view=board", { credentials: "include" }).then((r) => r.json()),
      ]);
      setSchedules(rows);
      const tasks = (taskRes.tasks ?? []) as OpenCard[];
      setOpenCards(tasks.filter((t) => t.scheduleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load schedules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const meta = useMemo(() => {
    const byId = new Map<string, { system: string; component: string }>();
    for (const system of assets) {
      for (const component of system.components) {
        byId.set(component.id, { system: system.name, component: component.name });
      }
    }
    return byId;
  }, [assets]);

  const picks = useMemo(() => {
    const list: Array<{ id: string; label: string }> = [];
    for (const system of assets) {
      for (const component of system.components) {
        list.push({ id: component.id, label: `${system.name} / ${component.name}` });
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label));
  }, [assets]);

  const rows = schedules;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-stone-900">Schedules</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="text-[13px] font-semibold text-green-800"
        >
          + Add schedule
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-800">{error}</p>}
      {loading ? (
        <p className="text-sm text-stone-500">Loading schedules…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#efe9dc] bg-white">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-[11px] tracking-wide text-stone-500 uppercase">
                <th className="px-3 py-2.5 font-medium">Schedule</th>
                <th className="px-3 py-2.5 font-medium">System · Component</th>
                <th className="px-3 py-2.5 font-medium">Every</th>
                <th className="px-3 py-2.5 font-medium">Next due</th>
                <th className="px-3 py-2.5 font-medium">Open card</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                    No schedules yet.
                  </td>
                </tr>
              ) : (
                rows.map((s) => {
                  const m = meta.get(s.componentId);
                  const card = openCards.find((t) => t.scheduleId === s.id);
                  const due = choreDuePresentation(s.nextDueDate);
                  const highlighted = focusId === s.id;
                  return (
                    <tr
                      key={s.id}
                      id={`schedule-${s.id}`}
                      className={highlighted ? "bg-amber-50" : undefined}
                    >
                      <td className="border-t border-[#efe8da] px-3 py-2.5 font-semibold text-stone-900">
                        {s.name}
                      </td>
                      <td className="border-t border-[#efe8da] px-3 py-2.5 text-stone-700">
                        {m ? `${m.system} · ${m.component}` : "—"}
                      </td>
                      <td className="border-t border-[#efe8da] px-3 py-2.5 text-stone-600">
                        {cadencePhrase(s.frequency, s.intervalDays) ?? "—"}
                      </td>
                      <td className="border-t border-[#efe8da] px-3 py-2.5 text-stone-700">
                        {formatCalendarDate(s.nextDueDate, { month: "short", day: "numeric" })}
                      </td>
                      <td className="border-t border-[#efe8da] px-3 py-2.5">
                        {card ? (
                          <>
                            <span
                              className={
                                due?.tone === "overdue"
                                  ? "font-semibold text-rose-700"
                                  : due?.tone === "soon"
                                    ? "font-semibold text-amber-700"
                                    : "text-stone-600"
                              }
                            >
                              {due?.tone === "later"
                                ? card.board === "CURRENT"
                                  ? "Current"
                                  : card.board === "ICEBOX"
                                    ? "Icebox"
                                    : "Backlog"
                                : due?.text}
                            </span>
                            {" · "}
                            <Link href="/tasks" className="text-green-800 underline">
                              on Tasks ›
                            </Link>
                          </>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <Modal
          title="Add schedule"
          onClose={() => setAddOpen(false)}
          footer={
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Close
            </Button>
          }
        >
          <div className="space-y-3">
            <label className="block text-sm text-stone-700">
              Component
              <select
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
              >
                <option value="">Choose a component</option>
                {picks.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {componentId ? (
              <ScheduleForm
                componentId={componentId}
                busy={saving}
                embedActions
                onCancel={() => setAddOpen(false)}
                onSubmit={async (input) => {
                  setSaving(true);
                  try {
                    await maintenanceApi.createSchedule(input);
                    setAddOpen(false);
                    setComponentId("");
                    await load();
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            ) : (
              <p className="text-xs text-stone-500">Schedules belong to a component.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
