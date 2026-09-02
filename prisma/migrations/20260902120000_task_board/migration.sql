-- AlterTable: user-facing kanban lane (ICEBOX | BACKLOG | CURRENT)
ALTER TABLE "Task" ADD COLUMN "board" TEXT NOT NULL DEFAULT 'BACKLOG';

-- Backfill from legacy priority
UPDATE "Task" SET "board" = 'CURRENT' WHERE "priority" IS NOT NULL AND "priority" <= 2;
UPDATE "Task" SET "board" = 'ICEBOX' WHERE "priority" IS NOT NULL AND "priority" >= 4;
UPDATE "Task" SET "board" = 'BACKLOG' WHERE "priority" IS NULL OR ("priority" > 2 AND "priority" < 4);

-- CreateIndex
CREATE INDEX "Task_workspaceId_board_idx" ON "Task"("workspaceId", "board");
