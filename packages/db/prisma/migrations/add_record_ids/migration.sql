-- Add standardized recordId column to Record and User tables.
-- Format: 3-digit prefix (object type) + 12-char base62 suffix = 15 chars.

ALTER TABLE "Record" ADD COLUMN "recordId" TEXT;
CREATE UNIQUE INDEX "Record_recordId_key" ON "Record"("recordId");

ALTER TABLE "User" ADD COLUMN "recordId" TEXT;
CREATE UNIQUE INDEX "User_recordId_key" ON "User"("recordId");
