import { prisma } from "@/lib/db";
import { nextOccurrence, parseRecurrenceRule, stringifyRecurrenceRule } from "@/lib/recurrence";
import type { ProposedItem } from "@/lib/types";
import { addHours } from "date-fns";

const DEFAULT_AREAS = [
  { name: "Work", slug: "work", color: "#6366f1", icon: "briefcase", sortOrder: 0 },
  { name: "Home", slug: "home", color: "#14b8a6", icon: "home", sortOrder: 1 },
  { name: "Life", slug: "life", color: "#f59e0b", icon: "heart", sortOrder: 2 },
];

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
  const home = workspace.areas.find((a) => a.slug === "home");
  const life = workspace.areas.find((a) => a.slug === "life");

  await prisma.task.createMany({
    data: [
      {
        workspaceId: workspace.id,
        areaId: work?.id,
        title: "Capture everything on your mind in Inbox",
        kind: "ONE_TIME",
        status: "ACTIVE",
        priority: 2,
        dueAt: new Date(),
        estimateMinutes: 10,
        aiRationale: "Starter task — dump open loops so AiEA can organize them.",
      },
      {
        workspaceId: workspace.id,
        areaId: home?.id,
        title: "Set trash / recycling night",
        kind: "ONE_TIME",
        status: "ACTIVE",
        priority: 3,
        dueAt: addHours(new Date(), 48),
        estimateMinutes: 5,
      },
      {
        workspaceId: workspace.id,
        areaId: life?.id,
        title: `Welcome, ${userName.split(" ")[0]} — review your Daily Brief`,
        kind: "ONE_TIME",
        status: "ACTIVE",
        priority: 1,
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
  const areas = await prisma.area.findMany({ where: { workspaceId } });
  const areaBySlug = new Map(areas.map((a) => [a.slug, a.id]));

  const createdTaskIds: string[] = [];

  for (const item of proposals) {
    if (!selectedIds.includes(item.id) || item.dismissed) continue;

    const personId = item.personName
      ? await ensurePerson(workspaceId, item.personName)
      : null;

    const areaId =
      (item.areaSlug && areaBySlug.get(item.areaSlug)) || areaBySlug.get("life") || null;

    const dueAt = item.dueAt ? new Date(item.dueAt) : null;
    const scheduledFor = item.scheduledFor ? new Date(item.scheduledFor) : dueAt;
    const followUpDueAt = item.followUpDueAt ? new Date(item.followUpDueAt) : null;

    if (item.kind === "RECURRING_TEMPLATE") {
      const rule = item.recurrenceRule ?? {
        frequency: "weekly" as const,
        interval: 1,
        time: "09:00",
      };
      const next = nextOccurrence(rule);

      const template = await prisma.task.create({
        data: {
          workspaceId,
          areaId,
          personId,
          title: item.title,
          notes: item.notes,
          kind: "RECURRING_TEMPLATE",
          status: "ACTIVE",
          priority: item.priority ?? 3,
          estimateMinutes: item.estimateMinutes ?? 15,
          recurrenceRule: stringifyRecurrenceRule(rule),
          nextOccurrenceAt: next,
          isFollowUp: false,
          aiRationale: item.aiRationale,
          sourceCaptureId: captureId,
        },
      });

      const occurrence = await prisma.task.create({
        data: {
          workspaceId,
          areaId,
          personId,
          parentId: template.id,
          title: item.title,
          notes: item.notes,
          kind: "OCCURRENCE",
          status: "ACTIVE",
          priority: item.priority ?? 3,
          dueAt: next,
          scheduledFor: next,
          estimateMinutes: item.estimateMinutes ?? 15,
          aiRationale: "Generated from recurring template",
          sourceCaptureId: captureId,
        },
      });

      await prisma.reminder.create({
        data: {
          workspaceId,
          taskId: occurrence.id,
          title: item.title,
          body: "Recurring task due",
          fireAt: next,
          channel: "IN_APP",
        },
      });

      createdTaskIds.push(template.id, occurrence.id);
    } else {
      const task = await prisma.task.create({
        data: {
          workspaceId,
          areaId,
          personId,
          title: item.title,
          notes: item.notes,
          kind: "ONE_TIME",
          status: "ACTIVE",
          priority: item.priority ?? 3,
          dueAt: item.isFollowUp ? followUpDueAt || dueAt : dueAt,
          scheduledFor,
          estimateMinutes: item.estimateMinutes ?? 30,
          isFollowUp: Boolean(item.isFollowUp),
          followUpDueAt: item.isFollowUp ? followUpDueAt || dueAt : null,
          aiRationale: item.aiRationale,
          sourceCaptureId: captureId,
        },
      });

      if (task.dueAt || task.followUpDueAt) {
        const fireAt = task.followUpDueAt || task.dueAt!;
        // Morning-of or 2h before if same day; otherwise day-of 9am-ish handled by fireAt itself
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

export async function materializeDueOccurrences(workspaceId?: string) {
  const templates = await prisma.task.findMany({
    where: {
      kind: "RECURRING_TEMPLATE",
      status: "ACTIVE",
      ...(workspaceId ? { workspaceId } : {}),
      nextOccurrenceAt: { lte: new Date() },
    },
  });

  let created = 0;
  for (const template of templates) {
    const rule = parseRecurrenceRule(template.recurrenceRule);
    if (!rule || !template.nextOccurrenceAt) continue;

    const existing = await prisma.task.findFirst({
      where: {
        parentId: template.id,
        kind: "OCCURRENCE",
        dueAt: template.nextOccurrenceAt,
        status: { not: "CANCELLED" },
      },
    });

    if (!existing) {
      const occurrence = await prisma.task.create({
        data: {
          workspaceId: template.workspaceId,
          areaId: template.areaId,
          projectId: template.projectId,
          personId: template.personId,
          parentId: template.id,
          title: template.title,
          notes: template.notes,
          kind: "OCCURRENCE",
          status: "ACTIVE",
          priority: template.priority,
          dueAt: template.nextOccurrenceAt,
          scheduledFor: template.nextOccurrenceAt,
          estimateMinutes: template.estimateMinutes,
          aiRationale: "Auto-generated occurrence",
        },
      });

      await prisma.reminder.create({
        data: {
          workspaceId: template.workspaceId,
          taskId: occurrence.id,
          title: template.title,
          body: "Recurring task is due",
          fireAt: template.nextOccurrenceAt,
          channel: "IN_APP",
        },
      });
      created++;
    }

    const next = nextOccurrence(rule, template.nextOccurrenceAt);
    await prisma.task.update({
      where: { id: template.id },
      data: { nextOccurrenceAt: next },
    });
  }

  return created;
}
