"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useData } from "@/components/farm/data-context";
import { maintenanceApi } from "@/lib/farm-api";
import type { ScheduleJson } from "@/lib/maintenance";
import { ScheduleForm } from "@/components/farm/ScheduleForm";
import {
  hasOtherSystemsToMoveTo,
  MoveComponentSheet,
} from "@/components/farm/MoveComponentSheet";
import { Button, Card, PageHeader } from "@/components/farm/ui";

export function ComponentDetail({
  systemId,
  componentId,
}: {
  systemId: string;
  componentId: string;
}) {
  const router = useRouter();
  const { assets, getAsset } = useData();
  const system = systemId ? getAsset(systemId) : undefined;
  const component = system?.components.find((c) => c.id === componentId);

  const [schedules, setSchedules] = useState<ScheduleJson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const hasOtherSystems = systemId
    ? hasOtherSystemsToMoveTo(assets, systemId)
    : false;

  const load = useCallback(async () => {
    if (!componentId) return;
    setError(null);
    setLoading(true);
    try {
      const s = await maintenanceApi.listSchedules(componentId);
      setSchedules(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [componentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const openMoveSheet = () => {
    setMenuOpen(false);
    setMoveOpen(true);
  };

  if (!system || !component || !componentId) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">Component not found.</p>
        <Link href="/systems">
          <Button variant="secondary" size="sm">
            Back to systems
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => router.push(`/systems/${systemId}`)}
        className="flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <PageHeader
        title={component.name}
        subtitle={`${system.name}${component.location ? ` · ${component.location}` : ""}`}
        action={
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted hover:bg-cream-100 hover:text-ink"
              aria-label="Component actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-cream-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={!hasOtherSystems}
                  title={
                    hasOtherSystems
                      ? undefined
                      : "No other systems to move to."
                  }
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  onClick={() => {
                    if (!hasOtherSystems) return;
                    openMoveSheet();
                  }}
                >
                  Move to another system…
                </button>
                {!hasOtherSystems && (
                  <p className="px-3 pb-2 text-xs text-muted">
                    No other systems to move to.
                  </p>
                )}
              </div>
            )}
          </div>
        }
      />

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-xl bg-forest-50 px-3 py-2 text-sm text-forest-900">
          {info}
        </p>
      )}

      {/* Schedules */}
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-forest-800 uppercase">
              Maintenance schedules
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Recurring or one-off service plans
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add schedule
          </Button>
        </div>

        {showForm && (
          <div className="mb-4 rounded-xl border border-forest-600/20 bg-forest-50/40 p-3">
            <ScheduleForm
              componentId={componentId}
              busy={saving}
              embedActions
              onCancel={() => setShowForm(false)}
              onSubmit={async (input) => {
                setSaving(true);
                setError(null);
                setInfo(null);
                try {
                  await maintenanceApi.createSchedule(input);
                  setShowForm(false);
                  await load();
                  setInfo("Schedule saved. Its card is on Tasks.");
                } finally {
                  setSaving(false);
                }
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted">
            No schedules yet. Add one for oil changes, inspections, etc.
          </p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {schedules.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Next due{" "}
                    {format(parseISO(s.nextDueDate), "MMM d, yyyy")}
                    {s.frequency ? ` · ${s.frequency}` : ""}
                    {s.isRecurring ? " · recurring" : " · one-off"}
                  </p>
                  {s.description && (
                    <p className="mt-1 text-sm text-muted">{s.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="text-muted hover:text-red-700"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => {
                    if (!confirm(`Delete schedule “${s.name}”?`)) return;
                    void maintenanceApi
                      .deleteSchedule(s.id)
                      .then(() => load())
                      .catch((e: Error) => setError(e.message));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-sm text-muted">
        The open card for each schedule is on{" "}
        <Link href="/tasks" className="text-forest-800 underline">
          Tasks
        </Link>
        . Completed chores are under{" "}
        <Link href="/tasks/done" className="text-forest-800 underline">
          Done
        </Link>
        .
      </p>

      <Link
        href={`/systems/${system.id}`}
        className="block text-center text-sm text-forest-800 hover:underline"
      >
        View system: {system.name}
      </Link>

      {systemId && componentId && (
        <MoveComponentSheet
          open={moveOpen}
          onClose={() => setMoveOpen(false)}
          componentId={componentId}
          componentName={component.name}
          currentSystemId={systemId}
          systems={assets}
          onMoved={(newSystemId) => {
            router.push(`/systems/${newSystemId}/components/${componentId}`);
          }}
        />
      )}
    </div>
  );
}
