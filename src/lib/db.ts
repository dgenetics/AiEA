import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
