/**
 * Schema for durable Turso is applied offline via:
 *   npm run db:push:turso
 * Local SQLite uses prisma migrate / db push against DATABASE_URL.
 *
 * Cold-start also self-heals critical columns that Vercel builds do not migrate
 * (build = `prisma generate && next build` only).
 */

let tursoEnsurePromise: Promise<void> | null = null;

export function ensureSqliteSchema(_dbPath?: string) {
  void _dbPath;
  // no-op — kept so old imports do not break
}

/** Idempotent: ensure Task.board (+ index) exists on Turso. No-op without TURSO_DATABASE_URL. */
export function ensureTursoSchema(): Promise<void> {
  if (!process.env.TURSO_DATABASE_URL?.trim()) return Promise.resolve();
  if (!tursoEnsurePromise) {
    tursoEnsurePromise = ensureTursoSchemaInner().catch((err) => {
      tursoEnsurePromise = null;
      throw err;
    });
  }
  return tursoEnsurePromise;
}

async function ensureTursoSchemaInner() {
  const url = process.env.TURSO_DATABASE_URL!.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url, authToken });

  try {
    const cols = await client.execute(`PRAGMA table_info("Task")`);
    const names = new Set(cols.rows.map((r) => String(r.name)));
    if (names.has("board")) return;

    console.warn(
      "[ensure-schema] Task.board missing on Turso — applying board migration",
    );

    await client.execute(
      `ALTER TABLE "Task" ADD COLUMN "board" TEXT NOT NULL DEFAULT 'BACKLOG'`,
    );
    await client.execute(
      `UPDATE "Task" SET "board" = 'CURRENT' WHERE "priority" IS NOT NULL AND "priority" <= 2`,
    );
    await client.execute(
      `UPDATE "Task" SET "board" = 'ICEBOX' WHERE "priority" IS NOT NULL AND "priority" >= 4`,
    );
    await client.execute(
      `UPDATE "Task" SET "board" = 'BACKLOG' WHERE "priority" IS NULL OR ("priority" > 2 AND "priority" < 4)`,
    );

    try {
      await client.execute(
        `CREATE INDEX "Task_workspaceId_board_idx" ON "Task"("workspaceId", "board")`,
      );
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (!/already exists/i.test(msg)) throw e;
    }
  } finally {
    client.close();
  }
}
