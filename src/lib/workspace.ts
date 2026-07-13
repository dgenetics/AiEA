import { prisma } from "@/lib/db";
import {
  advanceFrom,
  buildCheckInsForDay,
  dayBounds,
  enrichRuleWithTimes,
  getRuleTimes,
  isMultiSlot,
  nextOccurrence,
  parseRecurrenceRule,
  slotDateTime,
  stringifyCheckIns,
  stringifyRecurrenceRule,
} from "@/lib/recurrence";
import type { ProposedItem } from "@/lib/types";
import { addHours, startOfDay } from "date-fns";

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
        priority: 2,
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
        priority: 3,
        dueAt: addHours(new Date(), 48),
        estimateMinutes: 5,
      },
      {
        workspaceId: workspace.id,
        areaId: work?.id,
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

    const dueAt = item.dueAt ? new Date(item.dueAt) : null;
    const scheduledFor = item.scheduledFor ? new Date(item.scheduledFor) : dueAt;
    const followUpDueAt = item.followUpDueAt ? new Date(item.followUpDueAt) : null;

    if (item.kind === "RECURRING_TEMPLATE") {
      let rule = item.recurrenceRule ?? {
        frequency: "weekly" as const,
        interval: 1,
        time: "09:00",
      };
      rule = enrichRuleWithTimes(rule, item.notes, item.title);
      const next = nextOccurrence(rule);
      const times = getRuleTimes(rule);
      const checkIns = isMultiSlot(rule)
        ? buildCheckInsForDay(next, times)
        : null;
      const dueAt = checkIns
        ? slotDateTime(next, times[0]!)
        : next;

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
          dueAt,
          scheduledFor: dueAt,
          estimateMinutes: item.estimateMinutes ?? 15,
          checkIns: stringifyCheckIns(checkIns),
          recurrenceRule: stringifyRecurrenceRule(rule),
          aiRationale: checkIns
            ? `Multi-slot day: ${times.join(", ")}`
            : "Generated from recurring template",
          sourceCaptureId: captureId,
        },
      });

      for (const t of times) {
        await prisma.reminder.create({
          data: {
            workspaceId,
            taskId: occurrence.id,
            title: item.title,
            body:
              times.length > 1
                ? `Check-in due · ${t}`
                : "Recurring task due",
            fireAt: slotDateTime(next, t),
            channel: "IN_APP",
          },
        });
      }

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
  try {
    return await materializeDueOccurrencesInner(workspaceId);
  } catch (err) {
    console.error("materializeDueOccurrences failed:", err);
    return 0;
  }
}

async function materializeDueOccurrencesInner(workspaceId?: string) {
  // Also upgrade active templates whose notes imply multi-slot but rule lacks times
  const allTemplates = await prisma.task.findMany({
    where: {
      kind: "RECURRING_TEMPLATE",
      status: "ACTIVE",
      ...(workspaceId ? { workspaceId } : {}),
    },
  });

  for (const template of allTemplates) {
    let rule = parseRecurrenceRule(template.recurrenceRule);
    if (!rule) continue;
    const enriched = enrichRuleWithTimes(rule, template.notes, template.title);
    if (
      JSON.stringify(enriched.times ?? null) !== JSON.stringify(rule.times ?? null)
    ) {
      rule = enriched;
      await prisma.task.update({
        where: { id: template.id },
        data: { recurrenceRule: stringifyRecurrenceRule(rule) },
      });
      template.recurrenceRule = stringifyRecurrenceRule(rule);
    }
  }

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
    let rule = parseRecurrenceRule(template.recurrenceRule);
    if (!rule || !template.nextOccurrenceAt) continue;
    rule = enrichRuleWithTimes(rule, template.notes, template.title);
    const times = getRuleTimes(rule);
    const day = startOfDay(template.nextOccurrenceAt);
    const { start, end } = dayBounds(day);

    const existing = await prisma.task.findFirst({
      where: {
        parentId: template.id,
        kind: "OCCURRENCE",
        status: { not: "CANCELLED" },
        OR: [
          { dueAt: { gte: start, lte: end } },
          { scheduledFor: { gte: start, lte: end } },
        ],
      },
    });

    if (!existing) {
      const checkIns = isMultiSlot(rule) ? buildCheckInsForDay(day, times) : null;
      const dueAt = slotDateTime(day, times[0]!);

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
          dueAt,
          scheduledFor: dueAt,
          estimateMinutes: template.estimateMinutes,
          checkIns: stringifyCheckIns(checkIns),
          recurrenceRule: stringifyRecurrenceRule(rule),
          aiRationale: checkIns
            ? `Multi-slot day: ${times.join(", ")}`
            : "Auto-generated occurrence",
        },
      });

      for (const t of times) {
        await prisma.reminder.create({
          data: {
            workspaceId: template.workspaceId,
            taskId: occurrence.id,
            title: template.title,
            body:
              times.length > 1
                ? `Check-in due · ${t}`
                : "Recurring task is due",
            fireAt: slotDateTime(day, t),
            channel: "IN_APP",
          },
        });
      }
      created++;
    } else if (isMultiSlot(rule) && !existing.checkIns) {
      // Backfill multi-slot checkboxes on today's open occurrence
      await safeSetCheckIns(
        existing.id,
        stringifyCheckIns(buildCheckInsForDay(day, times)),
        stringifyRecurrenceRule(rule),
      );
    }

    // Advance template to next day only after today's occurrence exists
    const next = advanceFrom(rule, day);
    await prisma.task.update({
      where: { id: template.id },
      data: {
        nextOccurrenceAt: next,
        recurrenceRule: stringifyRecurrenceRule(rule),
      },
    });
  }

  // Ensure today's multi-slot occurrences exist even if nextOccurrenceAt was advanced early
  await ensureTodayMultiSlotOccurrences(workspaceId);

  return created;
}

