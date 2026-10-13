import { BOARD_STATUSES } from "@/lib/board";
import { prisma } from "@/lib/db";
import { mapSchedule } from "@/lib/maintenance";
import type { SchedulePlace, SchedulesPageData } from "@/lib/schedules-cache";

export type { SchedulesPageData };

export async function loadSchedulesPage(workspaceId: string): Promise<SchedulesPageData> {
  const [rows, tasks] = await Promise.all([
    prisma.maintenanceSchedule.findMany({
      where: { workspaceId },
      orderBy: { nextDueDate: "asc" },
      include: {
        component: {
          select: { id: true, name: true, system: { select: { name: true } } },
        },
      },
    }),
    prisma.task.findMany({
      where: {
        workspaceId,
        kind: "ONE_TIME",
        status: { in: [...BOARD_STATUSES] },
        scheduleId: { not: null },
      },
      select: {
        id: true,
        scheduleId: true,
        board: true,
        dueAt: true,
        status: true,
      },
    }),
  ]);

  const places: Record<string, SchedulePlace> = {};
  for (const row of rows) {
    places[row.component.id] = {
      system: row.component.system.name,
      component: row.component.name,
    };
  }

  return {
    schedules: rows.map((row) => mapSchedule(row)),
    openCards: tasks.map((task) => ({
      id: task.id,
      scheduleId: task.scheduleId,
      board: task.board,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
      status: task.status,
    })),
    places,
  };
}
