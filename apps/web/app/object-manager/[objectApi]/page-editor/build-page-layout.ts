import type { FieldDef, FormattingRule, PageLayout, PageWidget } from '@/lib/schema';
import type { CanvasField, CanvasSection, CanvasTab, CanvasWidget } from './types';

export function buildPageLayoutFromCanvas(params: {
  editingLayoutId: string | null;
  layoutName: string;
  tabs: CanvasTab[];
  sections: CanvasSection[];
  fields: CanvasField[];
  widgets?: CanvasWidget[];
  objectFields: FieldDef[];
  formattingRules: FormattingRule[];
}): PageLayout {
  const {
    editingLayoutId,
    layoutName,
    tabs,
    sections,
    fields,
    widgets = [],
    objectFields,
    formattingRules,
  } = params;

  const fieldMap = new Map(objectFields.map((f) => [f.apiName, f]));

  return {
    id: editingLayoutId || `layout-${Date.now()}`,
    name: layoutName,
    layoutType: 'edit',
    tabs: tabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      order: tab.order,
      sections: sections
        .filter((s) => s.tabId === tab.id)
        .map((section) => {
          const sectionWidgets = widgets
            .filter((w) => w.sectionId === section.id)
            .map(
              (w): PageWidget => ({
                id: w.id,
                widgetType: w.widgetType,
                column: w.column,
                order: w.order,
                colSpan: w.colSpan > 1 ? w.colSpan : undefined,
                rowSpan: w.rowSpan > 1 ? w.rowSpan : undefined,
                config: w.config,
              }),
            );

          return {
            id: section.id,
            label: section.label,
            columns: section.columns,
            order: section.order,
            description: section.description,
            fields: fields
              .filter((f) => f.sectionId === section.id)
              .map((f) => {
                const fieldDef = fieldMap.get(f.fieldApiName);
                const cleanPresentation =
                  f.presentation &&
                  Object.values(f.presentation).some((v) => v !== undefined)
                    ? Object.fromEntries(
                        Object.entries(f.presentation).filter(
                          ([, v]) => v !== undefined,
                        ),
                      )
                    : undefined;
                const base = {
                  apiName: f.fieldApiName,
                  column: f.column,
                  order: f.order,
                  colSpan: f.colSpan > 1 ? f.colSpan : undefined,
                  rowSpan: f.rowSpan > 1 ? f.rowSpan : undefined,
                  presentation: cleanPresentation,
                };
                if (!fieldDef) return base;
                const { apiName, ...rest } = fieldDef;
                return { ...rest, ...base };
              }),
            widgets: sectionWidgets.length > 0 ? sectionWidgets : undefined,
            visibleIf: section.visibleIf,
            showInRecord: section.showInRecord,
            showInTemplate: section.showInTemplate,
          };
        }),
    })),
    formattingRules: formattingRules.length > 0 ? formattingRules : undefined,
  };
}
