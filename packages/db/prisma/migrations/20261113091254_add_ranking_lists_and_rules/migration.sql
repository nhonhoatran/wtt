-- AlterTable
ALTER TABLE "SubEvent" ADD COLUMN     "rankingDirtyAt" TIMESTAMP(3),
ADD COLUMN     "rankingListId" TEXT;

-- CreateTable
CREATE TABLE "RankingList" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "competitorKind" "CompetitorKind" NOT NULL,
    "genderRule" "GenderRule" NOT NULL,
    "categoryId" TEXT,
    "validityDays" INTEGER NOT NULL,
    "groupStageByRank" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingPointsRule" (
    "id" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "competitorKind" "CompetitorKind" NOT NULL,
    "drawKind" "DrawKind" NOT NULL,
    "stageCode" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingPointsRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RankingList_code_key" ON "RankingList"("code");

-- CreateIndex
CREATE INDEX "RankingList_categoryId_idx" ON "RankingList"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RankingPointsRule_eventTypeId_competitorKind_drawKind_stage_key" ON "RankingPointsRule"("eventTypeId", "competitorKind", "drawKind", "stageCode", "effectiveFrom");

-- CreateIndex
CREATE INDEX "SubEvent_rankingListId_idx" ON "SubEvent"("rankingListId");

-- AddForeignKey
ALTER TABLE "RankingList" ADD CONSTRAINT "RankingList_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPointsRule" ADD CONSTRAINT "RankingPointsRule_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_rankingListId_fkey" FOREIGN KEY ("rankingListId") REFERENCES "RankingList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Hand-written: Prisma cannot model partial indexes or CHECK constraints.
-- The dirty-sweep and the "dirty contents" counters only look at the few rows that are dirty.
CREATE INDEX "SubEvent_rankingDirtyAt_dirty_idx" ON "SubEvent" ("rankingDirtyAt") WHERE "rankingDirtyAt" IS NOT NULL;

ALTER TABLE "RankingList" ADD CONSTRAINT "RankingList_validityDays_positive" CHECK ("validityDays" > 0);
