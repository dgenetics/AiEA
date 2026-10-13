import type { BoardLane } from "@/lib/board";

export type TaskKind = "ONE_TIME" | "RECURRING_TEMPLATE" | "OCCURRENCE";
export type TaskStatus = "ACTIVE" | "DONE" | "CANCELLED" | "SNOOZED" | "INBOX";

export type { BoardLane };

export type CaptureStatus = "ACCEPTED" | "UNDONE";

/** Child part created under a parent task (own due date). */
export type ProposedSubtask = {
  title: string;
  dueAt?: string | null;
  notes?: string;
};

/** One task the capture parser will create as ACTIVE. */
export type ProposedItem = {
  id: string;
  title: string;
  notes?: string;
  kind: "ONE_TIME";
  board: BoardLane;
  boardReason?: string;
  /** @deprecated Prefer board; kept for dual-write */
  priority?: 1 | 2 | 3 | 4 | 5;
  dueAt?: string | null;
  aiRationale?: string;
  subtasks?: ProposedSubtask[];
};
