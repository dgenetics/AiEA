-- Farm Manager: one database.
-- Task rows are copied into the rebuilt table before the old table is dropped.
-- Area, Person, and Reminder go away with the product cuts (Areas, People, Daily Brief).
-- Schedule chores are Task rows (scheduleId / componentId), not a second chore table.

-- DropIndex
DROP INDEX "Area_workspaceId_slug_key";

-- DropIndex
DROP INDEX "Area_workspaceId_idx";

-- DropIndex
DROP INDEX "Person_workspaceId_idx";

-- DropIndex
DROP INDEX "Reminder_fireAt_status_idx";

-- DropIndex
DROP INDEX "Reminder_workspaceId_status_fireAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Area";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Person";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Reminder";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "System_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "modelNumber" TEXT NOT NULL DEFAULT '',
    "productNumber" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "warrantyInfo" TEXT NOT NULL DEFAULT '',
    "userManual" TEXT NOT NULL DEFAULT '',
    "vendorName" TEXT NOT NULL DEFAULT '',
    "vendorContact" TEXT NOT NULL DEFAULT '',
    "serviceCompanyName" TEXT NOT NULL DEFAULT '',
    "serviceCompanyContact" TEXT NOT NULL DEFAULT '',
    "purchaseDate" DATETIME,
    "purchaseCost" REAL,
    "replacementCost" REAL,
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Component_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT,
    "intervalDays" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "nextDueDate" DATETIME NOT NULL,
    "lastCompletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceSchedule_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaptureBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCEPTED',
    "proposals" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CaptureBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CaptureBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CaptureBatch" ("createdAt", "id", "proposals", "rawText", "status", "updatedAt", "userId", "workspaceId") SELECT "createdAt", "id", "proposals", "rawText", "status", "updatedAt", "userId", "workspaceId" FROM "CaptureBatch";
DROP TABLE "CaptureBatch";
ALTER TABLE "new_CaptureBatch" RENAME TO "CaptureBatch";
CREATE INDEX "CaptureBatch_workspaceId_idx" ON "CaptureBatch"("workspaceId");
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("createdAt", "id", "name", "status", "updatedAt", "workspaceId") SELECT "createdAt", "id", "name", "status", "updatedAt", "workspaceId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'ONE_TIME',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "board" TEXT NOT NULL DEFAULT 'BACKLOG',
    "boardReason" TEXT,
    "priority" INTEGER,
    "urgencyScore" REAL,
    "impactScore" REAL,
    "dueAt" DATETIME,
    "scheduledFor" DATETIME,
    "completedAt" DATETIME,
    "snoozedUntil" DATETIME,
    "estimateMinutes" INTEGER,
    "recurrenceRule" TEXT,
    "nextOccurrenceAt" DATETIME,
    "checkIns" TEXT,
    "aiRationale" TEXT,
    "sourceCaptureId" TEXT,
    "externalSource" TEXT,
    "externalId" TEXT,
    "scheduleId" TEXT,
    "componentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sourceCaptureId_fkey" FOREIGN KEY ("sourceCaptureId") REFERENCES "CaptureBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MaintenanceSchedule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("aiRationale", "board", "checkIns", "completedAt", "createdAt", "dueAt", "estimateMinutes", "externalId", "externalSource", "id", "impactScore", "kind", "nextOccurrenceAt", "notes", "parentId", "priority", "projectId", "recurrenceRule", "scheduledFor", "snoozedUntil", "sourceCaptureId", "status", "title", "updatedAt", "urgencyScore", "workspaceId") SELECT "aiRationale", "board", "checkIns", "completedAt", "createdAt", "dueAt", "estimateMinutes", "externalId", "externalSource", "id", "impactScore", "kind", "nextOccurrenceAt", "notes", "parentId", "priority", "projectId", "recurrenceRule", "scheduledFor", "snoozedUntil", "sourceCaptureId", "status", "title", "updatedAt", "urgencyScore", "workspaceId" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_workspaceId_status_idx" ON "Task"("workspaceId", "status");
CREATE INDEX "Task_workspaceId_dueAt_idx" ON "Task"("workspaceId", "dueAt");
CREATE INDEX "Task_workspaceId_scheduledFor_idx" ON "Task"("workspaceId", "scheduledFor");
CREATE INDEX "Task_workspaceId_kind_idx" ON "Task"("workspaceId", "kind");
CREATE INDEX "Task_workspaceId_board_idx" ON "Task"("workspaceId", "board");
CREATE INDEX "Task_workspaceId_externalSource_idx" ON "Task"("workspaceId", "externalSource");
CREATE INDEX "Task_scheduleId_idx" ON "Task"("scheduleId");
CREATE INDEX "Task_componentId_idx" ON "Task"("componentId");
CREATE UNIQUE INDEX "Task_workspaceId_externalSource_externalId_key" ON "Task"("workspaceId", "externalSource", "externalId");
CREATE TABLE "new_Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Workspace" ("createdAt", "id", "name", "slug", "updatedAt") SELECT "createdAt", "id", "name", "slug", "updatedAt" FROM "Workspace";
DROP TABLE "Workspace";
ALTER TABLE "new_Workspace" RENAME TO "Workspace";
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "System_workspaceId_idx" ON "System"("workspaceId");

-- CreateIndex
CREATE INDEX "System_workspaceId_category_idx" ON "System"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "System_workspaceId_name_idx" ON "System"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "Component_workspaceId_idx" ON "Component"("workspaceId");

-- CreateIndex
CREATE INDEX "Component_systemId_idx" ON "Component"("systemId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_workspaceId_idx" ON "MaintenanceSchedule"("workspaceId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_componentId_idx" ON "MaintenanceSchedule"("componentId");

-- CreateIndex
CREATE INDEX "MaintenanceSchedule_nextDueDate_idx" ON "MaintenanceSchedule"("nextDueDate");

-- Hidden review states are gone. Every former proposal is an open board task.
UPDATE "Task" SET "status" = 'ACTIVE' WHERE "status" IN ('PROPOSED', 'INBOX');

-- Farm cadence lives on MaintenanceSchedule, not Task.recurrenceRule.
UPDATE "Task" SET "recurrenceRule" = NULL WHERE "externalSource" = 'bf-maintenance';

-- At most one open task per schedule. NULLs do not collide.
CREATE UNIQUE INDEX "Task_one_open_per_schedule" ON "Task"("scheduleId")
WHERE "scheduleId" IS NOT NULL AND "status" IN ('ACTIVE', 'INBOX', 'SNOOZED');
