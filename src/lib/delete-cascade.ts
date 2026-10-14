import type { Prisma, PrismaClient } from "@/generated/prisma/client";

/**
 * Tasks that would be orphaned if these components or schedules went away.
 * Component and schedule links are SetNull, so the tasks have to be deleted
 * first, in the same transaction as the parent row.
 */
export function componentTaskWhere(
  workspaceId: string,
  componentIds: string[],
  scheduleIds: string[],
): Prisma.TaskWhereInput | null {
  const OR: Prisma.TaskWhereInput[] = [];
  if (componentIds.length > 0) OR.push({ componentId: { in: componentIds } });
  if (scheduleIds.length > 0) OR.push({ scheduleId: { in: scheduleIds } });
  if (OR.length === 0) return null;
  return { workspaceId, OR };
}

/** Delete the component's tasks, then the component. Schedules cascade. */
export async function deleteComponentCascade(
  db: PrismaClient,
  args: { workspaceId: string; systemId: string; componentId: string },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.component.findFirst({
      where: {
        id: args.componentId,
        systemId: args.systemId,
        workspaceId: args.workspaceId,
      },
      select: { id: true, schedules: { select: { id: true } } },
    });
    if (!existing) return false;
    const where = componentTaskWhere(
      args.workspaceId,
      [existing.id],
      existing.schedules.map((schedule) => schedule.id),
    );
    if (where) await tx.task.deleteMany({ where });
    await tx.component.delete({ where: { id: existing.id } });
    await tx.system.update({
      where: { id: args.systemId },
      data: { updatedAt: new Date() },
    });
    return true;
  });
}

/** Delete every task on the system's components and their schedules, then the system. */
export async function deleteSystemCascade(
  db: PrismaClient,
  args: { workspaceId: string; systemId: string },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.system.findFirst({
      where: { id: args.systemId, workspaceId: args.workspaceId },
      select: {
        id: true,
        components: {
          select: { id: true, schedules: { select: { id: true } } },
        },
      },
    });
    if (!existing) return false;
    const componentIds = existing.components.map((component) => component.id);
    const scheduleIds = existing.components.flatMap((component) =>
      component.schedules.map((schedule) => schedule.id),
    );
    const where = componentTaskWhere(args.workspaceId, componentIds, scheduleIds);
    if (where) await tx.task.deleteMany({ where });
    await tx.system.delete({ where: { id: existing.id } });
    return true;
  });
}
