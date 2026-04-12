-- CreateTable
CREATE TABLE "TriggerSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriggerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ControllerSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "controllerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControllerSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TriggerSetting_orgId_triggerId_key" ON "TriggerSetting"("orgId", "triggerId");

-- CreateIndex
CREATE INDEX "TriggerSetting_orgId_idx" ON "TriggerSetting"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ControllerSetting_orgId_controllerId_key" ON "ControllerSetting"("orgId", "controllerId");

-- CreateIndex
CREATE INDEX "ControllerSetting_orgId_idx" ON "ControllerSetting"("orgId");
