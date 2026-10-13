/** Schedule cadence helpers ported from bf-maintenance. Chores are Tasks. */

export function intervalDaysFromFrequency(
  frequency: string | null | undefined,
): number | null {
  if (!frequency) return null;
  const f = frequency.trim().toLowerCase();
  const map: Record<string, number> = {
    "7d": 7,
    "14d": 14,
    "30d": 30,
    "60d": 60,
    "90d": 90,
    "6mo": 182,
    "1y": 365,
    "12mo": 365,
  };
  return map[f] ?? null;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export const FREQUENCY_OPTIONS = [
  { value: "7d", label: "Weekly (7 days)", days: 7 },
  { value: "14d", label: "Every 2 weeks", days: 14 },
  { value: "30d", label: "Monthly (30 days)", days: 30 },
  { value: "90d", label: "Quarterly (90 days)", days: 90 },
  { value: "6mo", label: "Every 6 months", days: 182 },
  { value: "1y", label: "Yearly", days: 365 },
  { value: "custom", label: "Custom", days: null },
] as const;

export type ScheduleJson = {
  id: string;
  componentId: string;
  name: string;
  description: string | null;
  frequency: string | null;
  intervalDays: number | null;
  isRecurring: boolean;
  nextDueDate: string;
  lastCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapSchedule(s: {
  id: string;
  componentId: string;
  name: string;
  description: string | null;
  frequency: string | null;
  intervalDays: number | null;
  isRecurring: boolean;
  nextDueDate: Date;
  lastCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ScheduleJson {
  return {
    id: s.id,
    componentId: s.componentId,
    name: s.name,
    description: s.description,
    frequency: s.frequency,
    intervalDays: s.intervalDays,
    isRecurring: s.isRecurring,
    nextDueDate: s.nextDueDate.toISOString(),
    lastCompletedAt: s.lastCompletedAt ? s.lastCompletedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function frequencyLabel(
  frequency: string | null,
  intervalDays: number | null,
): string {
  if (!frequency && intervalDays == null) return "—";
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === frequency);
  if (opt && opt.value !== "custom") return opt.label;
  if (intervalDays != null) return `Every ${intervalDays}d`;
  if (frequency) return frequency;
  return "—";
}

export type DateBucket = "overdue" | "dueSoon" | "upcoming";

export function urgencyForNextDueDate(
  nextDueDate: string,
  now = new Date(),
): DateBucket {
  const due = new Date(nextDueDate);
  if (Number.isNaN(due.getTime())) return "upcoming";
  const msPerDay = 24 * 60 * 60 * 1000;
  const start = (d: Date) =>
    new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const daysUntil =
    (start(due).getTime() - start(now).getTime()) / msPerDay;
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "dueSoon";
  return "upcoming";
}
