-- CreateEnum
CREATE TYPE "SpecSection" AS ENUM ('SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION', 'ALWAYS');

-- CreateEnum
CREATE TYPE "ConditionOperator" AS ENUM ('CONTAINS', 'EQUALS', 'NOT_EMPTY', 'IS_TRUE', 'IS_FALSE');

-- CreateEnum
CREATE TYPE "ConditionLogic" AS ENUM ('AND', 'OR');

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecPreset" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "section" "SpecSection" NOT NULL,
    "isAlwaysIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecCondition" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "ConditionOperator" NOT NULL,
    "value" TEXT,
    "logic" "ConditionLogic" NOT NULL DEFAULT 'AND',

    CONSTRAINT "SpecCondition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpecPreset_templateId_idx" ON "SpecPreset"("templateId");

-- CreateIndex
CREATE INDEX "SpecPreset_templateId_order_idx" ON "SpecPreset"("templateId", "order");

-- CreateIndex
CREATE INDEX "SpecCondition_presetId_idx" ON "SpecCondition"("presetId");

-- AddForeignKey
ALTER TABLE "SpecPreset" ADD CONSTRAINT "SpecPreset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecCondition" ADD CONSTRAINT "SpecCondition_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "SpecPreset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
