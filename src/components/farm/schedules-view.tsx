"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useData } from "@/components/farm/data-context";
import { Modal } from "@/components/farm/Modal";
import { ScheduleForm } from "@/components/farm/ScheduleForm";
import { maintenanceApi } from "@/lib/farm-api";
import { scheduleCardFrequency } from "@/lib/chore-display";
import type { ScheduleJson } from "@/lib/maintenance";
import {
  beginSchedulesFetch,
  schedulesFetchIsCurrent,
  type CachedOpenCard,
  type SchedulesPageData,
} from "@/lib/schedules-cache";

type OpenCard = CachedOpenCard;

export function SchedulesView({ initial }: { initial: SchedulesPageData }) {
  const { assets } = useData();
  const params = useSearchParams();
  const focusId = params.get("id");
  const openedFocus = useRef<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleJson[]>(initial.schedules);
  const [openCards, setOpenCards] = useState<OpenCard[]>(initial.openCards);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(params.get("add") === "1");
  const [editing, setEditing] = useState<ScheduleJson | null>(null);
  const [componentId, setComponentId] = useState("");
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSchedules(initial.schedules);
    setOpenCards(initial.openCards);
  }, [initial]);

  async function load() {
    const id = beginSchedulesFetch();
    setError(null);
    try {
      const [rows, taskRes] = await Promise.all([
        maintenanceApi.listSchedules(),
        fetch("/api/tasks?view=board", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (!schedulesFetchIsCurrent(id)) return;
      const tasks = (taskRes.tasks ?? []) as OpenCard[];
      setSchedules(rows);
      setOpenCards(tasks.filter((t) => t.scheduleId));
    } catch (e) {
      if (!schedulesFetchIsCurrent(id)) return;
      setError(e instanceof Error ? e.message : "Could not load schedules");
    }
  }

  useEffect(() => {
    if (!focusId) return;
    if (openedFocus.current === focusId) return;
    const row = schedules.find((s) => s.id === focusId);
    if (!row) return;
    openedFocus.current = focusId;
    setEditing(row);
  }, [focusId, schedules]);

  const meta = useMemo(() => {
    const byId = new Map(Object.entries(initial.places));
    for (const system of assets) {
      for (const component of system.components) {
        byId.set(component.id, { system: system.name, component: component.name });
      }
    }
    return byId;
  }, [assets, initial.places]);

  const picks = useMemo(() => {
    const list: Array<{ id: string; name: string; system: string }> = [];
    for (const system of assets) {
      for (const component of system.components) {
        list.push({ id: component.id, name: component.name, system: system.name });
      }
    }
    return list.sort(
      (a, b) => a.system.localeCompare(b.system) || a.name.localeCompare(b.name),
    );
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

      {editing && (
        <Modal
          variant="sheet"
          title="Edit schedule"
          subtitle={meta.get(editing.componentId)?.component}
          onClose={() => setEditing(null)}
        >
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
            formId="schedule-edit-form"
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
          variant="sheet"
          title={picking ? "Choose component" : "Add schedule"}
          onBack={picking ? () => setPicking(false) : undefined}
          onClose={() => {
            setAddOpen(false);
            setComponentId("");
            setPicking(false);
          }}
        >
          <ScheduleForm
            componentId={componentId}
            components={picks}
            onComponentChange={setComponentId}
            picking={picking}
            onPickingChange={setPicking}
            busy={saving}
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
        </Modal>
      )}
    </div>
  );
}
