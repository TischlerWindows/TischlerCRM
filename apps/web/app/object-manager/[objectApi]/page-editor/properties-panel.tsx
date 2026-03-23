'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FieldDef, LabelColorToken, ObjectDef } from '@/lib/schema';
import { labelPresentationClassName } from '@/lib/layout-presentation';
import { useEditorStore } from './editor-store';
import type { ColumnCount } from './types';
import {
  Layout,
  Columns2,
  Columns3,
  Grid2x2,
  Eye,
  Save,
  List,
} from 'lucide-react';

export function PropertiesPanel({
  objectFields,
  allFields,
  allObjects,
  onOpenFieldVisibility,
  onOpenSectionVisibility,
  onOpenPicklistDependency,
  onSave,
  onPreview,
}: {
  objectFields: FieldDef[];
  allFields: FieldDef[];
  allObjects?: ObjectDef[];
  onOpenFieldVisibility: () => void;
  onOpenSectionVisibility: () => void;
  onOpenPicklistDependency: () => void;
  onSave: () => void;
  onPreview: () => void;
}) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const tabs = useEditorStore((s) => s.tabs);
  const sections = useEditorStore((s) => s.sections);
  const fields = useEditorStore((s) => s.fields);
  const widgets = useEditorStore((s) => s.widgets);
  const updateTabLabel = useEditorStore((s) => s.updateTabLabel);
  const updateSection = useEditorStore((s) => s.updateSection);
  const updateSectionColumns = useEditorStore((s) => s.updateSectionColumns);
  const updateField = useEditorStore((s) => s.updateField);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const setFields = useEditorStore((s) => s.setFields);
  const markDirty = useEditorStore((s) => s.markDirty);

  const getFieldDef = (apiName: string) => allFields.find((f) => f.apiName === apiName);

  return (
    <div className="w-full min-w-0 border-l bg-white flex flex-col h-full shadow-sm">
      <div className="p-4 border-b">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Properties
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {selectedElement ? (
          <>
            {/* ──── Tab Properties ──── */}
            {selectedElement.type === 'tab' && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  Tab
                </div>
                <Label>Tab Label</Label>
                <Input
                  value={tabs.find((t) => t.id === selectedElement.id)?.label || ''}
                  onChange={(e) => updateTabLabel(selectedElement.id, e.target.value)}
                />
              </div>
            )}

            {/* ──── Section Properties ──── */}
            {selectedElement.type === 'section' && (() => {
              const section = sections.find((s) => s.id === selectedElement.id);
              if (!section) return null;
              return (
                <div className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Section
                  </div>
                  <div>
                    <Label>Section Label</Label>
                    <Input
                      value={section.label}
                      onChange={(e) => updateSection(section.id, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Columns</Label>
                    <div className="flex gap-2 mt-2">
                      {([1, 2, 3, 4] as ColumnCount[]).map((num) => (
                        <Button
                          key={num}
                          variant={section.columns === num ? 'default' : 'outline'}
                          size="sm"
                          className={section.columns === num ? 'bg-brand-navy hover:bg-brand-navy/90' : ''}
                          onClick={() => updateSectionColumns(section.id, num)}
                        >
                          {num === 1 ? (
                            <Layout className="h-4 w-4" />
                          ) : num === 2 ? (
                            <Columns2 className="h-4 w-4" />
                          ) : num === 3 ? (
                            <Columns3 className="h-4 w-4" />
                          ) : (
                            <Grid2x2 className="h-4 w-4" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Input
                      value={section.description ?? ''}
                      placeholder="Shown under the section title in forms"
                      onChange={(e) => updateSection(section.id, { description: e.target.value })}
                    />
                  </div>

                  {/* Show in record */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="showInRecord"
                      checked={section.showInRecord}
                      onChange={(e) => updateSection(section.id, { showInRecord: e.target.checked })}
                      className="h-4 w-4 text-brand-navy border-gray-300 rounded"
                    />
                    <Label htmlFor="showInRecord" className="mb-0 text-sm">
                      Show in Record View
                    </Label>
                  </div>
                  {!section.showInRecord && (
                    <p className="text-xs text-amber-600 mt-1">
                      This section will be hidden on the record detail page.
                    </p>
                  )}

                  {/* Show in template */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="showInTemplate"
                      checked={section.showInTemplate}
                      onChange={(e) => updateSection(section.id, { showInTemplate: e.target.checked })}
                      className="h-4 w-4 text-brand-navy border-gray-300 rounded"
                    />
                    <Label htmlFor="showInTemplate" className="mb-0 text-sm">
                      Show in Record Template
                    </Label>
                  </div>
                  {!section.showInTemplate && (
                    <p className="text-xs text-amber-600 mt-1">
                      This section will be hidden when creating/editing records.
                    </p>
                  )}

                  {/* Section Visibility Rules */}
                  <div className="space-y-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={onOpenSectionVisibility}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {(section.visibleIf?.length ?? 0) > 0
                        ? 'Edit Visibility Rules'
                        : 'Add Visibility Rules'}
                    </Button>
                    {section.visibleIf && section.visibleIf.length > 0 && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <div className="font-semibold text-blue-900 mb-1">Active Rules:</div>
                        {section.visibleIf.map((condition, idx) => {
                          if (condition.left === '__currentUser__') {
                            return (
                              <div key={idx} className="text-blue-700">
                                - Visible to specific users ({Array.isArray(condition.right) ? condition.right.length : 0})
                              </div>
                            );
                          }
                          const condField = objectFields.find((f) => f.apiName === condition.left);
                          return (
                            <div key={idx} className="text-blue-700">
                              - {condField?.label || condition.left} {condition.op} {String(condition.right)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ──── Field Properties ──── */}
            {selectedElement.type === 'field' && (() => {
              const field = fields.find((f) => f.id === selectedElement.id);
              const fieldDef = field ? getFieldDef(field.fieldApiName) : null;
              if (!field || !fieldDef) return <div className="text-sm text-gray-500">Field not found</div>;
              return (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Field
                  </div>

                  {/* Field info */}
                  <div className="space-y-2 mb-4 pb-4 border-b">
                    <div>
                      <span className="text-xs text-gray-500">Label:</span>
                      <div className="font-medium">{fieldDef.label}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">API Name:</span>
                      <div className="font-medium text-xs">{fieldDef.apiName}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Type:</span>
                      <div className="font-medium">{fieldDef.type}</div>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Required:</span>
                      <div className="font-medium">{fieldDef.required ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  {/* Span info */}
                  {(field.colSpan > 1 || field.rowSpan > 1) && (
                    <div className="mb-4 pb-4 border-b">
                      <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">
                        Span
                      </div>
                      <div className="text-sm">
                        {field.colSpan} col &times; {field.rowSpan} row
                      </div>
                      <div className="text-xs text-gray-400 mt-1">Drag field edges to resize</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs h-7"
                        onClick={() => {
                          updateField(field.id, { colSpan: 1, rowSpan: 1 });
                        }}
                      >
                        Reset to 1&times;1
                      </Button>
                    </div>
                  )}

                  {/* Label appearance */}
                  <div className="space-y-3 mb-4 pb-4 border-b">
                    <div className="text-xs text-gray-500 font-semibold uppercase tracking-wide">
                      Label appearance
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={!!field.presentation?.labelBold}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          updateField(field.id, {
                            presentation: {
                              ...field.presentation,
                              labelBold: checked || undefined,
                            },
                          });
                        }}
                      />
                      Bold label
                    </label>
                    <div>
                      <Label>Label color</Label>
                      <Select
                        value={field.presentation?.labelColorToken ?? 'default'}
                        onValueChange={(v) => {
                          const token = v as LabelColorToken;
                          updateField(field.id, {
                            presentation: {
                              ...field.presentation,
                              labelColorToken: token === 'default' ? undefined : token,
                            },
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="brand">Brand</SelectItem>
                          <SelectItem value="muted">Muted</SelectItem>
                          <SelectItem value="danger">Danger</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Visibility rules */}
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={onOpenFieldVisibility}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {fieldDef.visibleIf && fieldDef.visibleIf.length > 0
                        ? 'Edit Visibility Rules'
                        : 'Add Visibility Rules'}
                    </Button>
                    {fieldDef.visibleIf && fieldDef.visibleIf.length > 0 && (
                      <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                        <div className="font-semibold text-blue-900 mb-1">Active Rules:</div>
                        {fieldDef.visibleIf.map((condition, idx) => {
                          if (condition.left === '__currentUser__') {
                            return (
                              <div key={idx} className="text-blue-700">
                                - Visible to specific users ({Array.isArray(condition.right) ? condition.right.length : 0})
                              </div>
                            );
                          }
                          const condField = objectFields.find((f) => f.apiName === condition.left);
                          return (
                            <div key={idx} className="text-blue-700">
                              - {condField?.label || condition.left} {condition.op} {String(condition.right)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Picklist dependencies */}
                  {(fieldDef.type === 'Picklist' ||
                    fieldDef.type === 'MultiPicklist' ||
                    fieldDef.type === 'MultiSelectPicklist' ||
                    fieldDef.type === 'PicklistText') &&
                    fieldDef.picklistValues &&
                    fieldDef.picklistValues.length > 0 && (
                      <div className="space-y-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={onOpenPicklistDependency}
                        >
                          <List className="h-4 w-4 mr-2" />
                          {fieldDef.picklistDependencies && fieldDef.picklistDependencies.length > 0
                            ? 'Edit Value Dependencies'
                            : 'Add Value Dependencies'}
                        </Button>
                        {fieldDef.picklistDependencies && fieldDef.picklistDependencies.length > 0 && (
                          <div className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <div className="font-semibold text-amber-900 mb-1">Dependency Rules:</div>
                            {fieldDef.picklistDependencies.map((rule, idx) => (
                              <div key={idx} className="text-amber-700">
                                - Rule {idx + 1}: {rule.conditions.length} condition
                                {rule.conditions.length !== 1 ? 's' : ''} &rarr; {rule.values.length} value
                                {rule.values.length !== 1 ? 's' : ''}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                </div>
              );
            })()}

            {/* ──── Widget Properties (Phase 3E) ──── */}
            {selectedElement.type === 'widget' && (() => {
              const widget = widgets.find((w) => w.id === selectedElement.id);
              if (!widget) return <div className="text-sm text-gray-500">Widget not found</div>;
              return (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Widget
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-xs text-gray-500">Type:</span>
                      <div className="font-medium">{widget.widgetType}</div>
                    </div>

                    {/* Related List config */}
                    {widget.config.type === 'RelatedList' && (
                      <>
                        <div>
                          <Label>Related Object</Label>
                          <Select
                            value={widget.config.relatedObjectApiName || ''}
                            onValueChange={(v) =>
                              updateWidget(widget.id, {
                                config: { ...widget.config, relatedObjectApiName: v },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select object..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(allObjects || []).map((obj) => (
                                <SelectItem key={obj.apiName} value={obj.apiName}>
                                  {obj.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Relationship Field</Label>
                          <Input
                            value={widget.config.relationshipFieldApiName || ''}
                            placeholder="e.g. Account__c"
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                config: {
                                  ...widget.config,
                                  relationshipFieldApiName: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Max Rows</Label>
                          <Input
                            type="number"
                            value={widget.config.maxRows ?? 5}
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                config: {
                                  ...widget.config,
                                  maxRows: parseInt(e.target.value) || 5,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Custom Label (optional)</Label>
                          <Input
                            value={widget.config.label ?? ''}
                            placeholder="Override default label"
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                config: {
                                  ...widget.config,
                                  label: e.target.value || undefined,
                                },
                              })
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* Activity Feed config */}
                    {widget.config.type === 'ActivityFeed' && (
                      <div>
                        <Label>Max Items</Label>
                        <Input
                          type="number"
                          value={widget.config.maxItems ?? 10}
                          onChange={(e) =>
                            updateWidget(widget.id, {
                              config: {
                                ...widget.config,
                                maxItems: parseInt(e.target.value) || 10,
                              },
                            })
                          }
                        />
                      </div>
                    )}

                    {/* File Folder config */}
                    {widget.config.type === 'FileFolder' && (
                      <>
                        <div>
                          <Label>Provider</Label>
                          <Select
                            value={widget.config.provider}
                            onValueChange={(v) =>
                              updateWidget(widget.id, {
                                config: {
                                  ...widget.config,
                                  provider: v as 'dropbox' | 'google-drive' | 'local',
                                },
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="dropbox">Dropbox</SelectItem>
                              <SelectItem value="google-drive">Google Drive</SelectItem>
                              <SelectItem value="local">Local</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Folder ID (optional)</Label>
                          <Input
                            value={widget.config.folderId ?? ''}
                            placeholder="Folder identifier"
                            onChange={(e) =>
                              updateWidget(widget.id, {
                                config: {
                                  ...widget.config,
                                  folderId: e.target.value || undefined,
                                },
                              })
                            }
                          />
                        </div>
                      </>
                    )}

                    {/* Custom Component config */}
                    {widget.config.type === 'CustomComponent' && (
                      <div>
                        <Label>Component ID</Label>
                        <Input
                          value={widget.config.componentId || ''}
                          placeholder="e.g. my-custom-widget"
                          onChange={(e) =>
                            updateWidget(widget.id, {
                              config: {
                                ...widget.config,
                                componentId: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    )}

                    {widget.config.type === 'Spacer' && (
                      <div>
                        <Label>Min height (px)</Label>
                        <Input
                          type="number"
                          min={8}
                          max={400}
                          value={widget.config.minHeightPx ?? 32}
                          onChange={(e) =>
                            updateWidget(widget.id, {
                              config: {
                                ...widget.config,
                                minHeightPx: Math.max(8, parseInt(e.target.value, 10) || 32),
                              },
                            })
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="text-sm text-gray-500">
            Select a tab, section, field, or widget to view properties
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="p-4 border-t space-y-2">
        <Button
          onClick={onSave}
          className="w-full bg-brand-navy hover:bg-brand-navy/90 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Layout
        </Button>
        <Button variant="outline" className="w-full" type="button" onClick={onPreview}>
          <Eye className="h-4 w-4 mr-2" />
          Preview Form
        </Button>
      </div>
    </div>
  );
}
