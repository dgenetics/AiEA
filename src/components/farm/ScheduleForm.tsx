"use client";

import { useState } from "react";
import { FREQUENCY_OPTIONS } from "@/lib/maintenance";
import type { CreateScheduleInput } from "@/lib/farm-api";
import { StickySaveBar } from "@/components/farm/StickySaveBar";
import { Button, Field, Input, Select, Textarea } from "@/components/farm/ui";

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
}) {
  const resolved = resolveFrequency(initial?.frequency, initial?.intervalDays);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [frequency, setFrequency] = useState(resolved.frequency);
  const [customDays, setCustomDays] = useState(resolved.customDays);
  const [nextDueDate, setNextDueDate] = useState(() =>
    toDateInput(initial?.nextDueDate),
  );
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? true);
  const [error, setError] = useState<string | null>(null);

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
