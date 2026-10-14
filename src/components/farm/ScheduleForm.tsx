"use client";

import { useRef, useState } from "react";
import type { CreateScheduleInput } from "@/lib/farm-api";
import { ComponentPicker, ComponentPickerField } from "@/components/farm/ComponentPicker";
import type { ComponentPickerOption } from "@/lib/component-picker";
import { sheetRepeatFromSchedule, sheetRepeatToInput, type RepeatUnit } from "@/lib/schedule-sheet";
import { Input, Select, Textarea } from "@/components/farm/ui";

const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2378716c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export type ScheduleFormInitial = {
  name?: string;
  description?: string | null;
  frequency?: string | null;
  intervalDays?: number | null;
  isRecurring?: boolean;
  nextDueDate?: string;
};

function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const controlClass =
  "mt-1.5 h-12 bg-[#fffdf8] text-base focus:border-stone-600 focus:ring-stone-600/12";

export function ScheduleForm({
  componentId,
  initial,
  onSubmit,
  busy,
  formId = "schedule-form",
  error: errorProp = null,
  components,
  onComponentChange,
  picking = false,
  onPickingChange,
}: {
  componentId: string;
  initial?: ScheduleFormInitial;
  onSubmit: (input: CreateScheduleInput) => Promise<void> | void;
  busy?: boolean;
  formId?: string;
  error?: string | null;
  /** Schedules page: the schedule is not already attached to a component. */
  components?: ComponentPickerOption[];
  onComponentChange?: (id: string) => void;
  picking?: boolean;
  onPickingChange?: (open: boolean) => void;
}) {
  const repeat = sheetRepeatFromSchedule(initial);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState<RepeatUnit>(repeat.unit);
  const [count, setCount] = useState(repeat.count);
  const [nextDueDate, setNextDueDate] = useState(() =>
    initial?.nextDueDate ? toDateInput(initial.nextDueDate) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const focusName = useRef(true);
  const cadence = sheetRepeatToInput(count, unit);
  const needsComponent = Boolean(components);
  const canSave = Boolean(
    name.trim() && cadence && nextDueDate && !busy && (!needsComponent || componentId),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!nextDueDate) {
      setError("Next due date is required");
      return;
    }
    const mapped = sheetRepeatToInput(count, unit);
    if (!mapped || (needsComponent && !componentId)) return;
    try {
      await onSubmit({
        componentId,
        name: name.trim(),
        description: description.trim() || null,
        frequency: mapped.frequency,
        intervalDays: mapped.intervalDays,
        isRecurring: mapped.isRecurring,
        nextDueDate: new Date(nextDueDate + "T12:00:00").toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  const shownError = errorProp ?? error;
  const selectClass = `h-12 flex-1 appearance-none rounded-xl bg-[#fffdf8] bg-[length:16px_16px] bg-[position:right_14px_center] bg-no-repeat pr-10 text-base focus:border-stone-600 focus:ring-stone-600/12`;

  if (picking && components && components.length > 0) {
    return (
      <ComponentPicker
        options={components}
        value={componentId}
        onChange={(id) => {
          onComponentChange?.(id);
          onPickingChange?.(false);
        }}
      />
    );
  }

  return (
    <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="mt-3.5 flex min-w-0 max-w-full flex-col gap-4">
      {components ? (
        components.length === 0 ? (
          <p className="text-[13px] text-[#78716c]">Schedules belong to a component.</p>
        ) : (
          <div className="block text-[13px] text-[#78716c]">
            Component
            <ComponentPickerField
              options={components}
              value={componentId}
              onOpen={() => {
                focusName.current = false;
                onPickingChange?.(true);
              }}
            />
          </div>
        )
      ) : null}
      <label className="block text-[13px] text-[#78716c]">
        Name
        <Input
          autoFocus={focusName.current}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Backflush filter"
          className={controlClass}
        />
      </label>
      <div>
        <label htmlFor="sched-count" className="block text-[13px] text-[#78716c]">
          Repeats every
        </label>
        <div className="mt-1.5 flex min-w-0 max-w-full gap-2">
          <Input
            id="sched-count"
            inputMode="numeric"
            placeholder="#"
            aria-label="Interval"
            disabled={unit === "once"}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="h-12 w-[84px] flex-none rounded-xl bg-[#fffdf8] text-center text-base focus:border-stone-600 focus:ring-stone-600/12 disabled:opacity-40"
          />
          <Select
            aria-label="Unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value as RepeatUnit)}
            className={`${selectClass} ${unit ? "" : "text-stone-400"}`}
            style={{ backgroundImage: selectChevron }}
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="days">days</option>
            <option value="weeks">weeks</option>
            <option value="months">months</option>
            <option value="years">years</option>
            <option value="once">Doesn't repeat</option>
          </Select>
        </div>
      </div>
      <label className="block text-[13px] text-[#78716c]">
        First due
        <div className="clip-x">
          <Input
            type="date"
            required
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className={`date-control ${controlClass} ${nextDueDate ? "" : "text-stone-400"}`}
          />
        </div>
      </label>
      <label className="block text-[13px] text-[#78716c]">
        Notes (optional)
        <Textarea
          rows={2}
          value={description}
          placeholder="Steps, parts, anything worth remembering"
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1.5 min-h-[76px] bg-[#fffdf8] text-[15px] focus:border-stone-600 focus:ring-stone-600/12"
        />
      </label>
      {shownError ? <p className="text-xs font-medium text-red-700">{shownError}</p> : null}
      <button
        type="submit"
        disabled={!canSave}
        className="mt-1.5 h-[50px] w-full rounded-[14px] bg-stone-900 text-base font-semibold text-[#f7f3eb] disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
