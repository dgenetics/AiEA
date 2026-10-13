"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/farm/data-context";
import { Modal } from "@/components/farm/Modal";
import { ScheduleForm } from "@/components/farm/ScheduleForm";
import { Button } from "@/components/farm/ui";
import { maintenanceApi } from "@/lib/farm-api";
import { scheduleCardFrequency } from "@/lib/chore-display";
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
  const openedFocus = useRef<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleJson[]>([]);
  const [openCards, setOpenCards] = useState<OpenCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [editing, setEditing] = useState<ScheduleJson | null>(null);
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

  useEffect(() => {
    if (!focusId || loading) return;
    if (openedFocus.current === focusId) return;
    const row = schedules.find((s) => s.id === focusId);
    if (!row) return;
    openedFocus.current = focusId;
    setEditing(row);
  }, [focusId, loading, schedules]);

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

  const openIds = useMemo(
    () => new Set(openCards.map((t) => t.scheduleId).filter((id): id is string => Boolean(id))),
    [openCards],
  );

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
        <>
          {schedules.length === 0 ? (
            <p className="rounded-2xl border border-[#ebe3d3] bg-[#fffdf8] px-4 py-8 text-center text-sm text-stone-500">
              No schedules yet.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {schedules.map((s) => {
                const m = meta.get(s.componentId);
                const open = openIds.has(s.id);
                const place = m ? `${m.system} · ${m.component}` : "—";
                const every = scheduleCardFrequency(s.frequency, s.intervalDays);
                return (
                  <li key={s.id} id={`schedule-${s.id}`}>
                    <button
                      type="button"
                      aria-label={`Edit ${s.name}`}
                      onClick={() => setEditing(s)}
                      className={
                        open
                          ? "w-full rounded-2xl border border-[#f3d79a] bg-[#fdf0d5] px-4 py-3.5 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                          : "w-full rounded-2xl border border-[#ebe3d3] bg-[#fffdf8] px-4 py-3.5 text-left shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-800"
                      }
                    >
                      <div className="text-[15px] font-semibold text-stone-900">{s.name}</div>
                      <div className="mt-0.5 text-[13px] text-stone-500">{place}</div>
                      <div className="mt-2 text-[13px] text-stone-600">↻ {every}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3.5 flex items-center gap-1.5 text-xs text-stone-500">
            <span
              aria-hidden
              className="inline-block size-3 rounded border border-[#f3d79a] bg-[#fdf0d5]"
            />
            Tinted = has an open task on Tasks
          </p>
        </>
      )}

      {editing && (
        <Modal title="Edit schedule" onClose={() => setEditing(null)}>
          <ScheduleForm
            key={editing.id}
            componentId={editing.componentId}
            initial={{
              name: editing.name,
              description: editing.description,
              frequency: editing.frequency,
              intervalDays: editing.intervalDays,
              isRecurring: editing.isRecurring,
              nextDueDate: editing.nextDueDate,
            }}
            busy={saving}
            embedActions
            formId="schedule-edit-form"
            submitLabel="Save"
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              setSaving(true);
              try {
                await maintenanceApi.updateSchedule(editing.id, input);
                setEditing(null);
                await load();
              } finally {
                setSaving(false);
              }
            }}
          />
        </Modal>
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
