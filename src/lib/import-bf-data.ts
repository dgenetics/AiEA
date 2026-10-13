/**
 * Idempotent copy of bf-maintenance rows into this database.
 *
 * Sources, in order:
 * 1. BF_SOURCE_DATABASE_URL (+ optional BF_SOURCE_AUTH_TOKEN) — the old Turso/sqlite DB.
 * 2. A MaintenanceTask table already sitting in this database.
 *
 * Existing Task rows are never deleted. Open chores become ACTIVE Tasks.
 * Re-runs insert missing ids and fill schedule links; they do not overwrite edits.
 */
import { createClient, type Client, type Row } from "@libsql/client";
import { laneWrite } from "@/lib/board";
import { prisma } from "@/lib/db";
import { normalizeCategory } from "@/lib/farm-types";
import { boardForScheduleDue, OPEN_TASK_STATUSES } from "@/lib/schedule-tasks";

type TableRow = Record<string, unknown>;

export type ImportReport = {
  skipped?: string;
  workspaceId?: string;
  systems: number;
  components: number;
  schedules: number;
  tasksCreated: number;
  tasksLinked: number;
  duplicatesCancelled: number;
  materialized: number;
  openBefore: number;
  openAfter: number;
};

function str(row: TableRow, key: string): string {
  const v = row[key];
  return v == null ? "" : String(v);
}

function strOrNull(row: TableRow, key: string): string | null {
  const v = row[key];
  if (v == null || v === "") return null;
  return String(v);
}

function numOrNull(row: TableRow, key: string): number | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(row: TableRow, key: string): Date | null {
  const v = row[key];
  if (v == null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function asRows(result: { rows: Row[] }): TableRow[] {
  return result.rows.map((r) => ({ ...(r as object) }) as TableRow);
}

async function readSource(url: string, authToken?: string) {
  const client: Client = createClient({ url, authToken });
  try {
    const tables = asRows(
      await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ),
    );
    const names = new Set(tables.map((t) => str(t, "name")));
    if (!names.has("System") || !names.has("Component")) {
      return null;
    }
    const systems = asRows(await client.execute('SELECT * FROM "System"'));
    const components = asRows(await client.execute('SELECT * FROM "Component"'));
    const schedules = names.has("MaintenanceSchedule")
      ? asRows(await client.execute('SELECT * FROM "MaintenanceSchedule"'))
      : [];
    const tasks = names.has("MaintenanceTask")
      ? asRows(await client.execute('SELECT * FROM "MaintenanceTask"'))
      : [];
    return { systems, components, schedules, tasks };
  } finally {
    client.close();
  }
}

async function readLocalLegacy() {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('System','MaintenanceTask')",
  );
  const names = new Set(tables.map((t) => t.name));
  // The new System table is ours. Only treat a legacy dump as a source when
  // MaintenanceTask is still present (bf's chore table, which we do not create).
  if (!names.has("MaintenanceTask")) return null;
  const systems = await prisma.$queryRawUnsafe<TableRow[]>('SELECT * FROM "System"');
  const components = await prisma.$queryRawUnsafe<TableRow[]>(
    'SELECT * FROM "Component"',
  );
  const schedules = await prisma.$queryRawUnsafe<TableRow[]>(
    'SELECT * FROM "MaintenanceSchedule"',
  ).catch(() => [] as TableRow[]);
  const tasks = await prisma.$queryRawUnsafe<TableRow[]>(
    'SELECT * FROM "MaintenanceTask"',
  );
  return { systems, components, schedules, tasks };
}

function isOpenBfStatus(status: string) {
  return status === "PENDING" || status === "DUE_SOON" || status === "OVERDUE";
}

