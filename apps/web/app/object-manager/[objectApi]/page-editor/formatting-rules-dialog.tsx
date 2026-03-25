'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
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
import type {
  FieldDef,
  FieldHighlightToken,
  FormattingRule,
  FormattingRuleTarget,
} from '@/lib/schema';
import { generateId } from '@/lib/schema';
import { useEditorStore } from './editor-store';
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';

type TargetKind = FormattingRuleTarget['kind'];

interface RegionTargetOption {
  regionId: string;
  label: string;
}

interface PanelTargetOption {
  panelId: string;
  label: string;
}

interface FieldTargetOption {
  panelId: string;
  fieldApiName: string;
  label: string;
}

interface TargetOptions {
  fieldTargets: FieldTargetOption[];
  panelTargets: PanelTargetOption[];
  regionTargets: RegionTargetOption[];
}

type BadgeToken = NonNullable<FormattingRule['effects']['badge']>;

function normalizeRulesFromInput(rules: FormattingRule[]): FormattingRule[] {
  return [...rules]
    .sort((a, b) => a.order - b.order)
    .map((rule, index) => ({
      ...rule,
      order: index,
      when: Array.isArray(rule.when) ? [...rule.when] : [],
      effects: { ...rule.effects },
    }));
}

function reindexRulesPreserveOrder(rules: FormattingRule[]): FormattingRule[] {
  return rules.map((rule, index) => ({
    ...rule,
    order: index,
    when: Array.isArray(rule.when) ? [...rule.when] : [],
    effects: { ...rule.effects },
  }));
}

function isTargetKind(value: string): value is TargetKind {
  return value === 'field' || value === 'panel' || value === 'region';
}

function isBadgeToken(value: string): value is BadgeToken {
  return value === 'success' || value === 'warning' || value === 'destructive';
}

function isHighlightToken(value: string): value is FieldHighlightToken {
  return (
    value === 'none' ||
    value === 'subtle' ||
    value === 'attention' ||
    value === 'positive' ||
    value === 'critical'
  );
}

function isTargetValid(target: FormattingRuleTarget, options: TargetOptions): boolean {
  if (target.kind === 'field') {
    return options.fieldTargets.some(
      (option) =>
        option.panelId === target.panelId && option.fieldApiName === target.fieldApiName,
    );
  }
  if (target.kind === 'panel') {
    return options.panelTargets.some((option) => option.panelId === target.panelId);
  }
  return options.regionTargets.some((option) => option.regionId === target.regionId);
}

function toFieldSelectValue(target: Pick<FieldTargetOption, 'panelId' | 'fieldApiName'>): string {
  return `${target.panelId}::${target.fieldApiName}`;
}

function toFieldTarget(value: string): Pick<FieldTargetOption, 'panelId' | 'fieldApiName'> | null {
  const [panelId, fieldApiName] = value.split('::');
  if (!panelId || !fieldApiName) return null;
  return { panelId, fieldApiName };
}

function resolveDefaultTarget(
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
): FormattingRuleTarget {
  const firstField = fieldTargets[0];
  if (firstField) {
    return {
      kind: 'field',
      fieldApiName: firstField.fieldApiName,
      panelId: firstField.panelId,
    };
  }
  const firstPanel = panelTargets[0];
  if (firstPanel) {
    return {
      kind: 'panel',
      panelId: firstPanel.panelId,
    };
  }
  const firstRegion = regionTargets[0];
  if (firstRegion) {
    return {
      kind: 'region',
      regionId: firstRegion.regionId,
    };
  }
  return {
    kind: 'region',
    regionId: '',
  };
}

function buildTargetForKind(
  kind: TargetKind,
  current: FormattingRuleTarget,
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
): FormattingRuleTarget {
  if (kind === 'field') {
    if (current.kind === 'field') return current;
    const first = fieldTargets[0];
    return {
      kind: 'field',
      fieldApiName: first?.fieldApiName ?? '',
      panelId: first?.panelId ?? '',
    };
  }
  if (kind === 'panel') {
    if (current.kind === 'panel') return current;
    const first = panelTargets[0];
    return {
      kind: 'panel',
      panelId: first?.panelId ?? '',
    };
  }
  if (current.kind === 'region') return current;
  const first = regionTargets[0];
  return {
    kind: 'region',
    regionId: first?.regionId ?? '',
  };
}

