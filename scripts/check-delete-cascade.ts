/**
 * Component and system deletes remove tasks in the same transaction.
 * Schedule and component links are SetNull, so a plain parent delete orphans them.
 * Run: npm run test:delete-cascade
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  deleteComponentCascade,
  deleteSystemCascade,
} from "../src/lib/delete-cascade";

const dir = mkdtempSync(join(tmpdir(), "aiea-cascade-"));
const dbFile = join(dir, "cascade.db");
process.env.DATABASE_URL = `file:${dbFile}`;
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

execSync("npx prisma db push --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
});

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: `file:${dbFile}` }),
});

async function main() {
  const workspace = await prisma.workspace.create({
    data: { name: "Farm", slug: `farm-${Date.now()}` },
  });
  const other = await prisma.workspace.create({
    data: { name: "Other", slug: `other-${Date.now()}` },
  });

  const well = await prisma.system.create({
    data: { workspaceId: workspace.id, name: "Well house" },
  });
  const barn = await prisma.system.create({
    data: { workspaceId: workspace.id, name: "Barn" },
  });

  const pump = await prisma.component.create({
    data: { workspaceId: workspace.id, systemId: well.id, name: "Pump" },
  });
  const valve = await prisma.component.create({
    data: { workspaceId: workspace.id, systemId: well.id, name: "Valve" },
  });
  const door = await prisma.component.create({
    data: { workspaceId: workspace.id, systemId: barn.id, name: "Door" },
  });

  const oil = await prisma.maintenanceSchedule.create({
    data: {
      workspaceId: workspace.id,
      componentId: pump.id,
      name: "Change oil",
      nextDueDate: new Date("2026-10-01"),
    },
  });
  const filter = await prisma.maintenanceSchedule.create({
    data: {
      workspaceId: workspace.id,
      componentId: pump.id,
      name: "Replace filter",
      nextDueDate: new Date("2026-11-01"),
    },
  });
  const exercise = await prisma.maintenanceSchedule.create({
    data: {
      workspaceId: workspace.id,
      componentId: valve.id,
      name: "Exercise valve",
      nextDueDate: new Date("2026-12-01"),
    },
  });
  const grease = await prisma.maintenanceSchedule.create({
    data: {
      workspaceId: workspace.id,
      componentId: door.id,
      name: "Grease hinges",
      nextDueDate: new Date("2026-12-15"),
    },
  });

  const pumpTasks = await Promise.all([
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: "Open oil chore",
        componentId: pump.id,
        scheduleId: oil.id,
        status: "ACTIVE",
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: "Finished filter chore",
        componentId: pump.id,
        scheduleId: filter.id,
        status: "DONE",
        completedAt: new Date("2026-09-01"),
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: "Loose pump note",
        componentId: pump.id,
      },
    }),
    prisma.task.create({
      data: {
        workspaceId: workspace.id,
        title: "Schedule only",
        scheduleId: oil.id,
      },
    }),
  ]);

  const otherWorkspaceTask = await prisma.task.create({
    data: {
      workspaceId: other.id,
      title: "Do not touch",
      componentId: pump.id,
      scheduleId: oil.id,
    },
  });
  const valveTask = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      title: "Valve chore",
      componentId: valve.id,
      scheduleId: exercise.id,
      status: "DONE",
      completedAt: new Date("2026-08-01"),
    },
  });
  const crossLink = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      title: "Lives on the valve schedule",
      componentId: door.id,
      scheduleId: exercise.id,
    },
  });
  const doorTask = await prisma.task.create({
    data: {
      workspaceId: workspace.id,
      title: "Door chore",
      componentId: door.id,
      scheduleId: grease.id,
    },
  });

  const removedPump = await deleteComponentCascade(prisma, {
    workspaceId: workspace.id,
    systemId: well.id,
    componentId: pump.id,
  });
  assert.equal(removedPump, true);
  assert.equal(await prisma.component.count({ where: { id: pump.id } }), 0);
  assert.equal(
    await prisma.maintenanceSchedule.count({ where: { id: { in: [oil.id, filter.id] } } }),
    0,
  );
  assert.equal(
    await prisma.task.count({ where: { id: { in: pumpTasks.map((task) => task.id) } } }),
    0,
  );
  assert.equal(await prisma.task.count({ where: { id: otherWorkspaceTask.id } }), 1);
  assert.equal(await prisma.component.count({ where: { id: valve.id } }), 1);
  assert.equal(await prisma.task.count({ where: { id: valveTask.id } }), 1);
  assert.equal(await prisma.system.count({ where: { id: well.id } }), 1);
  assert.equal(await prisma.task.count({ where: { id: doorTask.id } }), 1);

  const wrongSystem = await deleteComponentCascade(prisma, {
    workspaceId: workspace.id,
    systemId: barn.id,
    componentId: valve.id,
  });
  assert.equal(wrongSystem, false);
  assert.equal(await prisma.component.count({ where: { id: valve.id } }), 1);

  const removedWell = await deleteSystemCascade(prisma, {
    workspaceId: workspace.id,
    systemId: well.id,
  });
  assert.equal(removedWell, true);
  assert.equal(await prisma.system.count({ where: { id: well.id } }), 0);
  assert.equal(await prisma.component.count({ where: { id: valve.id } }), 0);
  assert.equal(await prisma.maintenanceSchedule.count({ where: { id: exercise.id } }), 0);
  assert.equal(await prisma.task.count({ where: { id: valveTask.id } }), 0);
  assert.equal(await prisma.task.count({ where: { id: crossLink.id } }), 0);
  assert.equal(await prisma.system.count({ where: { id: barn.id } }), 1);
  assert.equal(await prisma.component.count({ where: { id: door.id } }), 1);
  assert.equal(await prisma.maintenanceSchedule.count({ where: { id: grease.id } }), 1);
  assert.equal(await prisma.task.count({ where: { id: doorTask.id } }), 1);

  const empty = await prisma.component.create({
    data: { workspaceId: workspace.id, systemId: barn.id, name: "Empty" },
  });
  assert.equal(
    await deleteComponentCascade(prisma, {
      workspaceId: workspace.id,
      systemId: barn.id,
      componentId: empty.id,
    }),
    true,
  );
  assert.equal(await prisma.component.count({ where: { id: empty.id } }), 0);
  assert.equal(await prisma.task.count({ where: { id: doorTask.id } }), 1);

  const bare = await prisma.system.create({
    data: { workspaceId: workspace.id, name: "Bare" },
  });
  assert.equal(
    await deleteSystemCascade(prisma, {
      workspaceId: workspace.id,
      systemId: bare.id,
    }),
    true,
  );
  assert.equal(await prisma.system.count({ where: { id: bare.id } }), 0);
  assert.equal(
    await deleteSystemCascade(prisma, {
      workspaceId: workspace.id,
      systemId: bare.id,
    }),
    false,
  );

  console.log("delete cascade: tasks go with the component and the system");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
