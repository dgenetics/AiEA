/**
 * Cold-start schema heal.
 * Local SQLite is usually created with `prisma db push`.
 * Turso production is migrated by this hook when a deploy has not run
 * `scripts/push-turso-schema.mjs` yet.
 *
 * The farm migration SQL copies every Task row. It runs only when Task
 * still lacks scheduleId, so a second boot does not rebuild the table.
 */
import fs from "node:fs";
import path from "node:path";

let ensurePromise: Promise<void> | null = null;

export function ensureSqliteSchema(_dbPath?: string) {
  void _dbPath;
}

export function ensureAppSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = ensureAppSchemaInner().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

/** @deprecated use ensureAppSchema */
export function ensureTursoSchema(): Promise<void> {
  return ensureAppSchema();
}

function statementsFrom(sql: string): string[] {
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function ensureAppSchemaInner() {
  const { prisma } = await import("@/lib/db");

  const taskTables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='Task'",
  );
  if (taskTables.length === 0) return;

  const cols = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    `PRAGMA table_info("Task")`,
  );
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("board")) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Task" ADD COLUMN "board" TEXT NOT NULL DEFAULT 'BACKLOG'`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "board" = 'CURRENT' WHERE "priority" IS NOT NULL AND "priority" <= 2`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "board" = 'ICEBOX' WHERE "priority" IS NOT NULL AND "priority" >= 4`,
    );
  }

  if (!names.has("scheduleId")) {
    const sqlPath = path.join(
      process.cwd(),
      "prisma/migrations/20261013140000_farm_manager/migration.sql",
    );
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, "utf8");
      for (const statement of statementsFrom(sql)) {
        await prisma.$executeRawUnsafe(statement);
      }
    }
  } else {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Task_one_open_per_schedule" ON "Task"("scheduleId") WHERE "scheduleId" IS NOT NULL AND "status" IN ('ACTIVE', 'INBOX', 'SNOOZED')`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "Task" SET "status" = 'ACTIVE' WHERE "status" IN ('PROPOSED', 'INBOX')`,
    );
  }

  try {
    const { importBfMaintenance } = await import("@/lib/import-bf-data");
    await importBfMaintenance();
  } catch (err) {
    console.error("[ensure-schema] bf import failed:", err);
  }
}
