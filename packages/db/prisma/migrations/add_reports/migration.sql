-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objectType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT,
    "sortBy" TEXT,
    "sortOrder" TEXT,
    "isStandard" BOOLEAN NOT NULL DEFAULT false,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "folderId" TEXT,
    "createdById" TEXT NOT NULL,
    "modifiedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" JSONB,
    "createdById" TEXT NOT NULL,
    "modifiedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Report_objectType_idx" ON "Report"("objectType");

-- CreateIndex
CREATE INDEX "Report_format_idx" ON "Report"("format");

-- CreateIndex
CREATE INDEX "Report_createdById_idx" ON "Report"("createdById");

-- CreateIndex
CREATE INDEX "Report_folderId_idx" ON "Report"("folderId");

-- CreateIndex
CREATE INDEX "Report_isPrivate_idx" ON "Report"("isPrivate");

-- CreateIndex
CREATE INDEX "Report_isFavorite_idx" ON "Report"("isFavorite");

-- CreateIndex
CREATE INDEX "ReportFolder_createdById_idx" ON "ReportFolder"("createdById");

-- CreateIndex
CREATE INDEX "ReportFolder_parentId_idx" ON "ReportFolder"("parentId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ReportFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFolder" ADD CONSTRAINT "ReportFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ReportFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFolder" ADD CONSTRAINT "ReportFolder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportFolder" ADD CONSTRAINT "ReportFolder_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