function summarizeTarget(
  target: FormattingRuleTarget,
  fieldTargets: FieldTargetOption[],
  panelTargets: PanelTargetOption[],
  regionTargets: RegionTargetOption[],
): string {
  if (target.kind === 'field') {
    const match = fieldTargets.find(
      (option) =>
        option.panelId === target.panelId && option.fieldApiName === target.fieldApiName,
    );
    return match
      ? `Field: ${match.label}`
      : `Field: ${target.fieldApiName || 'Unknown'} (${target.panelId || 'no panel'})`;
  }
  if (target.kind === 'panel') {
    const match = panelTargets.find((option) => option.panelId === target.panelId);
    return match ? `Panel: ${match.label}` : `Panel: ${target.panelId || 'Unknown'}`;
  }
  const match = regionTargets.find((option) => option.regionId === target.regionId);
  return match ? `Region: ${match.label}` : `Region: ${target.regionId || 'Unknown'}`;
}

function buildFieldLabelMap(fields: FieldDef[]): Map<string, string> {
  return new Map(fields.map((field) => [field.apiName, field.label]));
}

function SortableRuleRow({
  rule,
  selected,
  targetSummary,
  onToggleActive,
  onEdit,
  onDelete,
}: {
  rule: FormattingRule;
  selected: boolean;
  targetSummary: string;
  onToggleActive: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border px-3 py-2 ${
        selected ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
          aria-label={`Reorder ${rule.name}`}
          onPointerDown={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">{rule.name}</div>
              <div className="truncate text-xs text-gray-600">{targetSummary}</div>
            </div>
            <label className="inline-flex items-center gap-1 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={rule.active}
                onChange={(event) => onToggleActive(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Active
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700"
              onClick={onDelete}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FormattingRulesDialog({
  open,
  onOpenChange,
  rules,
  onApply,
  sections: _sections,
  objectFields,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rules: FormattingRule[];
  onApply: (next: FormattingRule[]) => void;
  sections: { id: string; label: string }[];
  objectFields: FieldDef[];
}) {
  const layout = useEditorStore((s) => s.layout);
  const [working, setWorking] = useState<FormattingRule[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const fieldLabelMap = useMemo(() => buildFieldLabelMap(objectFields), [objectFields]);

  const { fieldTargets, panelTargets, regionTargets } = useMemo(() => {
    const nextFieldTargets: FieldTargetOption[] = [];
    const nextPanelTargets: PanelTargetOption[] = [];
    const nextRegionTargets: RegionTargetOption[] = [];

    for (const tab of layout.tabs) {
      for (const region of tab.regions) {
        nextRegionTargets.push({
          regionId: region.id,
          label: `${region.label} (${tab.label})`,
        });
        for (const panel of region.panels) {
          nextPanelTargets.push({
            panelId: panel.id,
            label: `${panel.label} (${region.label})`,
          });
          for (const field of panel.fields) {
            const fieldLabel = fieldLabelMap.get(field.fieldApiName) ?? field.fieldApiName;
            nextFieldTargets.push({
              panelId: panel.id,
              fieldApiName: field.fieldApiName,
              label: `${fieldLabel} (${panel.label})`,
            });
          }
        }
      }
    }

    return {
      fieldTargets: nextFieldTargets,
      panelTargets: nextPanelTargets,
      regionTargets: nextRegionTargets,
    };
  }, [layout, fieldLabelMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!open) return;
    const nextWorking = normalizeRulesFromInput(rules);
    setWorking(nextWorking);
    setSelectedRuleId(nextWorking[0]?.id ?? null);
  }, [open, rules]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const selectedRule = useMemo(
    () => working.find((rule) => rule.id === selectedRuleId) ?? null,
    [working, selectedRuleId],
  );

  const hasFieldTargetOptions = fieldTargets.length > 0;
  const hasPanelTargetOptions = panelTargets.length > 0;
  const hasRegionTargetOptions = regionTargets.length > 0;
  const hasAnyValidTargetOptions =
    hasFieldTargetOptions || hasPanelTargetOptions || hasRegionTargetOptions;
  const targetOptions: TargetOptions = { fieldTargets, panelTargets, regionTargets };
  const hasInvalidOrUnresolvedTargets = working.some(
    (rule) => !isTargetValid(rule.target, targetOptions),
  );

  const updateRule = (id: string, updater: (rule: FormattingRule) => FormattingRule) => {
    setWorking((previous) =>
      reindexRulesPreserveOrder(previous.map((rule) => (rule.id === id ? updater(rule) : rule))),
    );
  };

  const addRule = () => {
    if (!hasAnyValidTargetOptions) return;
    const defaultTarget = resolveDefaultTarget(fieldTargets, panelTargets, regionTargets);
    const nextRule: FormattingRule = {
      id: generateId(),
      name: `Rule ${working.length + 1}`,
      active: true,
      order: working.length,
      when: [],
      target: defaultTarget,
      effects: {},
    };
    setWorking((previous) => reindexRulesPreserveOrder([...previous, nextRule]));
    setSelectedRuleId(nextRule.id);
  };

  const removeRule = (id: string) => {
    setWorking((previous) => {
      const remaining = reindexRulesPreserveOrder(previous.filter((rule) => rule.id !== id));
      setSelectedRuleId((currentSelectedId) => {
        if (currentSelectedId === id) return remaining[0]?.id ?? null;
        if (!currentSelectedId) return remaining[0]?.id ?? null;
        return remaining.some((rule) => rule.id === currentSelectedId)
          ? currentSelectedId
          : (remaining[0]?.id ?? null);
      });
      return remaining;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setWorking((previous) => {
      const oldIndex = previous.findIndex((rule) => rule.id === active.id);
      const newIndex = previous.findIndex((rule) => rule.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return previous;
      return reindexRulesPreserveOrder(arrayMove(previous, oldIndex, newIndex));
    });
  };

  if (!open) return null;

  const close = () => onOpenChange(false);

  const fakeFieldForEditor: FieldDef = {
    id: 'formatting-when',
    apiName: '__formatting_when__',
    label: selectedRule ? `When conditions for ${selectedRule.name}` : 'When conditions',
    type: 'Text',
    visibleIf: selectedRule?.when ?? [],
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={close}
        aria-label="Close formatting rules editor"
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col border-l border-gray-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formatting-rules-title"
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 id="formatting-rules-title" className="text-base font-semibold text-gray-900">
              Layout formatting rules
            </h2>
            <p className="text-xs text-gray-600">
              First matching active rule wins. Drag to reorder priority.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
              <h3 className="text-sm font-medium text-gray-900">Rules</h3>
              <Button type="button" size="sm" onClick={addRule} disabled={!hasAnyValidTargetOptions}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add rule
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {working.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No formatting rules yet.
                </div>
              ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={working.map((rule) => rule.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {working.map((rule) => (
                        <SortableRuleRow
                          key={rule.id}
                          rule={rule}
                          selected={rule.id === selectedRuleId}
                          targetSummary={summarizeTarget(
                            rule.target,
                            fieldTargets,
                            panelTargets,
                            regionTargets,
                          )}
                          onToggleActive={(next) =>
                            updateRule(rule.id, (current) => ({ ...current, active: next }))
                          }
                          onEdit={() => setSelectedRuleId(rule.id)}
                          onDelete={() => removeRule(rule.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </section>

          <section className="min-h-0 overflow-auto rounded-lg border border-gray-200">
            {!selectedRule ? (
              <div className="p-6 text-sm text-gray-600">Select a rule to edit.</div>
            ) : (
              <div className="space-y-4 p-4">
                <div>
                  <Label htmlFor="formatting-rule-name">Name</Label>
                  <Input
                    id="formatting-rule-name"
                    value={selectedRule.name}
                    onChange={(event) =>
                      updateRule(selectedRule.id, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Target kind</Label>
                  <Select
                    value={selectedRule.target.kind}
                    onValueChange={(value) => {
                      if (!isTargetKind(value)) return;
                      updateRule(selectedRule.id, (current) => ({
                        ...current,
                        target: buildTargetForKind(
                          value,
                          current.target,
                          fieldTargets,
                          panelTargets,
                          regionTargets,
                        ),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="field" disabled={!hasFieldTargetOptions}>
                        Field
                      </SelectItem>
                      <SelectItem value="panel" disabled={!hasPanelTargetOptions}>
                        Panel
                      </SelectItem>
                      <SelectItem value="region" disabled={!hasRegionTargetOptions}>
                        Region
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedRule.target.kind === 'field' && (
                  <div className="space-y-2">
                    <Label>Field target (field + panel)</Label>
                    <Select
                      value={toFieldSelectValue(selectedRule.target)}
                      onValueChange={(value) => {
                        const next = toFieldTarget(value);
                        if (!next) return;
                        updateRule(selectedRule.id, (current) => ({
                          ...current,
                          target: {
                            kind: 'field',
                            fieldApiName: next.fieldApiName,
                            panelId: next.panelId,
                          },
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose field target" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTargets.map((option) => (
                          <SelectItem
                            key={`${option.panelId}-${option.fieldApiName}`}
                            value={toFieldSelectValue(option)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedRule.target.kind === 'panel' && (
                  <div className="space-y-2">
                    <Label>Panel target</Label>
                    <Select
                      value={selectedRule.target.panelId}
                      onValueChange={(panelId) =>
                        updateRule(selectedRule.id, (current) => ({
                          ...current,
                          target: { kind: 'panel', panelId },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose panel target" />
                      </SelectTrigger>
                      <SelectContent>
                        {panelTargets.map((option) => (
                          <SelectItem key={option.panelId} value={option.panelId}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedRule.target.kind === 'region' && (
                  <div className="space-y-2">
                    <Label>Region target</Label>
                    <Select
                      value={selectedRule.target.regionId}
                      onValueChange={(regionId) =>
                        updateRule(selectedRule.id, (current) => ({
                          ...current,
                          target: { kind: 'region', regionId },
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose region target" />
                      </SelectTrigger>
                      <SelectContent>
                        {regionTargets.map((option) => (
                          <SelectItem key={option.regionId} value={option.regionId}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>When conditions (all must match)</Label>
                  <FieldVisibilityRuleEditor
                    field={fakeFieldForEditor}
                    availableFields={objectFields}
                    onSave={(conditions) =>
                      updateRule(selectedRule.id, (current) => ({
                        ...current,
                        when: conditions,
                      }))
                    }
                    onCancel={() => {}}
                  />
                </div>

                <div className="space-y-3 rounded-md border border-gray-200 p-3">
                  <Label>Effects</Label>
                  <div className="flex flex-wrap gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={!!selectedRule.effects.hidden}
                        onChange={(event) =>
                          updateRule(selectedRule.id, (current) => ({
                            ...current,
                            effects: {
                              ...current.effects,
                              hidden: event.target.checked ? true : undefined,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Hidden
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={!!selectedRule.effects.readOnly}
                        onChange={(event) =>
                          updateRule(selectedRule.id, (current) => ({
                            ...current,
                            effects: {
                              ...current.effects,
                              readOnly: event.target.checked ? true : undefined,
                            },
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Read-only
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Badge</Label>
                      <Select
                        value={selectedRule.effects.badge ?? 'none'}
                        onValueChange={(value) => {
                          if (value !== 'none' && !isBadgeToken(value)) return;
                          updateRule(selectedRule.id, (current) => ({
                            ...current,
                            effects: {
                              ...current.effects,
                              badge: value === 'none' ? undefined : value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="destructive">Destructive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Highlight token</Label>
                      <Select
                        value={selectedRule.effects.highlightToken ?? 'none'}
                        onValueChange={(value) => {
                          if (!isHighlightToken(value)) return;
                          updateRule(selectedRule.id, (current) => ({
                            ...current,
                            effects: {
                              ...current.effects,
                              highlightToken: value === 'none' ? undefined : value,
                            },
                          }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="subtle">Subtle</SelectItem>
                          <SelectItem value="attention">Attention</SelectItem>
                          <SelectItem value="positive">Positive</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button type="button" variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={hasInvalidOrUnresolvedTargets}
            onClick={() => {
              onApply(reindexRulesPreserveOrder(working));
              onOpenChange(false);
            }}
          >
            Apply to layout
          </Button>
        </footer>
      </aside>
    </div>
  );
}
