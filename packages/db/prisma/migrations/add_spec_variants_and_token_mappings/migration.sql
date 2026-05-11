-- CreateEnum
CREATE TYPE "TokenSourceObject" AS ENUM ('SUMMARY', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TokenFormat" AS ENUM ('TEXT', 'CURRENCY', 'DATE', 'PHONE', 'PERCENTAGE');

-- AlterTable: make body nullable, add driverField
ALTER TABLE "SpecPreset" ALTER COLUMN "body" DROP NOT NULL;
ALTER TABLE "SpecPreset" ADD COLUMN "driverField" TEXT;

-- CreateTable
CREATE TABLE "SpecVariant" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "matchValue" TEXT NOT NULL,
    "matchLabel" TEXT,
    "body" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenMapping" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "sourceObject" "TokenSourceObject" NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "format" "TokenFormat" NOT NULL DEFAULT 'TEXT',
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecVariant_presetId_idx" ON "SpecVariant"("presetId");

-- CreateIndex
CREATE INDEX "TokenMapping_templateId_idx" ON "TokenMapping"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TokenMapping_templateId_tokenName_key" ON "TokenMapping"("templateId", "tokenName");

-- AddForeignKey
ALTER TABLE "SpecVariant" ADD CONSTRAINT "SpecVariant_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "SpecPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenMapping" ADD CONSTRAINT "TokenMapping_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
