-- CreateEnum
CREATE TYPE "DrawKind" AS ENUM ('QUALIFYING', 'MAIN', 'GROUP');

-- CreateEnum
CREATE TYPE "DrawStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PositionSource" AS ENUM ('ENTRY', 'BYE', 'QUALIFIER', 'GROUP_PLACE');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "ResultType" AS ENUM ('NORMAL', 'WALKOVER', 'RETIRED', 'DISQUALIFIED', 'BYE');

-- CreateTable
CREATE TABLE "Draw" (
    "id" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "kind" "DrawKind" NOT NULL,
    "status" "DrawStatus" NOT NULL DEFAULT 'DRAFT',
    "size" INTEGER,
    "seedCount" INTEGER NOT NULL DEFAULT 0,
    "qualifierCount" INTEGER,
    "groupCount" INTEGER,
    "advancePerGroup" INTEGER,
    "matchFormatId" TEXT,
    "randomSeed" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "startDate" DATE,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BracketPosition" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "section" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL,
    "source" "PositionSource" NOT NULL,
    "entryId" TEXT,
    "sourceRef" JSONB,

    CONSTRAINT "BracketPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "section" INTEGER NOT NULL DEFAULT 1,
    "scopeKey" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "matchFormatId" TEXT,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMatchCounter" (
    "eventId" TEXT NOT NULL,
    "lastMatchNo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventMatchCounter_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subEventId" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "section" INTEGER NOT NULL DEFAULT 1,
    "orderInRound" INTEGER NOT NULL,
    "matchNo" INTEGER NOT NULL,
    "side1EntryId" TEXT,
    "side2EntryId" TEXT,
    "side1Source" JSONB,
    "side2Source" JSONB,
    "nextMatchId" TEXT,
    "nextMatchSide" INTEGER,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "resultType" "ResultType",
    "winnerSide" INTEGER,
    "games1" INTEGER,
    "games2" INTEGER,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "sessionId" TEXT,
    "tableId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "orderInSession" INTEGER,
    "scheduleVersion" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "officialAt" TIMESTAMP(3),
    "officialById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "score1" INTEGER NOT NULL,
    "score2" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Draw_matchFormatId_idx" ON "Draw"("matchFormatId");

-- CreateIndex
CREATE UNIQUE INDEX "Draw_subEventId_kind_key" ON "Draw"("subEventId", "kind");

-- CreateIndex
CREATE INDEX "BracketPosition_entryId_idx" ON "BracketPosition"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "BracketPosition_drawId_section_position_key" ON "BracketPosition"("drawId", "section", "position");

-- CreateIndex
CREATE INDEX "Round_matchFormatId_idx" ON "Round"("matchFormatId");

-- CreateIndex
CREATE UNIQUE INDEX "Round_drawId_scopeKey_number_key" ON "Round"("drawId", "scopeKey", "number");

-- CreateIndex
CREATE INDEX "Match_drawId_roundId_idx" ON "Match"("drawId", "roundId");

-- CreateIndex
CREATE INDEX "Match_eventId_status_idx" ON "Match"("eventId", "status");

-- CreateIndex
CREATE INDEX "Match_subEventId_idx" ON "Match"("subEventId");

-- CreateIndex
CREATE INDEX "Match_roundId_idx" ON "Match"("roundId");

-- CreateIndex
CREATE INDEX "Match_side1EntryId_idx" ON "Match"("side1EntryId");

-- CreateIndex
CREATE INDEX "Match_side2EntryId_idx" ON "Match"("side2EntryId");

-- CreateIndex
CREATE INDEX "Match_nextMatchId_idx" ON "Match"("nextMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_eventId_matchNo_key" ON "Match"("eventId", "matchNo");

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_number_key" ON "Game"("matchId", "number");

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "SubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draw" ADD CONSTRAINT "Draw_matchFormatId_fkey" FOREIGN KEY ("matchFormatId") REFERENCES "MatchFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketPosition" ADD CONSTRAINT "BracketPosition_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BracketPosition" ADD CONSTRAINT "BracketPosition_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_matchFormatId_fkey" FOREIGN KEY ("matchFormatId") REFERENCES "MatchFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMatchCounter" ADD CONSTRAINT "EventMatchCounter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "SubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_side1EntryId_fkey" FOREIGN KEY ("side1EntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_side2EntryId_fkey" FOREIGN KEY ("side2EntryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_nextMatchId_fkey" FOREIGN KEY ("nextMatchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
