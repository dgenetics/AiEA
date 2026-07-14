/**
 * Schema for durable Turso is applied offline via:
 *   npm run db:push:turso
 * Local SQLite uses prisma migrate / db push against DATABASE_URL.
 */
export function ensureSqliteSchema(_dbPath?: string) {
  // no-op — kept so old imports do not break
}
