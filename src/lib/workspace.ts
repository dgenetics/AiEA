import { prisma } from "@/lib/db";
import { laneWrite, resolveBoard } from "@/lib/board";
import type { ProposedItem } from "@/lib/types";
import { parseDueDate } from "@/lib/calendar";
import { addHours } from "date-fns";

const DEFAULT_AREAS = [
  { name: "Work", slug: "work", color: "#6366f1", icon: "briefcase", sortOrder: 0 },
  { name: "Life", slug: "life", color: "#f59e0b", icon: "heart", sortOrder: 1 },
];

/**
 * Ensure only Work + Life areas exist. Migrates any legacy "home" tasks to Life
 * and deletes the Home area.
 */
export async function ensureWorkLifeAreas(workspaceId: string) {
  const areas = await prisma.area.findMany({ where: { workspaceId } });
  const bySlug = new Map(areas.map((a) => [a.slug, a]));

  for (const def of DEFAULT_AREAS) {
    if (!bySlug.has(def.slug)) {
      const created = await prisma.area.create({
        data: { workspaceId, ...def },
      });
      bySlug.set(def.slug, created);
    }
  }

  const home = bySlug.get("home");
  const life = bySlug.get("life");
  if (home && life) {
    await prisma.task.updateMany({
      where: { workspaceId, areaId: home.id },
      data: { areaId: life.id },
    });
    await prisma.area.delete({ where: { id: home.id } }).catch(() => undefined);
    bySlug.delete("home");
  } else if (home && !life) {
    await prisma.area.update({
      where: { id: home.id },
      data: {
        name: "Life",
        slug: "life",
        color: "#f59e0b",
        icon: "heart",
        sortOrder: 1,
      },
    });
  }

  return prisma.area.findMany({
    where: { workspaceId, slug: { in: ["work", "life"] } },
    orderBy: { sortOrder: "asc" },
  });
}

/** @deprecated use ensureWorkLifeAreas */
export const ensureWorkHomeAreas = ensureWorkLifeAreas;

export async function createWorkspaceForUser(userId: string, name: string, userName: string) {
  const baseSlug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "workspace";
  const slug = `${baseSlug}-${userId.slice(-6)}`;

  const workspace = await prisma.workspace.create({
    data: {
      name,
      slug,
      members: {
        create: { userId, role: "OWNER" },
      },
      areas: {
        create: DEFAULT_AREAS,
      },
    },
    include: { areas: true },
  });

  // Seed a few starter tasks so the dashboard isn't empty
  const work = workspace.areas.find((a) => a.slug === "work");
  const life = workspace.areas.find((a) => a.slug === "life");

  await prisma.task.createMany({
    data: [
      {
        workspaceId: workspace.id,
        areaId: work?.id,
        title: "Capture everything on your mind",
        kind: "ONE_TIME",
        status: "ACTIVE",
        ...laneWrite(resolveBoard({ priority: 2 })),
        dueAt: new Date(),
        estimateMinutes: 10,
        aiRationale: "Starter task — dump open loops so AiEA can organize them.",
      },
      {
        workspaceId: workspace.id,
        areaId: life?.id,
        title: "Set trash / recycling night",
        kind: "ONE_TIME",
        status: "ACTIVE",
        ...laneWrite("BACKLOG"),
        dueAt: addHours(new Date(), 48),
        estimateMinutes: 5,
      },
      {
        workspaceId: workspace.id,
        areaId: work?.id,
        title: `Welcome, ${userName.split(" ")[0]} — review your Daily Brief`,
        kind: "ONE_TIME",
        status: "ACTIVE",
        ...laneWrite("CURRENT"),
        dueAt: new Date(),
        estimateMinutes: 5,
      },
    ],
  });

  return workspace;
}

export async function ensurePerson(
  workspaceId: string,
  name: string,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = await prisma.person.findFirst({
    where: {
      workspaceId,
      name: { equals: trimmed },
    },
  });
  if (existing) return existing.id;

  const person = await prisma.person.create({
    data: { workspaceId, name: trimmed },
  });
  return person.id;
}

