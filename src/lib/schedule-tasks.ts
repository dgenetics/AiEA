import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { laneWrite } from "@/lib/board";
import { intervalDaysFromFrequency } from "@/lib/maintenance";
import { boardForScheduleDue } from "@/lib/chore-display";

export { boardForScheduleDue, cadencePhrase, choreDuePresentation } from "@/lib/chore-display";

type Db = PrismaClient | Prisma.TransactionClient;

/** Statuses that count as the one open chore for a schedule. */
export const OPEN_TASK_STATUSES = ["ACTIVE", "INBOX", "SNOOZED"] as const;

export async function findOpenScheduleTask(db: Db, scheduleId: string) {
  return db.task.findFirst({
    where: { scheduleId, status: { in: [...OPEN_TASK_STATUSES] } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });
}

/** Create the open chore when a schedule has none. Lane is chosen only here. */
export async function materializeScheduleTask(
  db: Db,
  schedule: {
    id: string;
    workspaceId: string;
    componentId: string;
    name: string;
    description: string | null;
    nextDueDate: Date;
  },
) {
  const open = await findOpenScheduleTask(db, schedule.id);
  if (open) return open;
  const board = boardForScheduleDue(schedule.nextDueDate);
  return db.task.create({
    data: {
      workspaceId: schedule.workspaceId,
      scheduleId: schedule.id,
      componentId: schedule.componentId,
      title: schedule.name,
      notes: schedule.description,
      kind: "ONE_TIME",
      status: "ACTIVE",
      dueAt: schedule.nextDueDate,
      recurrenceRule: null,
      ...laneWrite(board),
    },
  });
}

/**
 * Keep the user's lane. Refresh the open card's due date when the schedule
 * changes, and create a card only when none is open.
 */
export async function syncScheduleOpenTask(
  db: Db,
  schedule: {
    id: string;
    workspaceId: string;
    componentId: string;
    name: string;
    description: string | null;
    nextDueDate: Date;
  },
) {
  const open = await findOpenScheduleTask(db, schedule.id);
  if (!open) return materializeScheduleTask(db, schedule);
  return db.task.update({
    where: { id: open.id },
    data: {
      dueAt: schedule.nextDueDate,
      componentId: schedule.componentId,
      title: open.title || schedule.name,
    },
  });
}

export async function completeTaskAndMaybeAdvance(
  prisma: PrismaClient,
  workspaceId: string,
  taskId: string,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findFirst({
      where: { id: taskId, workspaceId },
    });
    if (!task) return null;
    if (task.status === "DONE") return { task, next: null, alreadyDone: true };

    const completedAt = new Date();
    const updated = await tx.task.update({
      where: { id: task.id },
      data: { status: "DONE", completedAt },
    });

    if (!task.scheduleId) return { task: updated, next: null, alreadyDone: false };

    const schedule = await tx.maintenanceSchedule.findFirst({
      where: { id: task.scheduleId, workspaceId },
    });
    if (!schedule) return { task: updated, next: null, alreadyDone: false };

    const days =
      schedule.intervalDays ?? intervalDaysFromFrequency(schedule.frequency);
    if (schedule.isRecurring && days && days > 0) {
      const nextDue = new Date(completedAt);
      nextDue.setUTCDate(nextDue.getUTCDate() + days);
      await tx.maintenanceSchedule.update({
        where: { id: schedule.id },
        data: { lastCompletedAt: completedAt, nextDueDate: nextDue },
      });
      const next = await materializeScheduleTask(tx, {
        ...schedule,
        nextDueDate: nextDue,
        description: schedule.description,
      });
      return { task: updated, next, alreadyDone: false };
    }

    await tx.maintenanceSchedule.update({
      where: { id: schedule.id },
      data: { lastCompletedAt: completedAt },
    });
    return { task: updated, next: null, alreadyDone: false };
  });
}

/** Daily safety net: every schedule has at most one open task, and recurring ones have one. */
export async function materializeMissingScheduleTasks(workspaceId?: string) {
  const { prisma } = await import("@/lib/db");
  const schedules = await prisma.maintenanceSchedule.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : {}),
      isRecurring: true,
    },
  });
  let created = 0;
  for (const schedule of schedules) {
    const open = await findOpenScheduleTask(prisma, schedule.id);
    if (open) continue;
    await materializeScheduleTask(prisma, schedule);
    created += 1;
  }
  return { created, schedules: schedules.length };
}
