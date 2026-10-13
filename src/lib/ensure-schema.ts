/**
 * Schema changes are not applied on boot.
 * Run scripts/push-turso-schema.mjs offline. Import with scripts/import-bf-data.ts.
 */

export function ensureSqliteSchema(_dbPath?: string) {
  void _dbPath;
}

export function ensureAppSchema(): Promise<void> {
  return Promise.resolve();
}
