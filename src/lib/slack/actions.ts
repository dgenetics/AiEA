import {
  completeBfMaintenanceTask,
  parseBfTaskExternalId,
} from "@/lib/api/maintenance";
import { prisma } from "@/lib/db";

const BF_SYNC_ERROR = "Couldn't sync to BF Maintenance — try again.";

export type TaskActionResult =
  | {
      ok: true;
      already?: boolean;
      task: { id: string; title: string; status: string; dueAt: Date | null };
      bfSyncError?: string | null;
    }
  | { ok: false; error: string };

async function syncBfComplete(task: {
  externalSource: string | null;
  externalId: string | null;
  title: string;
}): Promise<string | null> {
  if (task.externalSource !== "bf-maintenance") return null;
  const bfTaskId = parseBfTaskExternalId(task.externalId);
  if (!bfTaskId) return null;
  try {
    const result = await completeBfMaintenanceTask(
      bfTaskId,
      `Completed in AiEA (Slack): ${task.title}`,
    );
    if (!result.ok) return BF_SYNC_ERROR;
  } catch {
    return BF_SYNC_ERROR;
  }
  return null;
}

/** Complete a task (idempotent if already DONE). */
export async function completeTaskForWorkspace(
  workspaceId: string,
  taskId: string,
): Promise<TaskActionResult> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found" };
  if (task.status === "DONE") {
    return {
      ok: true,
      already: true,
      task: {
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt,
      },
    };
  }
  if (task.status === "CANCELLED") {
    return { ok: false, error: "Task is cancelled" };
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { status: "DONE", completedAt: new Date() },
  });

  await prisma.reminder.updateMany({
    where: { taskId: task.id, status: "PENDING" },
    data: { status: "DISMISSED" },
  });

  const bfSyncError = await syncBfComplete(task);
  return {
    ok: true,
    task: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      dueAt: updated.dueAt,
    },
    bfSyncError,
  };
}

/** Snooze: status SNOOZED, dueAt += days (default 1). */
export async function snoozeTaskForWorkspace(
  workspaceId: string,
  taskId: string,
  days = 1,
): Promise<TaskActionResult> {
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    return { ok: false, error: "Snooze days must be 1–30" };
  }
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId },
  });
  if (!task) return { ok: false, error: "Task not found" };
  if (task.status === "DONE") {
    return { ok: false, error: "Task is already done" };
  }
  if (task.status === "CANCELLED") {
    return { ok: false, error: "Task is cancelled" };
  }

  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: "SNOOZED",
      snoozedUntil: until,
      dueAt: until,
    },
  });

  return {
    ok: true,
    task: {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      dueAt: updated.dueAt,
    },
  };
}
