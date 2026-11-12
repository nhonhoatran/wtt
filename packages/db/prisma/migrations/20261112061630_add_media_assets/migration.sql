-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('AWAITING_UPLOAD', 'PROCESSING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "bannerMediaId" TEXT;

-- AlterTable
ALTER TABLE "EventType" ADD COLUMN     "backgroundMediaId" TEXT,
ADD COLUMN     "logoMediaId" TEXT;

-- AlterTable
ALTER TABLE "Tier" ADD COLUMN     "backgroundMediaId" TEXT,
ADD COLUMN     "logoMediaId" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "incomingKey" TEXT NOT NULL,
    "publicKey" TEXT,
    "declaredMime" TEXT NOT NULL,
    "declaredSize" INTEGER NOT NULL,
    "mime" TEXT,
    "size" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "status" "MediaStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "failureReason" TEXT,
    "variants" JSONB,
    "altText" TEXT,
    "altTextEn" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_incomingKey_key" ON "MediaAsset"("incomingKey");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_publicKey_key" ON "MediaAsset"("publicKey");

-- CreateIndex
CREATE INDEX "MediaAsset_status_expiresAt_idx" ON "MediaAsset"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventType" ADD CONSTRAINT "EventType_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventType" ADD CONSTRAINT "EventType_backgroundMediaId_fkey" FOREIGN KEY ("backgroundMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_bannerMediaId_fkey" FOREIGN KEY ("bannerMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
