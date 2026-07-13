import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const raw = process.env.DATABASE_URL ?? "file:./dev.db";
let url = raw;
if (raw.startsWith("file:")) {
  const filePath = raw.slice("file:".length);
  if (!path.isAbsolute(filePath)) {
    url = `file:${path.resolve(process.cwd(), filePath)}`;
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
});

const DEFAULT_AREAS = [
  { name: "Work", slug: "work", color: "#6366f1", icon: "briefcase", sortOrder: 0 },
  { name: "Life", slug: "life", color: "#f59e0b", icon: "heart", sortOrder: 1 },
];

for (const w of await prisma.workspace.findMany()) {
  const areas = await prisma.area.findMany({ where: { workspaceId: w.id } });
  const bySlug = new Map(areas.map((a) => [a.slug, a]));

  for (const def of DEFAULT_AREAS) {
    if (!bySlug.has(def.slug)) {
      const created = await prisma.area.create({
        data: { workspaceId: w.id, ...def },
      });
      bySlug.set(def.slug, created);
      console.log(`${w.name}: created ${def.slug}`);
    }
  }

  const home = bySlug.get("home");
  const life = bySlug.get("life");
  if (home && life) {
    const moved = await prisma.task.updateMany({
      where: { workspaceId: w.id, areaId: home.id },
      data: { areaId: life.id },
    });
    await prisma.area.delete({ where: { id: home.id } });
    console.log(`${w.name}: moved ${moved.count} home→life, deleted Home area`);
  } else if (home && !life) {
    await prisma.area.update({
      where: { id: home.id },
      data: {
        name: "Life",
        slug: "life",
        color: "#f59e0b",
        icon: "heart",
        sortOrder: 1,
      },
    });
    console.log(`${w.name}: renamed home→life`);
  } else {
    console.log(`${w.name}: work/life only already`);
  }
}

await prisma.$disconnect();
