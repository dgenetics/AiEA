/**
 * Next.js boot hook. Schema changes and the bf-maintenance import do not run
 * here. Preview and production share one Turso database, so a boot must not
 * migrate or copy rows. Apply SQL with scripts/push-turso-schema.mjs and
 * import with scripts/import-bf-data.ts, both offline.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
}
