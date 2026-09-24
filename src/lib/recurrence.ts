import type { RecurrenceRule } from "@/lib/types";

/**
 * Recurrence helpers.
 *
 * AiEA no longer materializes native recurring templates / occurrences or
 * multi-slot "N/M today" check-ins — cadence lives in BF Maintenance. The
 * `recurrenceRule` column is kept (schema cleanup is a later task) and is only
 * written as informational provenance on BF-linked tasks by the farm pull.
 */

export function parseRecurrenceRule(raw: string | null | undefined): RecurrenceRule | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecurrenceRule;
  } catch {
    return null;
  }
}

export function stringifyRecurrenceRule(rule: RecurrenceRule | null | undefined): string | null {
  if (!rule) return null;
  return JSON.stringify(rule);
}
