-- CreateTable
CREATE TABLE "AiCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiCorrection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiCorrection_workspaceId_createdAt_idx" ON "AiCorrection"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCorrection_workspaceId_field_idx" ON "AiCorrection"("workspaceId", "field");
