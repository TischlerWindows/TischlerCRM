-- Convert SupportTicket.category off the TicketCategory enum so it can be
-- managed through an admin UI as plain strings. Existing row values
-- (including UNTRIAGED, CRM_ISSUE, IT_ISSUE, FEATURE_REQUEST, QUESTION)
-- are preserved verbatim as TEXT.

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" SET DEFAULT 'UNTRIAGED';

DROP TYPE "TicketCategory";