/** Write checkIns even if a stale Prisma client rejects the field name. */
async function safeSetCheckIns(
  taskId: string,
  checkInsJson: string | null,
  recurrenceRuleJson: string | null,
) {
  try {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        checkIns: checkInsJson,
        ...(recurrenceRuleJson ? { recurrenceRule: recurrenceRuleJson } : {}),
      },
    });
  } catch (err) {
    console.warn("task.update(checkIns) failed, trying raw SQL:", err);
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "Task" SET "checkIns" = ?, "recurrenceRule" = COALESCE(?, "recurrenceRule") WHERE id = ?`,
        checkInsJson,
        recurrenceRuleJson,
        taskId,
      );
    } catch (rawErr) {
      console.error("safeSetCheckIns raw failed:", rawErr);
    }
  }
}

/** If a multi-slot template has no ACTIVE occurrence for today, create one. */
async function ensureTodayMultiSlotOccurrences(workspaceId?: string) {
  const today = new Date();
  const { start, end } = dayBounds(today);

  const templates = await prisma.task.findMany({
    where: {
      kind: "RECURRING_TEMPLATE",
      status: "ACTIVE",
      ...(workspaceId ? { workspaceId } : {}),
    },
  });

  for (const template of templates) {
    let rule = parseRecurrenceRule(template.recurrenceRule);
    if (!rule) continue;
    rule = enrichRuleWithTimes(rule, template.notes, template.title);
    if (!isMultiSlot(rule)) continue;

    const existing = await prisma.task.findFirst({
      where: {
        parentId: template.id,
        kind: "OCCURRENCE",
        status: "ACTIVE",
        OR: [
          { dueAt: { gte: start, lte: end } },
          { scheduledFor: { gte: start, lte: end } },
        ],
      },
    });
    if (existing) {
      if (!existing.checkIns) {
        await safeSetCheckIns(
          existing.id,
          stringifyCheckIns(buildCheckInsForDay(today, getRuleTimes(rule))),
          stringifyRecurrenceRule(rule),
        );
      }
      continue;
    }

    const times = getRuleTimes(rule);
    const dueAt = slotDateTime(today, times[0]!);
    try {
      await prisma.task.create({
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
          dueAt,
          scheduledFor: dueAt,
          estimateMinutes: template.estimateMinutes,
          checkIns: stringifyCheckIns(buildCheckInsForDay(today, times)),
          recurrenceRule: stringifyRecurrenceRule(rule),
          aiRationale: `Multi-slot day: ${times.join(", ")}`,
        },
      });
    } catch (err) {
      console.error("ensureToday multi-slot create failed:", err);
    }
  }
}
