import { FREQUENCY_OPTIONS } from "@/lib/maintenance";

/** Sheet cadence. "" is the untouched "Choose…" unit. */
export type RepeatUnit = "" | "days" | "weeks" | "months" | "years" | "once";

const DAY_FACTOR = { days: 1, weeks: 7, months: 30, years: 365 } as const;

const PRESET_UNITS: Record<string, { unit: Exclude<RepeatUnit, "">; count: string }> = {
  "7d": { unit: "weeks", count: "1" },
  "14d": { unit: "weeks", count: "2" },
  "30d": { unit: "months", count: "1" },
  "90d": { unit: "months", count: "3" },
  "6mo": { unit: "months", count: "6" },
  "1y": { unit: "years", count: "1" },
  "12mo": { unit: "years", count: "1" },
};

export function sheetRepeatFromSchedule(initial?: {
  frequency?: string | null;
  intervalDays?: number | null;
  isRecurring?: boolean;
} | null): { unit: RepeatUnit; count: string } {
  if (!initial) return { unit: "", count: "1" };
  if (initial.isRecurring === false) return { unit: "once", count: "1" };
  const frequency = (initial.frequency ?? "").trim().toLowerCase();
  const preset = PRESET_UNITS[frequency];
  if (preset) return preset;
  const days = initial.intervalDays;
  if (days != null && days > 0 && days % 7 === 0) {
    return { unit: "weeks", count: String(days / 7) };
  }
  if (days != null && days > 0) return { unit: "days", count: String(days) };
  return { unit: "", count: "1" };
}

/** Map the sheet row onto the existing create-schedule body. Null when it is incomplete. */
export function sheetRepeatToInput(
  count: string,
  unit: RepeatUnit,
): { frequency: string; intervalDays: number | null; isRecurring: boolean } | null {
  if (unit === "once") {
    return { frequency: "custom", intervalDays: null, isRecurring: false };
  }
  if (unit !== "days" && unit !== "weeks" && unit !== "months" && unit !== "years") return null;
  if (!/^\d+$/.test(count.trim())) return null;
  const n = Number(count.trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  const days = unit === "months" && n === 6 ? 182 : n * DAY_FACTOR[unit];
  const preset = FREQUENCY_OPTIONS.find((option) => option.days === days);
  if (preset && preset.value !== "custom") {
    return { frequency: preset.value, intervalDays: preset.days, isRecurring: true };
  }
  return { frequency: "custom", intervalDays: days, isRecurring: true };
}