export async function importBfMaintenance(opts?: {
  sourceUrl?: string;
  sourceToken?: string;
}): Promise<ImportReport> {
  const empty: ImportReport = {
    systems: 0,
    components: 0,
    schedules: 0,
    tasksCreated: 0,
    tasksLinked: 0,
    duplicatesCancelled: 0,
    materialized: 0,
    openBefore: 0,
    openAfter: 0,
  };

  const sourceUrl =
    opts?.sourceUrl?.trim() || process.env.BF_SOURCE_DATABASE_URL?.trim() || "";
  const sourceToken =
    opts?.sourceToken?.trim() || process.env.BF_SOURCE_AUTH_TOKEN?.trim() || undefined;

  let bundle: Awaited<ReturnType<typeof readSource>> = null;
  if (sourceUrl) {
    try {
      bundle = await readSource(sourceUrl, sourceToken);
    } catch (err) {
      console.error("[import-bf] source read failed:", err);
      return { ...empty, skipped: "source read failed" };
    }
  }
  if (!bundle) {
    try {
      bundle = await readLocalLegacy();
    } catch (err) {
      console.error("[import-bf] local legacy read failed:", err);
      return { ...empty, skipped: "no source" };
    }
  }
  if (!bundle) return { ...empty, skipped: "no source" };

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return { ...empty, skipped: "no workspace" };

  const report: ImportReport = { ...empty, workspaceId: workspace.id };
  report.openBefore = bundle.tasks.filter((t) =>
    isOpenBfStatus(str(t, "status")),
  ).length;

  for (const row of bundle.systems) {
    const id = str(row, "id");
    if (!id) continue;
    const existing = await prisma.system.findUnique({ where: { id } });
    if (existing) continue;
    await prisma.system.create({
      data: {
        id,
        workspaceId: workspace.id,
        name: str(row, "name") || "Untitled system",
        category: normalizeCategory(str(row, "category")),
        notes: str(row, "notes"),
        createdAt: dateOrNull(row, "createdAt") ?? new Date(),
        updatedAt: dateOrNull(row, "updatedAt") ?? new Date(),
      },
    });
    report.systems += 1;
  }

  for (const row of bundle.components) {
    const id = str(row, "id");
    const systemId = str(row, "systemId");
    if (!id || !systemId) continue;
    const existing = await prisma.component.findUnique({ where: { id } });
    if (existing) continue;
    const system = await prisma.system.findFirst({
      where: { id: systemId, workspaceId: workspace.id },
    });
    if (!system) continue;
    await prisma.component.create({
      data: {
        id,
        workspaceId: workspace.id,
        systemId,
        name: str(row, "name") || "Part",
        location: str(row, "location"),
        modelNumber: str(row, "modelNumber"),
        productNumber: str(row, "productNumber"),
        serialNumber: str(row, "serialNumber"),
        manufacturer: str(row, "manufacturer"),
        warrantyInfo: str(row, "warrantyInfo"),
        userManual: str(row, "userManual"),
        vendorName: str(row, "vendorName"),
        vendorContact: str(row, "vendorContact"),
        serviceCompanyName: str(row, "serviceCompanyName"),
        serviceCompanyContact: str(row, "serviceCompanyContact"),
        purchaseDate: dateOrNull(row, "purchaseDate"),
        purchaseCost: numOrNull(row, "purchaseCost"),
        replacementCost: numOrNull(row, "replacementCost"),
        notes: str(row, "notes"),
        sortOrder: numOrNull(row, "sortOrder") ?? 0,
      },
    });
    report.components += 1;
  }

  for (const row of bundle.schedules) {
    const id = str(row, "id");
    const componentId = str(row, "componentId");
    const nextDue = dateOrNull(row, "nextDueDate");
    if (!id || !componentId || !nextDue) continue;
    const existing = await prisma.maintenanceSchedule.findUnique({ where: { id } });
    if (existing) continue;
    const component = await prisma.component.findFirst({
      where: { id: componentId, workspaceId: workspace.id },
    });
    if (!component) continue;
    await prisma.maintenanceSchedule.create({
      data: {
        id,
        workspaceId: workspace.id,
        componentId,
        name: str(row, "name") || "Schedule",
        description: strOrNull(row, "description"),
        frequency: strOrNull(row, "frequency"),
        intervalDays: numOrNull(row, "intervalDays"),
        isRecurring: row.isRecurring === false || row.isRecurring === 0 ? false : true,
        nextDueDate: nextDue,
        lastCompletedAt: dateOrNull(row, "lastCompletedAt"),
        createdAt: dateOrNull(row, "createdAt") ?? new Date(),
        updatedAt: dateOrNull(row, "updatedAt") ?? new Date(),
      },
    });
    report.schedules += 1;
  }

  for (const row of bundle.tasks) {
    const bfId = str(row, "id");
    if (!bfId) continue;
    const externalId = `bf-task:${bfId}`;
    const statusRaw = str(row, "status");
    const due = dateOrNull(row, "dueDate") ?? new Date();
    const scheduleId = strOrNull(row, "scheduleId");
    const componentId = str(row, "componentId");
    const component = componentId
      ? await prisma.component.findFirst({
          where: { id: componentId, workspaceId: workspace.id },
        })
      : null;
    const schedule = scheduleId
      ? await prisma.maintenanceSchedule.findFirst({
          where: { id: scheduleId, workspaceId: workspace.id },
        })
      : null;

    const linked = await prisma.task.findFirst({
      where: {
        workspaceId: workspace.id,
        externalSource: "bf-maintenance",
        externalId,
      },
    });

    const open = isOpenBfStatus(statusRaw);
    const done = statusRaw === "COMPLETED";
    const cancelled = statusRaw === "CANCELLED";
    const status = open ? "ACTIVE" : done ? "DONE" : cancelled ? "CANCELLED" : "ACTIVE";
    const board = open ? boardForScheduleDue(due) : done ? "BACKLOG" : "BACKLOG";

    if (linked) {
      const promote = linked.status === "PROPOSED" || linked.status === "INBOX";
      await prisma.task.update({
        where: { id: linked.id },
        data: {
          scheduleId: linked.scheduleId ?? schedule?.id ?? null,
          componentId: linked.componentId ?? component?.id ?? null,
          recurrenceRule: null,
          ...(promote
            ? { status: "ACTIVE", ...laneWrite(boardForScheduleDue(linked.dueAt ?? due)) }
            : {}),
        },
      });
      report.tasksLinked += 1;
      continue;
    }

    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: str(row, "title") || "Chore",
        notes: strOrNull(row, "completedNotes") ?? strOrNull(row, "description"),
        kind: "ONE_TIME",
        status,
        ...laneWrite(board),
        dueAt: due,
        completedAt: done ? dateOrNull(row, "completedAt") ?? due : null,
        recurrenceRule: null,
        externalSource: "bf-maintenance",
        externalId,
        scheduleId: schedule?.id ?? null,
        componentId: component?.id ?? null,
      },
    });
    report.tasksCreated += 1;
  }

  // Any previously imported farm tasks whose source row we just saw are linked above.
  // Promote leftovers that never matched a MaintenanceTask id.
  const leftovers = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      externalSource: "bf-maintenance",
      status: { in: ["PROPOSED", "INBOX"] },
    },
  });
  for (const task of leftovers) {
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "ACTIVE",
        recurrenceRule: null,
        ...laneWrite(boardForScheduleDue(task.dueAt ?? new Date())),
      },
    });
  }

  const openTasks = await prisma.task.findMany({
    where: {
      workspaceId: workspace.id,
      scheduleId: { not: null },
      status: { in: [...OPEN_TASK_STATUSES] },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });
  const seen = new Set<string>();
  for (const task of openTasks) {
    const key = task.scheduleId!;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    await prisma.task.update({
      where: { id: task.id },
      data: { status: "CANCELLED" },
    });
    report.duplicatesCancelled += 1;
  }

  const schedules = await prisma.maintenanceSchedule.findMany({
    where: { workspaceId: workspace.id, isRecurring: true },
  });
  for (const schedule of schedules) {
    const open = await prisma.task.findFirst({
      where: {
        scheduleId: schedule.id,
        status: { in: [...OPEN_TASK_STATUSES] },
      },
    });
    if (open) continue;
    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        scheduleId: schedule.id,
        componentId: schedule.componentId,
        title: schedule.name,
        notes: schedule.description,
        kind: "ONE_TIME",
        status: "ACTIVE",
        dueAt: schedule.nextDueDate,
        recurrenceRule: null,
        ...laneWrite(boardForScheduleDue(schedule.nextDueDate)),
      },
    });
    report.materialized += 1;
  }

  report.openAfter = await prisma.task.count({
    where: {
      workspaceId: workspace.id,
      scheduleId: { not: null },
      status: { in: [...OPEN_TASK_STATUSES] },
    },
  });

  console.log("[import-bf]", JSON.stringify(report));
  return report;
}
