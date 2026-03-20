-- Page layout designer extensions (hybrid persistence — see docs/superpowers/specs/2026-03-20-page-layout-designer-design.md)

ALTER TABLE "PageLayout" ADD COLUMN IF NOT EXISTS "extensions" JSONB;

ALTER TABLE "LayoutSection" ADD COLUMN IF NOT EXISTS "showInRecord" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LayoutSection" ADD COLUMN IF NOT EXISTS "showInTemplate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "LayoutSection" ADD COLUMN IF NOT EXISTS "visibleIf" JSONB;
ALTER TABLE "LayoutSection" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "LayoutField" ADD COLUMN IF NOT EXISTS "presentation" JSONB;
