-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('AGE', 'SKILL', 'OPEN');

-- CreateEnum
CREATE TYPE "CompetitorKind" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "GenderRule" AS ENUM ('MEN', 'WOMEN', 'MIXED', 'OPEN');

-- CreateEnum
CREATE TYPE "UnfinishedMatchScoring" AS ENUM ('COUNT_PLAYED_ONLY', 'AWARD_REMAINING_TO_WINNER');

-- CreateEnum
CREATE TYPE "GroupWithdrawalPolicy" AS ENUM ('KEEP_PLAYED_RESULTS', 'VOID_ALL_RESULTS');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SubEventFormat" AS ENUM ('KNOCKOUT', 'GROUP_KNOCKOUT');

-- CreateTable
CREATE TABLE "Tier" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "colorHex" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventType" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "colorHex" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "competitorKind" "CompetitorKind" NOT NULL,
    "genderRule" "GenderRule" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFormat" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "bestOf" INTEGER NOT NULL,
    "pointsPerGame" INTEGER NOT NULL,
    "winBy" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupScoringRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "pointsWin" INTEGER NOT NULL,
    "pointsLoss" INTEGER NOT NULL,
    "pointsWalkoverLoss" INTEGER NOT NULL,
    "pointsUnfinishedLoss" INTEGER NOT NULL,
    "unfinishedMatchScoring" "UnfinishedMatchScoring" NOT NULL,
    "awardedGamePoints" INTEGER,
    "withdrawalPolicy" "GroupWithdrawalPolicy",
    "tiebreakers" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupScoringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "address" TEXT,
    "city" TEXT,
    "mapUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueTable" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "shortName" TEXT,
    "eventTypeId" TEXT NOT NULL,
    "venueId" TEXT,
    "city" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "ticketUrl" TEXT,
    "showTicket" BOOLEAN NOT NULL DEFAULT false,
    "presentedBy" TEXT,
    "summary" TEXT,
    "summaryEn" TEXT,
    "infoBody" TEXT,
    "infoBodyEn" TEXT,
    "showInfoTab" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "categoryId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "nameEn" TEXT,
    "format" "SubEventFormat" NOT NULL,
    "hasQualifying" BOOLEAN NOT NULL DEFAULT false,
    "matchFormatId" TEXT NOT NULL,
    "groupScoringRuleId" TEXT,
    "maxEntries" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tier_code_key" ON "Tier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EventType_code_key" ON "EventType"("code");

-- CreateIndex
CREATE INDEX "EventType_tierId_idx" ON "EventType"("tierId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_code_key" ON "Discipline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "VenueTable_venueId_code_key" ON "VenueTable"("venueId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "Event_eventTypeId_idx" ON "Event"("eventTypeId");

-- CreateIndex
CREATE INDEX "Event_venueId_idx" ON "Event"("venueId");

-- CreateIndex
CREATE INDEX "SubEvent_disciplineId_idx" ON "SubEvent"("disciplineId");

-- CreateIndex
CREATE INDEX "SubEvent_categoryId_idx" ON "SubEvent"("categoryId");

-- CreateIndex
CREATE INDEX "SubEvent_matchFormatId_idx" ON "SubEvent"("matchFormatId");

-- CreateIndex
CREATE INDEX "SubEvent_groupScoringRuleId_idx" ON "SubEvent"("groupScoringRuleId");

-- CreateIndex
CREATE UNIQUE INDEX "SubEvent_eventId_code_key" ON "SubEvent"("eventId", "code");

-- AddForeignKey
ALTER TABLE "EventType" ADD CONSTRAINT "EventType_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "Tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueTable" ADD CONSTRAINT "VenueTable_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "EventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_matchFormatId_fkey" FOREIGN KEY ("matchFormatId") REFERENCES "MatchFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubEvent" ADD CONSTRAINT "SubEvent_groupScoringRuleId_fkey" FOREIGN KEY ("groupScoringRuleId") REFERENCES "GroupScoringRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
