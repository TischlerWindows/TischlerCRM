'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FieldDef, PageLayout } from '@/lib/schema';

function sampleValue(fieldType: string | undefined, label: string): string {
  switch (fieldType) {
    case 'Email': return 'john@example.com';
    case 'Phone': return '(555) 123-4567';
    case 'Currency': return '$12,500';
    case 'Number': return '42';
    case 'Percent': return '85%';
    case 'Date': return '03-15-2026';
    case 'DateTime': return '03-15-2026 09:30';
    case 'Checkbox': return 'Yes';
    case 'URL': return 'https://example.com';
    default: return label;
  }
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
          Sample data is shown for illustration. Actual values will vary.
        </p>

        <div className="space-y-8">
          {pageLayout.tabs.map((tab, ti) => {
            if (!('regions' in tab) || !Array.isArray((tab as any).regions)) {
              return (
                <div key={ti} className="p-4 text-sm text-gray-500 italic">
                  Legacy layout format — save the layout in the editor to update.
                </div>
              );
            }
            const regions = (tab as any).regions as any[];
            return (
              <div key={ti}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  {tab.label}
                </h3>
                <div
                  className="grid gap-4"
                  style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
                >
                  {regions
                    .sort(
                      (a: any, b: any) =>
                        (a.gridRow ?? 0) - (b.gridRow ?? 0) ||
                        (a.gridColumn ?? 0) - (b.gridColumn ?? 0)
                    )
                    .map((region: any) => {
                      if (region.hidden) return null;
                      return (
                        <div
                          key={region.id}
                          style={{
                            gridColumn: `${region.gridColumn ?? 1} / span ${region.gridColumnSpan ?? 12}`,
                            ...(region.style?.background
                              ? { backgroundColor: region.style.background }
                              : {}),
                          }}
                          className="space-y-3 p-1"
                        >
                          {[...region.panels]
                            .sort((a: any, b: any) => a.order - b.order)
                            .map((panel: any) => {
                              if (panel.hidden) return null;
                              const headerStyle: React.CSSProperties = {
                                ...(panel.style?.headerBackground
                                  ? { backgroundColor: panel.style.headerBackground }
                                  : {}),
                                ...(panel.style?.headerTextColor
                                  ? { color: panel.style.headerTextColor }
                                  : {}),
                                fontWeight: panel.style?.headerBold ? 700 : undefined,
                              };
                              const bodyStyle: React.CSSProperties = {
                                ...(panel.style?.bodyBackground
                                  ? { backgroundColor: panel.style.bodyBackground }
                                  : {}),
                              };
                              return (
                                <div
                                  key={panel.id}
                                  className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm"
                                >
                                  <div
                                    className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-700"
                                    style={headerStyle}
                                  >
                                    {panel.label}
                                  </div>
                                  <div
                                    className="grid gap-x-4 gap-y-3 p-3"
                                    style={{
                                      ...bodyStyle,
                                      gridTemplateColumns: `repeat(${panel.columns ?? 2}, minmax(0, 1fr))`,
                                    }}
                                  >
                                    {[...panel.fields]
                                      .sort((a: any, b: any) => a.order - b.order)
                                      .filter((f: any) => f.behavior !== 'hidden')
                                      .map((f: any) => {
                                        const fd = allFields.find(
                                          (def) => def.apiName === f.fieldApiName
                                        );
                                        const displayLabel =
                                          f.labelOverride || fd?.label || f.fieldApiName;
                                        const sample = sampleValue(fd?.type, displayLabel);
                                        const labelStyle: React.CSSProperties = {
                                          ...(f.labelStyle?.color
                                            ? { color: f.labelStyle.color }
                                            : {}),
                                          fontWeight: f.labelStyle?.bold ? 700 : undefined,
                                        };
                                        const valueStyle: React.CSSProperties = {
                                          ...(f.valueStyle?.color
                                            ? { color: f.valueStyle.color }
                                            : {}),
                                          ...(f.valueStyle?.background
                                            ? {
                                                backgroundColor: f.valueStyle.background,
                                                padding: '1px 4px',
                                                borderRadius: 3,
                                              }
                                            : {}),
                                          fontWeight: f.valueStyle?.bold ? 700 : undefined,
                                        };
                                        return (
                                          <div
                                            key={f.fieldApiName}
                                            style={{
                                              gridColumn: `span ${Math.min(
                                                f.colSpan ?? 1,
                                                panel.columns ?? 2
                                              )}`,
                                            }}
                                          >
                                            <div
                                              className="text-[10px] font-medium text-gray-400 mb-0.5"
                                              style={labelStyle}
                                            >
                                              {displayLabel}
                                            </div>
                                            <div
                                              className="text-xs text-gray-700"
                                              style={valueStyle}
                                            >
                                              {sample}
                                            </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
