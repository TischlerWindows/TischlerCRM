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

        {pageLayout.highlightFields && pageLayout.highlightFields.length > 0 ? (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50/90 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Highlights
            </div>
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {pageLayout.highlightFields.map((apiName) => {
                const fieldDef = getFieldDefForPreview(apiName, allFields);
                if (!fieldDef) return null;
                if (!evaluateVisibility(fieldDef.visibleIf, data)) return null;
                const fFx = getFormattingEffectsForField(pageLayout, apiName, data);
                if (fFx?.hidden) return null;
                const raw = data[apiName];
                const display = formatSampleValue(raw);
                const labelClass = labelPresentationClassName();
                return (
                  <div key={apiName} className="min-w-[100px]">
                    <dt className={`text-xs text-gray-500 ${labelClass}`}>{fieldDef.label}</dt>
                    <dd className="mt-0.5 text-sm text-gray-900">{display}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : null}

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

                  const renderFieldPreview = (pf: PageField) => {
                    const fieldDef = getFieldDefForPreview(pf.apiName, allFields, pf);
                    if (!fieldDef) return null;
                    if (!evaluateVisibility(fieldDef.visibleIf, data)) return null;
                    const fFx = getFormattingEffectsForField(pageLayout, pf.apiName, data);
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
                  };

                  const hasSpanning = section.fields.some(
                    (f) => ((f as { colSpan?: number }).colSpan ?? 1) > 1 ||
                      ((f as { rowSpan?: number }).rowSpan ?? 1) > 1
                  );

                  const gridColsClass =
                    section.columns === 1
                      ? 'grid-cols-1'
                      : section.columns === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : section.columns === 4
                          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                          : 'grid-cols-1 sm:grid-cols-3';

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
                        {hasSpanning ? (() => {
                          const placed: Array<{
                            pf: PageField;
                            gridRow: number;
                            colSpan: number;
                            rowSpan: number;
                          }> = [];
                          const occupied = new Set<string>();
                          const colGroups: PageField[][] = [];
                          for (let c = 0; c < section.columns; c++) {
                            colGroups[c] = section.fields
                              .filter((f) => f.column === c)
                              .sort((a, b) => a.order - b.order);
                          }
                          for (let c = 0; c < section.columns; c++) {
                            for (const pf of colGroups[c] || []) {
                              const cs = Math.min(
                                (pf as { colSpan?: number }).colSpan ?? 1,
                                section.columns - pf.column
                              );
                              const rs = (pf as { rowSpan?: number }).rowSpan ?? 1;
                              let row = 1;
                              search: while (true) {
                                for (let dr = 0; dr < rs; dr++) {
                                  for (let dc = 0; dc < cs; dc++) {
                                    if (occupied.has(`${row + dr},${pf.column + dc}`)) {
                                      row++;
                                      continue search;
                                    }
                                  }
                                }
                                break;
                              }
                              placed.push({ pf, gridRow: row, colSpan: cs, rowSpan: rs });
                              for (let dr = 0; dr < rs; dr++) {
                                for (let dc = 0; dc < cs; dc++) {
                                  occupied.add(`${row + dr},${pf.column + dc}`);
                                }
                              }
                            }
                          }
                          return (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${section.columns}, 1fr)`,
                                gridAutoRows: 'minmax(60px, auto)',
                                gap: '1rem',
                              }}
                            >
                              {placed.map(({ pf, gridRow, colSpan, rowSpan }) => {
                                const inner = renderFieldPreview(pf);
                                if (!inner) return null;
                                return (
                                  <div
                                    key={pf.apiName}
                                    style={{
                                      gridColumn: `${pf.column + 1} / span ${Math.min(colSpan, section.columns - pf.column)}`,
                                      gridRow: `${gridRow} / span ${rowSpan}`,
                                    }}
                                  >
                                    {inner}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })() : (
                          <div className={`grid gap-4 ${gridColsClass}`}>
                            {columnArrays.map((colFields, colIdx) => (
                              <div key={colIdx} className="flex flex-col gap-3">
                                {colFields.map((pf) => renderFieldPreview(pf))}
                              </div>
                            ))}
                          </div>
                        )}
                        {(section.widgets && section.widgets.length > 0) ? (
                          <div className="mt-4 space-y-2 border-t border-dashed border-blue-200 pt-3">
                            {section.widgets.map((w) =>
                              w.widgetType === 'Spacer' && w.config?.type === 'Spacer' ? (
                                <div
                                  key={w.id}
                                  className="rounded-md border border-dashed border-gray-300 bg-gray-50/80 text-xs text-gray-400 flex items-center justify-center"
                                  style={{ minHeight: w.config.minHeightPx ?? 32 }}
                                  aria-hidden
                                >
                                  Spacer
                                </div>
                              ) : (
                                <div
                                  key={w.id}
                                  className="p-3 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/40 text-sm text-blue-900"
                                >
                                  <span className="font-medium">Widget:</span> {w.widgetType}
                                  {w.config && 'label' in w.config && w.config.label
                                    ? ` — ${w.config.label}`
                                    : null}
                                </div>
                              ),
                            )}
                          </div>
                        ) : null}
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
