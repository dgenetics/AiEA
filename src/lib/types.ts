export type TaskKind = "ONE_TIME" | "RECURRING_TEMPLATE" | "OCCURRENCE";
export type TaskStatus =
  | "INBOX"
  | "PROPOSED"
  | "ACTIVE"
  | "DONE"
  | "CANCELLED"
  | "SNOOZED";

export type CaptureStatus =
  | "PENDING"
  | "PROPOSED"
  | "PARTIALLY_ACCEPTED"
  | "ACCEPTED"
  | "DISMISSED";

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly" | "custom";
  interval: number;
  byWeekday?: number[]; // 0=Sun … 6=Sat
  /** Primary / first slot (HH:mm). Prefer `times` when multi-slot. */
  time?: string;
  /**
   * Multiple check-in times on each occurrence day.
   * One task row with N checkboxes, e.g. ["10:00","14:00","18:00"].
   */
  times?: string[];
};

export type ProposedItem = {
  id: string;
  title: string;
  notes?: string;
  kind: TaskKind;
  areaSlug?: "work" | "life" | string;
  priority?: 1 | 2 | 3 | 4 | 5;
  dueAt?: string | null; // ISO
  scheduledFor?: string | null;
  estimateMinutes?: number | null;
  recurrenceRule?: RecurrenceRule | null;
  isFollowUp?: boolean;
  personName?: string | null;
  followUpDueAt?: string | null;
  aiRationale?: string;
  accepted?: boolean;
  dismissed?: boolean;
};

export type DailyBrief = {
  generatedAt: string;
  greeting: string;
  summary: string;
  topPriorities: Array<{ id: string; title: string; reason: string; priority: number | null }>;
  followUps: Array<{ id: string; title: string; personName: string; dueLabel: string }>;
  recurringDue: Array<{ id: string; title: string }>;
  overdue: Array<{ id: string; title: string; dueLabel: string }>;
  tips: string[];
};
