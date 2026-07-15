-- AlterTable
ALTER TABLE "Task" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "Task" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Task_workspaceId_externalSource_externalId_key" ON "Task"("workspaceId", "externalSource", "externalId");
CREATE INDEX "Task_workspaceId_externalSource_idx" ON "Task"("workspaceId", "externalSource");
