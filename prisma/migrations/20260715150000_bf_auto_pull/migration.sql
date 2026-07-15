-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "bfAutoPullEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "bfLastAutoPullAt" DATETIME;
