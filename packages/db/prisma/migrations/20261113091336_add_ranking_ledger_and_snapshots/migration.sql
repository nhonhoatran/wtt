-- CreateEnum
CREATE TYPE "PointsSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "RankingPointsEarned" (
    "id" TEXT NOT NULL,
    "rankingListId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "source" "PointsSource" NOT NULL,
    "subEventId" TEXT,
    "eventId" TEXT,
    "entryId" TEXT,
    "stageCode" TEXT,
    "points" INTEGER NOT NULL,
    "ruleEffectiveFrom" DATE,
    "earnedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "reason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingPointsEarned_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshot" (
    "id" TEXT NOT NULL,
    "rankingListId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "publishedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankingSnapshotRow" (
    "snapshotId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "previousRank" INTEGER,
    "movement" INTEGER,
    "points" INTEGER NOT NULL,
    "resultsCounted" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "RankingSnapshotRow_pkey" PRIMARY KEY ("snapshotId","playerId")
);

-- CreateIndex
CREATE INDEX "RankingPointsEarned_rankingListId_playerId_idx" ON "RankingPointsEarned"("rankingListId", "playerId");

-- CreateIndex
CREATE INDEX "RankingPointsEarned_subEventId_idx" ON "RankingPointsEarned"("subEventId");

-- CreateIndex
CREATE INDEX "RankingPointsEarned_rankingListId_expiresAt_idx" ON "RankingPointsEarned"("rankingListId", "expiresAt");

-- CreateIndex
CREATE INDEX "RankingPointsEarned_playerId_idx" ON "RankingPointsEarned"("playerId");

-- CreateIndex
CREATE INDEX "RankingPointsEarned_eventId_idx" ON "RankingPointsEarned"("eventId");

-- CreateIndex
CREATE INDEX "RankingPointsEarned_entryId_idx" ON "RankingPointsEarned"("entryId");

-- CreateIndex
CREATE INDEX "RankingSnapshot_rankingListId_status_asOfDate_idx" ON "RankingSnapshot"("rankingListId", "status", "asOfDate");

-- CreateIndex
CREATE INDEX "RankingSnapshotRow_snapshotId_rank_idx" ON "RankingSnapshotRow"("snapshotId", "rank");

-- CreateIndex
CREATE INDEX "RankingSnapshotRow_playerId_idx" ON "RankingSnapshotRow"("playerId");

-- AddForeignKey
ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_rankingListId_fkey" FOREIGN KEY ("rankingListId") REFERENCES "RankingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_subEventId_fkey" FOREIGN KEY ("subEventId") REFERENCES "SubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshot" ADD CONSTRAINT "RankingSnapshot_rankingListId_fkey" FOREIGN KEY ("rankingListId") REFERENCES "RankingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshotRow" ADD CONSTRAINT "RankingSnapshotRow_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RankingSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankingSnapshotRow" ADD CONSTRAINT "RankingSnapshotRow_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written below: Prisma cannot model partial indexes, CHECK constraints or triggers.

-- One AUTO ledger row per player in a sub-event and list; MANUAL rows are unconstrained.
CREATE UNIQUE INDEX "RankingPointsEarned_auto_unique"
  ON "RankingPointsEarned" ("subEventId", "playerId", "rankingListId") WHERE "source" = 'AUTO';

-- At most one DRAFT snapshot per list and as-of date, even when two build jobs race.
CREATE UNIQUE INDEX "RankingSnapshot_draft_unique"
  ON "RankingSnapshot" ("rankingListId", "asOfDate") WHERE "status" = 'DRAFT';

ALTER TABLE "RankingPointsEarned" ADD CONSTRAINT "RankingPointsEarned_source_shape" CHECK (
  ("source" = 'AUTO' AND "subEventId" IS NOT NULL)
  OR ("source" = 'MANUAL' AND "reason" IS NOT NULL AND btrim("reason") <> '')
);

-- Rows of a PUBLISHED snapshot can never be inserted, changed or deleted. FOR SHARE makes a
-- concurrent publish wait for in-flight row writes instead of slipping between check and write.
CREATE FUNCTION "ranking_snapshot_row_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_id text;
  parent_status "SnapshotStatus";
BEGIN
  FOR parent_id IN
    SELECT DISTINCT v FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD."snapshotId" END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW."snapshotId" END
    ]) AS v WHERE v IS NOT NULL
  LOOP
    SELECT "status" INTO parent_status FROM "RankingSnapshot" WHERE "id" = parent_id FOR SHARE;
    IF parent_status = 'PUBLISHED' THEN
      RAISE EXCEPTION 'RankingSnapshotRow of a PUBLISHED snapshot is immutable (% on snapshot %)', TG_OP, parent_id
        USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RankingSnapshotRow_immutable_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "RankingSnapshotRow"
  FOR EACH ROW EXECUTE FUNCTION "ranking_snapshot_row_guard"();

-- A PUBLISHED snapshot cannot be changed or deleted; DRAFT -> PUBLISHED is the only allowed transition.
CREATE FUNCTION "ranking_snapshot_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'RankingSnapshot % is PUBLISHED and immutable (%)', OLD."id", TG_OP
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "RankingSnapshot_immutable_guard"
  BEFORE UPDATE OR DELETE ON "RankingSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "ranking_snapshot_guard"();
