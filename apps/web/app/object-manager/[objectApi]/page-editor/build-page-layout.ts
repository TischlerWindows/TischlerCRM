import type { FieldDef, FormattingRule, PageLayout } from '@/lib/schema';
import type { CanvasField, CanvasSection, CanvasTab } from './types';

export function buildPageLayoutFromCanvas(params: {
  editingLayoutId: string | null;
  layoutName: string;
  tabs: CanvasTab[];
  sections: CanvasSection[];
  fields: CanvasField[];
  objectFields: FieldDef[];
  formattingRules: FormattingRule[];
}): PageLayout {
  const {
    editingLayoutId,
    layoutName,
    tabs,
    sections,
    fields,
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
        .map((section) => ({
          id: section.id,
          label: section.label,
          columns: section.columns,
          order: section.order,
          description: section.description,
          fields: fields
            .filter((f) => f.sectionId === section.id)
            .map((f) => {
              const fieldDef = fieldMap.get(f.fieldApiName);
              const base = {
                apiName: f.fieldApiName,
                column: f.column,
                order: f.order,
                colSpan: f.colSpan > 1 ? f.colSpan : undefined,
                rowSpan: f.rowSpan > 1 ? f.rowSpan : undefined,
                presentation:
                  f.presentation && Object.keys(f.presentation).length > 0
                    ? f.presentation
                    : undefined,
              };
              if (!fieldDef) return base;
              const { apiName, ...rest } = fieldDef;
              return { ...rest, ...base };
            }),
          visibleIf: section.visibleIf,
          showInRecord: section.showInRecord,
          showInTemplate: section.showInTemplate,
        })),
    })),
    formattingRules: formattingRules.length > 0 ? formattingRules : undefined,
  };
}
