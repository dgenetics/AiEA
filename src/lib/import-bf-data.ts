/**
 * Idempotent copy of bf-maintenance rows into this database.
 *
 * Sources, in order:
 * 1. BF_SOURCE_DATABASE_URL (+ optional BF_SOURCE_AUTH_TOKEN) — the old Turso/sqlite DB.
 * 2. A MaintenanceTask table already sitting in this database.
 *
 * Existing Task rows are never deleted. Open chores become ACTIVE Tasks.
 * Re-runs insert missing ids and fill schedule links; they do not overwrite edits.
 *
 * Call this from scripts/import-bf-data.ts only. Pass the target workspace id.
 * Open chores for one schedule are reduced to a single open task before any
 * Task insert or update, so Task_one_open_per_schedule cannot fail mid-import.
 * All writes are one transaction.
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

export async function importBfMaintenance(opts: {
  workspaceId: string;
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

  const workspaceId = opts.workspaceId?.trim();
  if (!workspaceId) {
    return { ...empty, skipped: "workspace id is required" };
  }
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return { ...empty, skipped: "workspace not found" };

  const report: ImportReport = { ...empty, workspaceId: workspace.id };
  report.openBefore = bundle.tasks.filter((t) =>
    isOpenBfStatus(str(t, "status")),
  ).length;

  await prisma.$transaction(
    async (tx) => {
      await writeImport(tx, workspace.id, bundle, report);
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  console.log("[import-bf]", JSON.stringify(report));
  return report;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function writeImport(
  tx: Tx,
  workspaceId: string,
  bundle: { systems: TableRow[]; components: TableRow[]; schedules: TableRow[]; tasks: TableRow[] },
  report: ImportReport,
) {
  for (const row of bundle.systems) {
    const id = str(row, "id");
    if (!id) continue;
    const existing = await tx.system.findUnique({ where: { id } });
    if (existing) continue;
    await tx.system.create({
      data: {
        id,
        workspaceId,
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
    const existing = await tx.component.findUnique({ where: { id } });
    if (existing) continue;
    const system = await tx.system.findFirst({
      where: { id: systemId, workspaceId },
    });
    if (!system) continue;
    await tx.component.create({
      data: {
        id,
        workspaceId,
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
    const existing = await tx.maintenanceSchedule.findUnique({ where: { id } });
    if (existing) continue;
    const component = await tx.component.findFirst({
      where: { id: componentId, workspaceId },
    });
    if (!component) continue;
    await tx.maintenanceSchedule.create({
      data: {
        id,
        workspaceId,
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

  // One open task per schedule is decided before any Task write.
  const existingOpen = await tx.task.findMany({
    where: {
      workspaceId,
      scheduleId: { not: null },
      status: { in: [...OPEN_TASK_STATUSES] },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const openHolder = new Map<string, string>();
  for (const task of existingOpen) {
    const key = task.scheduleId;
    if (!key) continue;
    if (openHolder.has(key)) {
      await tx.task.update({
        where: { id: task.id },
        data: { status: "CANCELLED" },
      });
      report.duplicatesCancelled += 1;
      continue;
    }
    openHolder.set(key, task.id);
  }

  const incoming = bundle.tasks
    .map((row) => {
      const bfId = str(row, "id");
      const due = dateOrNull(row, "dueDate") ?? new Date();
      return { row, bfId, due };
    })
    .filter((item) => item.bfId)
    .sort((a, b) => a.due.getTime() - b.due.getTime() || a.bfId.localeCompare(b.bfId));

  for (const item of incoming) {
    const row = item.row;
    const bfId = item.bfId;
    const externalId = `bf-task:${bfId}`;
    const statusRaw = str(row, "status");
    const due = item.due;
    const scheduleKey = strOrNull(row, "scheduleId");
    const componentId = str(row, "componentId");
    const component = componentId
      ? await tx.component.findFirst({
          where: { id: componentId, workspaceId },
        })
      : null;
    const schedule = scheduleKey
      ? await tx.maintenanceSchedule.findFirst({
          where: { id: scheduleKey, workspaceId },
        })
      : null;

    const linked = await tx.task.findFirst({
      where: {
        workspaceId,
        externalSource: "bf-maintenance",
        externalId,
      },
    });

    const open = isOpenBfStatus(statusRaw);
    const done = statusRaw === "COMPLETED";
    const cancelled = statusRaw === "CANCELLED";
    const scheduleId = schedule?.id ?? null;
    let stayOpen = false;
    if (open && scheduleId) {
      const holder = openHolder.get(scheduleId);
      if (!holder || holder === linked?.id) {
        stayOpen = true;
        openHolder.set(scheduleId, linked?.id ?? externalId);
      }
    } else if (open && !scheduleId) {
      stayOpen = true;
    }
    const status = stayOpen
      ? "ACTIVE"
      : open
        ? "CANCELLED"
        : done
          ? "DONE"
          : cancelled
            ? "CANCELLED"
            : "CANCELLED";
    const board = stayOpen ? boardForScheduleDue(due) : "BACKLOG";
    if (open && scheduleId && !stayOpen) report.duplicatesCancelled += 1;

    if (linked) {
      const promote = linked.status === "PROPOSED" || linked.status === "INBOX";
      await tx.task.update({
        where: { id: linked.id },
        data: {
          scheduleId: linked.scheduleId ?? scheduleId,
          componentId: linked.componentId ?? component?.id ?? null,
          recurrenceRule: null,
          ...(stayOpen && promote
            ? { status: "ACTIVE", ...laneWrite(boardForScheduleDue(linked.dueAt ?? due)) }
            : {}),
          ...(!stayOpen && open ? { status: "CANCELLED" } : {}),
        },
      });
      report.tasksLinked += 1;
      continue;
    }

    await tx.task.create({
      data: {
        workspaceId,
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
        scheduleId,
        componentId: component?.id ?? null,
      },
    });
    report.tasksCreated += 1;
  }

  const leftovers = await tx.task.findMany({
    where: {
      workspaceId,
      externalSource: "bf-maintenance",
      status: { in: ["PROPOSED", "INBOX"] },
    },
  });
  for (const task of leftovers) {
    const key = task.scheduleId;
    const holder = key ? openHolder.get(key) : undefined;
    const canOpen = !key || !holder || holder === task.id;
    if (key && canOpen) openHolder.set(key, task.id);
    await tx.task.update({
      where: { id: task.id },
      data: canOpen
        ? {
            status: "ACTIVE",
            recurrenceRule: null,
            ...laneWrite(boardForScheduleDue(task.dueAt ?? new Date())),
          }
        : { status: "CANCELLED", recurrenceRule: null },
    });
    if (!canOpen) report.duplicatesCancelled += 1;
  }

  const schedules = await tx.maintenanceSchedule.findMany({
    where: { workspaceId, isRecurring: true },
  });
  for (const schedule of schedules) {
    if (openHolder.has(schedule.id)) continue;
    const open = await tx.task.findFirst({
      where: {
        scheduleId: schedule.id,
        status: { in: [...OPEN_TASK_STATUSES] },
      },
    });
    if (open) {
      openHolder.set(schedule.id, open.id);
      continue;
    }
    const created = await tx.task.create({
      data: {
        workspaceId,
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
    openHolder.set(schedule.id, created.id);
    report.materialized += 1;
  }

  report.openAfter = await tx.task.count({
    where: {
      workspaceId,
      scheduleId: { not: null },
      status: { in: [...OPEN_TASK_STATUSES] },
    },
  });
}
