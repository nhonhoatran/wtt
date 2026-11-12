-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('AWAITING_UPLOAD', 'UPLOADED', 'VALIDATING', 'VALIDATED', 'COMMITTING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('VALID', 'ERROR', 'NEEDS_CONFIRM', 'COMMITTED');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileSha256" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "failureReason" TEXT,
    "totalRows" INTEGER,
    "validRows" INTEGER,
    "errorRows" INTEGER,
    "needsConfirmRows" INTEGER,
    "committedRows" INTEGER,
    "overrideReason" TEXT,
    "attemptNo" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "fileDeletedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "importJobId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "plannedAction" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "messages" JSONB,
    "candidatePlayerIds" JSONB,
    "decisions" JSONB,
    "createdEntityIds" JSONB,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("importJobId","rowNo")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_fileKey_key" ON "ImportJob"("fileKey");

-- CreateIndex
CREATE INDEX "ImportJob_eventId_createdAt_idx" ON "ImportJob"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_importJobId_status_idx" ON "ImportRow"("importJobId", "status");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
