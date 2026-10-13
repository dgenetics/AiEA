/**
 * Apply Prisma SQLite migrations to a libSQL database. Offline only.
 * App startup does not run this.
 *
 * Back up first. Preview and production share one Turso database.
 *   turso db shell <db-name> ".dump" > backup.sql
 *   # or: turso db create <db-name>-backup --from-db <db-name>
 *
 * Then, and only then:
 *   vercel env pull .env.vercel --environment=production --yes
 *   FARM_SCHEMA_PUSH=1 node --env-file=.env.vercel scripts/push-turso-schema.mjs
 *
 * A file: URL is local and does not need FARM_SCHEMA_PUSH.
 * The farm migration is one client.migrate() batch (foreign_keys off,
 * one transaction). It is recorded in _farm_schema_migrations in that
 * same batch. A second run skips it.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const FARM_MIGRATION = "20261013140000_farm_manager";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
  process.exit(1);
}

const remote = !url.startsWith("file:");
if (remote && process.env.FARM_SCHEMA_PUSH !== "1") {
  console.error("Refusing to change a remote database.");
  console.error('Back up first: turso db shell <db-name> ".dump" > backup.sql');
  console.error("Then re-run with FARM_SCHEMA_PUSH=1.");
  process.exit(1);
}

const client = createClient({ url, authToken });

function statementsFrom(sql) {
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const migrationsDir = path.join(process.cwd(), "prisma/migrations");
const dirs = fs
  .readdirSync(migrationsDir)
  .filter((d) => {
    try {
      return fs.statSync(path.join(migrationsDir, d)).isDirectory();
    } catch {
      return false;
    }
  })
  .sort();

await client.execute(
  `CREATE TABLE IF NOT EXISTS "_farm_schema_migrations" ("id" TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)`,
);
const applied = await client.execute(`SELECT "id" FROM "_farm_schema_migrations"`);
const appliedIds = new Set(applied.rows.map((r) => String(r.id)));

async function record(id) {
  await client.execute({
    sql: `INSERT INTO "_farm_schema_migrations" ("id", "appliedAt") VALUES (?, ?)`,
    args: [id, new Date().toISOString()],
  });
}

/** done = rebuild already happened. partial = stop and restore. needed = apply. */
async function farmState() {
  const task = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Task'`,
  );
  if (task.rows.length === 0) return "needed";
  const area = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='Area'`,
  );
  const cols = await client.execute(`PRAGMA table_info("Task")`);
  const hasSchedule = cols.rows.some((r) => String(r.name) === "scheduleId");
  const rebuilding = await client.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('new_Task', 'new_Workspace', 'new_CaptureBatch', 'new_Project')`,
  );
  if (rebuilding.rows.length > 0) return "partial";
  if (area.rows.length === 0 && hasSchedule) return "done";
  if (area.rows.length === 0 && !hasSchedule) return "partial";
  return "needed";
}

for (const d of dirs) {
  const sqlPath = path.join(migrationsDir, d, "migration.sql");
  if (!fs.existsSync(sqlPath)) continue;
  if (appliedIds.has(d)) {
    console.log("Already applied", d);
    continue;
  }

  if (d === FARM_MIGRATION) {
    const state = await farmState();
    if (state === "done") {
      await record(d);
      console.log("Farm schema already present (no Area, Task.scheduleId exists). Recorded", d);
      continue;
    }
    if (state === "partial") {
      console.error("Farm schema is only partly rebuilt (a new_* table is left, or Area is gone without Task.scheduleId).");
      console.error('Restore from backup: turso db shell <db-name> ".dump"');
      console.error("Do not re-run the table rebuild on this database.");
      process.exit(1);
    }
    const stmts = statementsFrom(fs.readFileSync(sqlPath, "utf8"));
    stmts.push({
      sql: `INSERT INTO "_farm_schema_migrations" ("id", "appliedAt") VALUES (?, ?)`,
      args: [d, new Date().toISOString()],
    });
    console.log("Applying", d, "in one migrate() transaction (foreign_keys off)");
    try {
      await client.migrate(stmts);
    } catch (e) {
      console.error("  FAIL:", String(e?.message || e));
      console.error("The batch was rolled back. Restore from backup if any earlier boot changed this database.");
      process.exit(1);
    }
    console.log("  ok");
    continue;
  }

  console.log("Applying", d);
  for (const s of statementsFrom(fs.readFileSync(sqlPath, "utf8"))) {
    try {
      await client.execute(s + ";");
    } catch (e) {
      const msg = String(e?.message || e);
      if (/already exists|duplicate column/i.test(msg)) {
        console.log("  skip:", msg.slice(0, 90));
        continue;
      }
      console.error("  FAIL:", msg);
      process.exit(1);
    }
  }
  await record(d);
  console.log("  ok");
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
console.log("tables:", tables.rows.map((r) => r.name).join(", "));
console.log("Schema ready. Remote changes require a backup and FARM_SCHEMA_PUSH=1.");
client.close();
