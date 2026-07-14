import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const SCHEMA_VERSION = "turso-durable-v1";

/**
 * Production (Vercel): Turso libSQL — durable, serverless-friendly SQLite.
 *   Requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (Marketplace free Starter).
 * Local dev: file SQLite via DATABASE_URL (default file:./dev.db).
 */
function createClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaLibSql } =
      require("@prisma/adapter-libsql") as typeof import("@prisma/adapter-libsql");
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: tursoToken,
    });
    return new PrismaClient({ adapter });
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaBetterSqlite3 } =
    require("@prisma/adapter-better-sqlite3") as typeof import("@prisma/adapter-better-sqlite3");

  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  let url = raw;
  if (raw.startsWith("file:")) {
    const filePath = raw.slice("file:".length);
    if (!path.isAbsolute(filePath)) {
      url = `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), filePath)}`;
    }
  }

  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

function getClient() {
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaVersion !== SCHEMA_VERSION
  ) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
    globalForPrisma.prismaSchemaVersion = SCHEMA_VERSION;
  }
  return globalForPrisma.prisma;
}

export const prisma = getClient();
