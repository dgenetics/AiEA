/**
 * Apply Prisma SQLite migrations to Turso (free long-term DB).
 *
 *   vercel env pull .env.vercel --environment=production --yes
 *   node --env-file=.env.vercel scripts/push-turso-schema.mjs
 *
 * Or set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the environment.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
if (!url) {
  console.error("Missing TURSO_DATABASE_URL");
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

for (const d of dirs) {
  const sqlPath = path.join(migrationsDir, d, "migration.sql");
  if (!fs.existsSync(sqlPath)) continue;
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
  console.log("  ok");
}

const tables = await client.execute(
  "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
);
console.log("tables:", tables.rows.map((r) => r.name).join(", "));
console.log("Turso schema ready (durable).");
