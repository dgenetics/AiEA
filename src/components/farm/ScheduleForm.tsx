"use client";

import { useState } from "react";
import { FREQUENCY_OPTIONS } from "@/lib/maintenance";
import type { CreateScheduleInput } from "@/lib/farm-api";
import { sheetRepeatFromSchedule, sheetRepeatToInput, type RepeatUnit } from "@/lib/schedule-sheet";
import { StickySaveBar } from "@/components/farm/StickySaveBar";
import { Button, Field, Input, Select, Textarea } from "@/components/farm/ui";

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

function resolveFrequency(
  frequency: string | null | undefined,
  intervalDays: number | null | undefined,
): { frequency: string; customDays: string } {
  if (frequency && FREQUENCY_OPTIONS.some((o) => o.value === frequency)) {
    return {
      frequency,
      customDays: String(intervalDays ?? 30),
    };
  }
  if (frequency === "custom" || (intervalDays != null && intervalDays > 0)) {
    return { frequency: "custom", customDays: String(intervalDays ?? 30) };
  }
  return { frequency: "90d", customDays: "30" };
}

function toDateInput(iso: string | undefined): string {
  if (!iso) {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

export function ScheduleForm({
  componentId,
  initial,
  onSubmit,
  onCancel,
  busy,
  formId = "schedule-form",
  submitLabel = "Save schedule",
  embedActions = false,
  variant = "default",
  error: errorProp = null,
}: {
  componentId: string;
  initial?: ScheduleFormInitial;
  onSubmit: (input: CreateScheduleInput) => Promise<void> | void;
  onCancel?: () => void;
  busy?: boolean;
  formId?: string;
  submitLabel?: string;
  /** Inline Cancel/Save for sheets (avoids fixed bar clipping). */
  embedActions?: boolean;
  /** Compact add-schedule sheet. The default form is unchanged. */
  variant?: "default" | "sheet";
  error?: string | null;
}) {
  const sheet = variant === "sheet";
  const resolved = resolveFrequency(initial?.frequency, initial?.intervalDays);
  const repeat = sheetRepeatFromSchedule(sheet ? initial : null);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [frequency, setFrequency] = useState(resolved.frequency);
  const [customDays, setCustomDays] = useState(resolved.customDays);
  const [unit, setUnit] = useState<RepeatUnit>(sheet && initial ? repeat.unit : "");
  const [count, setCount] = useState(sheet && initial ? repeat.count : "1");
  const [nextDueDate, setNextDueDate] = useState(() =>
    sheet
      ? initial?.nextDueDate
        ? toDateInput(initial.nextDueDate)
        : ""
      : toDateInput(initial?.nextDueDate),
  );
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? true);
  const [error, setError] = useState<string | null>(null);
  const cadence = sheet ? sheetRepeatToInput(count, unit) : null;
  const canSave = Boolean(name.trim() && cadence && nextDueDate && !busy);

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
    if (sheet) {
      const mapped = sheetRepeatToInput(count, unit);
      if (!mapped) return;
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
      return;
    }

    const opt = FREQUENCY_OPTIONS.find((o) => o.value === frequency);
    const intervalDays: number | null =
      frequency === "custom"
        ? Number(customDays) || null
        : (opt?.days ?? null);

    try {
      await onSubmit({
        componentId,
        name: name.trim(),
        description: description.trim() || null,
        frequency: frequency === "custom" ? "custom" : frequency,
        intervalDays,
        isRecurring,
        nextDueDate: new Date(nextDueDate + "T12:00:00").toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  if (sheet) {
    const shownError = errorProp ?? error;
    return (
      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="mt-3.5 flex flex-col gap-4">
        <label className="block text-[13px] text-[#78716c]">
          Name
          <Input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Backflush filter"
            className="mt-1.5 h-12 bg-[#fffdf8] text-base focus:border-stone-600 focus:ring-stone-600/12"
          />
        </label>
        <div>
          <label htmlFor="sched-count" className="block text-[13px] text-[#78716c]">
            Repeats every
          </label>
          <div className="mt-1.5 flex gap-2">
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
              className={`h-12 flex-1 appearance-none rounded-xl bg-[#fffdf8] bg-[length:16px_16px] bg-[position:right_14px_center] bg-no-repeat pr-10 text-base focus:border-stone-600 focus:ring-stone-600/12 ${unit ? "" : "text-stone-400"}`}
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
          <Input
            type="date"
            required
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            className={`date-control mt-1.5 h-12 bg-[#fffdf8] text-base focus:border-stone-600 focus:ring-stone-600/12 ${nextDueDate ? "" : "text-stone-400"}`}
          />
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

  return (
    <form
      id={formId}
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3"
    >
      <Field label="Schedule name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Oil change, Annual inspection"
          autoFocus
        />
      </Field>
      <Field label="Description">
        <Textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
        />
      </Field>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <Field label="Frequency">
            <Select
              className="h-11 w-full min-w-0 py-0 leading-none"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="min-w-0 overflow-hidden">
          <Field label="Next due">
            <Input
              type="date"
              className="date-control h-11 w-full min-w-0 max-w-full py-0 leading-none"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </Field>
        </div>
      </div>
      {frequency === "custom" && (
        <Field label="Interval (days)">
          <Input
            inputMode="numeric"
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
          />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isRecurring}
          onChange={(e) => setIsRecurring(e.target.checked)}
          className="rounded border-cream-300"
        />
        Recurring (create next task when completed)
      </label>
      {error && <p className="text-xs font-medium text-red-700">{error}</p>}
      {(() => {
        const actions = (
          <>
            {onCancel && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              form={formId}
              size="sm"
              disabled={busy || !name.trim()}
            >
              {busy ? "Saving…" : submitLabel}
            </Button>
          </>
        );
        if (embedActions) {
          return (
            <div className="flex justify-end gap-2 pt-2">{actions}</div>
          );
        }
        return <StickySaveBar>{actions}</StickySaveBar>;
      })()}
    </form>
  );
}
