-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "groupId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("groupId","entryId")
);

-- CreateTable
CREATE TABLE "GroupStanding" (
    "groupId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "played" INTEGER NOT NULL DEFAULT 0,
    "won" INTEGER NOT NULL DEFAULT 0,
    "lost" INTEGER NOT NULL DEFAULT 0,
    "matchPoints" INTEGER NOT NULL DEFAULT 0,
    "gamesFor" INTEGER NOT NULL DEFAULT 0,
    "gamesAgainst" INTEGER NOT NULL DEFAULT 0,
    "pointsFor" INTEGER NOT NULL DEFAULT 0,
    "pointsAgainst" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "needsManualTiebreak" BOOLEAN NOT NULL DEFAULT false,
    "manualRank" INTEGER,

    CONSTRAINT "GroupStanding_pkey" PRIMARY KEY ("groupId","entryId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_drawId_code_key" ON "Group"("drawId", "code");

-- CreateIndex
CREATE INDEX "GroupMember_entryId_idx" ON "GroupMember"("entryId");

-- CreateIndex
CREATE INDEX "GroupStanding_entryId_idx" ON "GroupStanding"("entryId");

-- CreateIndex
CREATE INDEX "Match_groupId_idx" ON "Match"("groupId");

-- CreateIndex
CREATE INDEX "Round_groupId_idx" ON "Round"("groupId");

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "Draw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStanding" ADD CONSTRAINT "GroupStanding_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupStanding" ADD CONSTRAINT "GroupStanding_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
