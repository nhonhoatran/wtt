-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "mergedAt" TIMESTAMP(3),
ADD COLUMN     "mergedIntoId" TEXT;

-- CreateIndex
CREATE INDEX "Player_mergedIntoId_idx" ON "Player"("mergedIntoId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
