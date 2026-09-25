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

/**
 * Read-time lane for a STORED task — the single place the Tasks board decides
 * which column a task renders in. Null / missing / unknown values render in
 * Backlog so nothing vanishes (no data backfill needed). Due dates never
 * affect the lane.
 */
export function laneOf(task: { board?: string | null }): BoardLane {
  return isBoardLane(task.board) ? task.board : "BACKLOG";
}

/** Board column order, left → right. */
export const BOARD_COLUMNS: readonly BoardLane[] = ["CURRENT", "BACKLOG", "ICEBOX"];

export type BoardCard<T> = { task: T; subtasks: BoardCard<T>[] };

/**
 * Group tasks into board cards — the single place subtask placement is decided.
 * Only open tasks (BOARD_STATUSES) are on the board. An open subtask whose
 * parent is on the board nests inside the parent's card and follows the
 * parent's lane (its own lane is ignored for placement). An open subtask whose
 * parent is NOT on the board (done / cancelled / proposed / missing) is its own
 * card in its own laneOf(), so nothing vanishes. Every open task appears once.
 */
export function buildBoard<
  T extends { id: string; status: string; board?: string | null; parentId?: string | null },
>(tasks: readonly T[]): Map<BoardLane, BoardCard<T>[]> {
  const open = tasks.filter((t) => (BOARD_STATUSES as readonly string[]).includes(t.status));
  const byId = new Map(open.map((t) => [t.id, t]));
  const cards = new Map(open.map((t) => [t.id, { task: t, subtasks: [] } as BoardCard<T>]));
  const parentOf = (t: T) => (t.parentId ? byId.get(t.parentId) : undefined);
  // Nest only when the parent chain ends at a top-level card (bad-data cycles stay top-level).
  const nestsUnder = (t: T): T | undefined => {
    const seen = new Set([t.id]);
    for (let p = parentOf(t); p; p = parentOf(p)) {
      if (seen.has(p.id)) return undefined;
      seen.add(p.id);
    }
    return parentOf(t);
  };
  const board = new Map(BOARD_COLUMNS.map((lane) => [lane, [] as BoardCard<T>[]]));
  for (const t of open) {
    const parent = nestsUnder(t);
    if (parent) cards.get(parent.id)!.subtasks.push(cards.get(t.id)!);
    else board.get(laneOf(t))!.push(cards.get(t.id)!);
  }
  return board;
}

/**
 * Every non-done task lives on the board. PROPOSED rows are un-accepted
 * capture/AI proposals owned by Inbox triage; CANCELLED = dismissed/deleted;
 * DONE → Archive.
 */
export const BOARD_STATUSES = ["ACTIVE", "INBOX", "SNOOZED"] as const;
