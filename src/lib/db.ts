import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  /** Bump when schema fields change so HMR picks up a fresh client */
  prismaSchemaVersion?: string;
};

/** Increment when adding Prisma fields so dev doesn't keep a stale client. */
const SCHEMA_VERSION = "checkins-v1";

function createClient() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  // Prisma CLI resolves file:./ relative to project root — match that here.
  let url = raw;
  if (raw.startsWith("file:")) {
    const filePath = raw.slice("file:".length);
    if (!path.isAbsolute(filePath)) {
      url = `file:${path.resolve(process.cwd(), filePath)}`;
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