export async function acceptProposals(
  workspaceId: string,
  captureId: string,
  proposals: ProposedItem[],
  selectedIds: string[],
) {
  const areas = await ensureWorkLifeAreas(workspaceId);
  const areaBySlug = new Map(areas.map((a) => [a.slug, a.id]));

  const createdTaskIds: string[] = [];

  for (const item of proposals) {
    if (!selectedIds.includes(item.id) || item.dismissed) continue;

    const personId = item.personName
      ? await ensurePerson(workspaceId, item.personName)
      : null;

    // Map legacy "home" (or anything else) → life
    const slug = item.areaSlug === "work" ? "work" : "life";
    const areaId = areaBySlug.get(slug) || areaBySlug.get("life") || null;

    const dueAt = parseDueDate(item.dueAt);
    const scheduledFor = parseDueDate(item.scheduledFor) ?? dueAt;
    const followUpDueAt = parseDueDate(item.followUpDueAt);

    // Native recurring templates/occurrences are gone: cadence lives in BF
    // Maintenance and reaches AiEA only via the farm pull / linked-task bridge.
    // Any legacy RECURRING_TEMPLATE proposal is accepted as a plain one-time task.
    const task = await prisma.task.create({
      data: {
        workspaceId,
        areaId,
        personId,
        title: item.title,
        notes: item.notes,
        kind: "ONE_TIME",
        status: "ACTIVE",
        ...laneWrite(resolveBoard({ board: item.board, priority: item.priority ?? 3 })),
        dueAt: item.isFollowUp ? followUpDueAt || dueAt : dueAt,
        scheduledFor,
        estimateMinutes: item.estimateMinutes ?? 30,
        isFollowUp: Boolean(item.isFollowUp),
        followUpDueAt: item.isFollowUp ? followUpDueAt || dueAt : null,
        aiRationale: item.aiRationale,
        sourceCaptureId: captureId,
      },
    });

    // Create parts as child tasks with their own due dates
    if (item.subtasks?.length) {
      for (const part of item.subtasks) {
        const partDue = parseDueDate(part.dueAt) ?? dueAt;
        const child = await prisma.task.create({
          data: {
            workspaceId,
            parentId: task.id,
            areaId,
            personId,
            title: part.title,
            notes: part.notes || null,
            kind: "ONE_TIME",
            status: "ACTIVE",
            ...laneWrite(resolveBoard({ board: item.board, priority: item.priority ?? 3 })),
            dueAt: partDue,
            scheduledFor: partDue,
            estimateMinutes: 30,
            sourceCaptureId: captureId,
            aiRationale: "Subtask from capture",
          },
        });
        createdTaskIds.push(child.id);
      }
    }

    if (task.dueAt || task.followUpDueAt) {
      const fireAt = task.followUpDueAt || task.dueAt!;
      await prisma.reminder.create({
        data: {
          workspaceId,
          taskId: task.id,
          personId: personId ?? undefined,
          title: item.isFollowUp ? `Follow up: ${item.title}` : item.title,
          body: item.aiRationale || undefined,
          fireAt: fireAt < new Date() ? new Date() : fireAt,
          channel: "IN_APP",
        },
      });
    }

    if (personId) {
      await prisma.person.update({
        where: { id: personId },
        data: { updatedAt: new Date() },
      });
    }

    createdTaskIds.push(task.id);
  }

  const acceptedCount = selectedIds.length;
  const total = proposals.filter((p) => !p.dismissed).length;
  await prisma.captureBatch.update({
    where: { id: captureId },
    data: {
      status: acceptedCount >= total ? "ACCEPTED" : "PARTIALLY_ACCEPTED",
      proposals: JSON.stringify(
        proposals.map((p) => ({
          ...p,
          accepted: selectedIds.includes(p.id),
        })),
      ),
    },
  });

  return createdTaskIds;
}
