-- CreateTable
CREATE TABLE "EventSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "venueId" TEXT,
    "date" DATE NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "nameEn" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSessionTable" (
    "sessionId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "EventSessionTable_pkey" PRIMARY KEY ("sessionId","tableId")
);

-- CreateIndex
CREATE INDEX "EventSession_eventId_date_idx" ON "EventSession"("eventId", "date");

-- CreateIndex
CREATE INDEX "EventSession_venueId_idx" ON "EventSession"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSession_eventId_code_key" ON "EventSession"("eventId", "code");

-- CreateIndex
CREATE INDEX "EventSessionTable_tableId_idx" ON "EventSessionTable"("tableId");

-- CreateIndex
CREATE INDEX "Match_sessionId_tableId_orderInSession_idx" ON "Match"("sessionId", "tableId", "orderInSession");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VenueTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSessionTable" ADD CONSTRAINT "EventSessionTable_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSessionTable" ADD CONSTRAINT "EventSessionTable_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "VenueTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
