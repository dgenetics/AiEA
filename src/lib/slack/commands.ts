/**
 * Parse Slack thread replies: `done <id>`, `snooze <id>`, `snooze <id> 3d`.
 * Ids are the short suffixes we print in due-today messages (see shortId).
 */

export type SlackCommand =
  | { action: "done"; shortId: string }
  | { action: "snooze"; shortId: string; days: number };

const DONE_RE = /^\s*done\s+([a-z0-9]+)\s*$/i;
const SNOOZE_RE = /^\s*snooze\s+([a-z0-9]+)(?:\s+(\d+)\s*d?)?\s*$/i;

export function parseSlackCommand(text: string): SlackCommand | null {
  const trimmed = text.trim();
  const done = DONE_RE.exec(trimmed);
  if (done) return { action: "done", shortId: done[1].toLowerCase() };

  const snooze = SNOOZE_RE.exec(trimmed);
  if (snooze) {
    const days = snooze[2] ? Number(snooze[2]) : 1;
    if (!Number.isFinite(days) || days < 1 || days > 30) return null;
    return {
      action: "snooze",
      shortId: snooze[1].toLowerCase(),
      days,
    };
  }
  return null;
}

/** Stable short handle printed in Slack (last 8 of cuid). */
export function shortId(taskId: string): string {
  return taskId.slice(-8).toLowerCase();
}

export function resolveTaskId(
  tasks: ReadonlyArray<{ id: string }>,
  short: string,
): string | null {
  const needle = short.toLowerCase();
  const hits = tasks.filter((t) => t.id.toLowerCase().endsWith(needle));
  if (hits.length === 1) return hits[0].id;
  return null;
}
