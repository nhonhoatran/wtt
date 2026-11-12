-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Handedness" AS ENUM ('LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "CompetitorType" AS ENUM ('PLAYER', 'PAIR');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameEn" TEXT,
    "publicDisplayName" TEXT,
    "gender" "Gender" NOT NULL,
    "birthDate" DATE,
    "birthYear" INTEGER,
    "countryCode" TEXT NOT NULL,
    "club" TEXT,
    "city" TEXT,
    "handedness" "Handedness",
    "gripStyle" TEXT,
    "playStyle" TEXT,
    "photoMediaId" TEXT,
    "bio" TEXT,
    "bioEn" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "normalizedName" TEXT NOT NULL,
    "isPublicProfile" BOOLEAN NOT NULL DEFAULT true,
    "noindex" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "type" "CompetitorType" NOT NULL,
    "playerId" TEXT,
    "pairId" TEXT,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_code_key" ON "Player"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Player_slug_key" ON "Player"("slug");

-- CreateIndex
CREATE INDEX "Player_normalizedName_idx" ON "Player"("normalizedName");

-- CreateIndex
CREATE INDEX "Player_club_idx" ON "Player"("club");

-- CreateIndex
CREATE INDEX "Pair_playerBId_idx" ON "Pair"("playerBId");

-- CreateIndex
CREATE UNIQUE INDEX "Pair_playerAId_playerBId_key" ON "Pair"("playerAId", "playerBId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_playerId_key" ON "Competitor"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_pairId_key" ON "Competitor"("pairId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_photoMediaId_fkey" FOREIGN KEY ("photoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma cannot model CHECK constraints or sequences.
CREATE SEQUENCE "player_code_seq" START 1;

ALTER TABLE "Pair" ADD CONSTRAINT "Pair_ordered_distinct_players" CHECK ("playerAId" < "playerBId");

ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_type_matches_reference" CHECK (
  ("type" = 'PLAYER' AND "playerId" IS NOT NULL AND "pairId" IS NULL)
  OR ("type" = 'PAIR' AND "pairId" IS NOT NULL AND "playerId" IS NULL)
);
