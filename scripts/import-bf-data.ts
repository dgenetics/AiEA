/**
 * Copy bf-maintenance rows into one workspace. Not run on app startup.
 *
 * Local file database (DATABASE_URL, often dev.db) — explicit opt-in:
 *   npx tsx scripts/import-bf-data.ts --local --workspace <id>
 *
 * Production, after a backup, with env loaded from a pull (never put
 * BF_SOURCE_* in Vercel):
 *   FARM_IMPORT_ALLOW_REMOTE=1 \
 *   BF_SOURCE_DATABASE_URL="libsql://..." \
 *   BF_SOURCE_AUTH_TOKEN="..." \
 *   npx tsx --env-file=.env.vercel scripts/import-bf-data.ts --workspace <id>
 *
 * Without TURSO_DATABASE_URL the script stops unless --local is passed,
 * so it cannot write dev.db by accident. A remote target also needs
 * FARM_IMPORT_ALLOW_REMOTE=1.
 */
function flagValue(name: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1]?.trim() || "";
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const workspaceId = flagValue("--workspace") || process.env.FARM_IMPORT_WORKSPACE_ID?.trim() || "";
  if (!workspaceId) {
    console.error("Pass --workspace <id> or set FARM_IMPORT_WORKSPACE_ID.");
    process.exit(1);
  }

  const local = hasFlag("--local");
  const targetUrl = process.env.TURSO_DATABASE_URL?.trim() || "";
  const remote = targetUrl.length > 0 && !targetUrl.startsWith("file:");
  if (local && remote) {
    console.error("Refusing --local while TURSO_DATABASE_URL is a remote database.");
    console.error("Unset TURSO_DATABASE_URL to import into the file in DATABASE_URL.");
    process.exit(1);
  }
  if (!targetUrl && !local) {
    console.error("Refusing to import: TURSO_DATABASE_URL is unset.");
    console.error("That would write DATABASE_URL, which is often dev.db.");
    console.error("Pass --local to import into that file, or set TURSO_DATABASE_URL and FARM_IMPORT_ALLOW_REMOTE=1.");
    process.exit(1);
  }
  if (remote && process.env.FARM_IMPORT_ALLOW_REMOTE !== "1") {
    console.error("Refusing to import into a remote database.");
    console.error('Back up first: turso db shell <db-name> ".dump" > backup.sql');
    console.error("Then set FARM_IMPORT_ALLOW_REMOTE=1 and FARM_IMPORT_WORKSPACE_ID.");
    process.exit(1);
  }

  const { importBfMaintenance } = await import("../src/lib/import-bf-data");
  const report = await importBfMaintenance({ workspaceId });
  console.log(JSON.stringify(report, null, 2));
  if (report.skipped) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
