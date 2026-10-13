/**
 * Copy bf-maintenance rows into one workspace. Not run on app startup.
 *
 *   FARM_IMPORT_WORKSPACE_ID=<id> \
 *   BF_SOURCE_DATABASE_URL=file:./bf.db \
 *   npx tsx scripts/import-bf-data.ts
 *
 *   npx tsx scripts/import-bf-data.ts --workspace <id>
 *
 * Back up the target first. A remote Turso target (TURSO_DATABASE_URL) is
 * refused unless FARM_IMPORT_ALLOW_REMOTE=1. A file: URL is local.
 */
function workspaceArg(): string {
  const index = process.argv.indexOf("--workspace");
  if (index === -1) return "";
  return process.argv[index + 1]?.trim() || "";
}

async function main() {
  const workspaceId = workspaceArg() || process.env.FARM_IMPORT_WORKSPACE_ID?.trim() || "";
  if (!workspaceId) {
    console.error("Pass --workspace <id> or set FARM_IMPORT_WORKSPACE_ID.");
    process.exit(1);
  }

  const targetUrl = process.env.TURSO_DATABASE_URL?.trim() || "";
  const remote = targetUrl.length > 0 && !targetUrl.startsWith("file:");
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
