'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { evaluateVisibility } from '@/lib/field-visibility';
import {
  getFormattingEffectsForField,
  getFormattingEffectsForSection,
} from '@/lib/layout-formatting';
import {
  badgePillClass,
  fieldHighlightWrapperClass,
  labelPresentationClassName,
} from '@/lib/layout-presentation';
import type { FieldDef, PageField, PageLayout } from '@/lib/schema';
import { normalizeFieldType } from '@/lib/schema';
import { buildSampleRecordFromFields } from './layout-sample-data';

function getFieldDefForPreview(
  apiName: string,
  allFields: FieldDef[],
  pageField?: PageField
): FieldDef | undefined {
  if (pageField && pageField.type && pageField.label) {
    const { column: _c, order: _o, presentation: _p, colSpan: _cs, rowSpan: _rs, ...fieldProps } =
      pageField;
    return {
      id: fieldProps.id || apiName,
      ...fieldProps,
      apiName,
      type: normalizeFieldType(fieldProps.type!),
    } as FieldDef;
  }
  return allFields.find((f) => f.apiName === apiName);
}

function formatSampleValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 0 ? s : '—';
}

export function LayoutPreviewDialog({
  open,
  onOpenChange,
  pageLayout,
  allFields,
  objectLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pageLayout: PageLayout | null;
  allFields: FieldDef[];
  objectLabel: string;
}) {
  const sample = buildSampleRecordFromFields(allFields);
  const data = sample as Record<string, unknown>;

  if (!pageLayout) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Nothing to preview yet.</p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Layout preview — {objectLabel}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-4">
          Sample data simulates the create/edit form. Section visibility uses{' '}
          <span className="font-medium">Show in Record Template</span> and field/section rules.
        </p>

        <div className="space-y-8">
          {pageLayout.tabs.map((tab) => (
            <div key={tab.id}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                {tab.label}
              </h3>
              <div className="space-y-4">
                {tab.sections.map((section) => {
                  if (section.showInTemplate === false) return null;
                  if (!evaluateVisibility(section.visibleIf, data)) return null;
                  const sFx = getFormattingEffectsForSection(pageLayout, section.id, data);
                  if (sFx?.hidden) return null;

                  const columnArrays: PageField[][] = [];
                  for (let c = 0; c < section.columns; c++) {
                    columnArrays[c] = section.fields
                      .filter((f) => f.column === c)
                      .sort((a, b) => a.order - b.order);
                  }

                  return (
                    <div
                      key={section.id}
                      className="border border-gray-200 rounded-lg bg-white overflow-hidden"
                    >
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="font-medium text-gray-900">{section.label}</div>
                        {section.description ? (
                          <p className="text-xs text-gray-500 mt-1">{section.description}</p>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <div
                          className={`grid gap-4 ${
                            section.columns === 1
                              ? 'grid-cols-1'
                              : section.columns === 2
                                ? 'grid-cols-1 sm:grid-cols-2'
                                : 'grid-cols-1 sm:grid-cols-3'
                          }`}
                        >
                          {columnArrays.map((colFields, colIdx) => (
                            <div key={colIdx} className="flex flex-col gap-3">
                              {colFields.map((pf) => {
                                const fieldDef = getFieldDefForPreview(pf.apiName, allFields, pf);
                                if (!fieldDef) return null;
                                if (!evaluateVisibility(fieldDef.visibleIf, data)) return null;
                                const fFx = getFormattingEffectsForField(
                                  pageLayout,
                                  pf.apiName,
                                  data
                                );
                                if (fFx?.hidden) return null;

                                const highlight = fieldHighlightWrapperClass(fFx?.highlightToken);
                                const badge = fFx?.badge ? badgePillClass(fFx.badge) : '';
                                const labelClass = labelPresentationClassName(pf.presentation);
                                const raw = data[pf.apiName];
                                const display = formatSampleValue(raw);

                                return (
                                  <div
                                    key={pf.apiName}
                                    className={`${highlight ? `${highlight} p-2` : ''}`.trim()}
                                  >
                                    <dt className={`text-sm ${labelClass}`}>
                                      {fieldDef.label}
                                      {fieldDef.required ? (
                                        <span className="text-red-500 ml-0.5">*</span>
                                      ) : null}
                                      {fFx?.readOnly ? (
                                        <span className="ml-2 text-xs font-normal text-gray-400">
                                          (read-only)
                                        </span>
                                      ) : null}
                                    </dt>
                                    <dd className="mt-1 text-sm text-gray-800 flex flex-wrap items-center gap-2">
                                      <span>{display}</span>
                                      {badge ? <span className={badge}>Rule</span> : null}
                                    </dd>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
