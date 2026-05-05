-- CreateTable
CREATE TABLE "ProductLog" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "summaryName" TEXT NOT NULL,
    "opportunityNumber" TEXT NOT NULL,
    "linkedOpportunityId" TEXT,
    "date" TEXT,
    "category" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "fields" DOUBLE PRECISION NOT NULL,
    "sqFeet" DOUBLE PRECISION NOT NULL,
    "netEuro" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductLog_summaryId_idx" ON "ProductLog"("summaryId");

-- CreateIndex
CREATE INDEX "ProductLog_linkedOpportunityId_idx" ON "ProductLog"("linkedOpportunityId");

-- CreateIndex
CREATE INDEX "ProductLog_createdAt_idx" ON "ProductLog"("createdAt");
