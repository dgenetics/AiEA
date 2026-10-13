/**
 * Move bf-maintenance rows into this app's database.
 * Idempotent. Set BF_SOURCE_DATABASE_URL (and BF_SOURCE_AUTH_TOKEN for Turso).
 *
 *   npx tsx scripts/import-bf-data.ts
 */
import { importBfMaintenance } from "../src/lib/import-bf-data";

const report = await importBfMaintenance();
console.log(JSON.stringify(report, null, 2));
