-- CreateIndex
CREATE INDEX "Match_tableId_idx" ON "Match"("tableId");

-- CreateIndex
CREATE INDEX "Match_eventId_scheduledAt_idx" ON "Match"("eventId", "scheduledAt");
