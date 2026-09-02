/**
 * User-facing kanban lane for tasks.
 * `priority` remains a dual-write sort field (1=Current … 5=Icebox).
 */

export const BOARD_LANES = ["ICEBOX", "BACKLOG", "CURRENT"] as const;

export type BoardLane = (typeof BOARD_LANES)[number];

export const BOARD_META: Record<
  BoardLane,
  { label: string; hint: string; chipClass: string }
> = {
  ICEBOX: {
    label: "Icebox",
    hint: "Someday / parked",
    chipClass: "text-zinc-400 bg-zinc-500/10 border-zinc-500/30",
  },
  BACKLOG: {
    label: "Backlog",
    hint: "Ready when you are",
    chipClass: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  },
  CURRENT: {
    label: "Current",
    hint: "In play now",
    chipClass: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  },
};

export function isBoardLane(value: unknown): value is BoardLane {
  return (
    typeof value === "string" &&
    (BOARD_LANES as readonly string[]).includes(value)
  );
}

/** Map legacy numeric priority → lane. */
export function boardFromPriority(
  n: number | null | undefined,
): BoardLane {
  if (n == null || Number.isNaN(n)) return "BACKLOG";
  if (n <= 2) return "CURRENT";
  if (n >= 4) return "ICEBOX";
  return "BACKLOG";
}

/** Dual-write sort key for a lane (lower = sooner in asc sorts). */
export function priorityFromBoard(board: BoardLane): number {
  switch (board) {
    case "CURRENT":
      return 1;
    case "BACKLOG":
      return 3;
    case "ICEBOX":
      return 5;
  }
}

/** Prefer explicit board; fall back to legacy priority. */
export function resolveBoard(input: {
  board?: string | null;
  priority?: number | null;
}): BoardLane {
  if (isBoardLane(input.board)) return input.board;
  return boardFromPriority(input.priority);
}

/** Fields to write on create/update so board + priority stay in sync. */
export function laneWrite(board: BoardLane): {
  board: BoardLane;
  priority: number;
} {
  return { board, priority: priorityFromBoard(board) };
}

export function boardLabel(board: BoardLane): string {
  return BOARD_META[board].label;
}

export function boardColor(board: BoardLane): string {
  return BOARD_META[board].chipClass;
}
