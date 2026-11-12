-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('CONFIRMED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EntryStage" AS ENUM ('MAIN', 'QUALIFYING');

-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('DIRECT', 'WILDCARD', 'QUALIFIER');

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'CONFIRMED',
    "stage" "EntryStage" NOT NULL DEFAULT 'MAIN',
    "quotaType" "QuotaType" NOT NULL DEFAULT 'DIRECT',
    "seed" INTEGER,
    "rankingAtEntry" INTEGER,
    "pointsAtEntry" INTEGER,
    "eligibilityOverrideReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Entry_subEventId_status_idx" ON "Entry"("subEventId", "status");

-- CreateIndex
CREATE INDEX "Entry_competitorId_idx" ON "Entry"("competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_subEventId_competitorId_key" ON "Entry"("subEventId", "competitorId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_subEventId_stage_seed_key" ON "Entry"("subEventId", "stage", "seed");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "SubEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
