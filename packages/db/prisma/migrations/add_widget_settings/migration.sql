-- CreateTable: WidgetSetting
CREATE TABLE IF NOT EXISTS "WidgetSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WidgetSetting_orgId_widgetId_key" ON "WidgetSetting"("orgId", "widgetId");
CREATE INDEX IF NOT EXISTS "WidgetSetting_orgId_idx" ON "WidgetSetting"("orgId");
