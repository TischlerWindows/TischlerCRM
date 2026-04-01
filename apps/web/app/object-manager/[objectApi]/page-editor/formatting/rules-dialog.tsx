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
import { Button } from '@/components/ui/button';
import type { FieldDef, FormattingRule, FormattingRuleTarget } from '@/lib/schema';
import { generateId } from '@/lib/schema';
import { useEditorStore } from '../editor-store';
import { GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type {
  FieldTargetOption,
  PanelTargetOption,
  RegionTargetOption,
  TargetOptions,
} from './types';
import {
  buildFieldLabelMap,
  isTargetValid,
  normalizeRulesFromInput,
  reindexRulesPreserveOrder,
  resolveDefaultTarget,
  summarizeTarget,
} from './utils';
import { ConditionBuilder } from './condition-builder';
import { EffectPicker } from './effect-picker';
import { RulePreview } from './rule-preview';

/* ------------------------------------------------------------------ */
/*  Rule row components                                               */
/* ------------------------------------------------------------------ */

interface RuleRowProps {
  rule: FormattingRule;
  selected: boolean;
  targetSummary: string;
  onToggleActive: (next: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function RuleRowBody({
  rule,
  selected,
  targetSummary,
  onToggleActive,
  onEdit,
  onDelete,
  dragHandle,
}: RuleRowProps & { dragHandle?: React.ReactNode }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        selected ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-2">
        {dragHandle}
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

function StaticRuleRow(props: RuleRowProps) {
  return <RuleRowBody {...props} />;
}

function SortableRuleRow(props: RuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.rule.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const dragHandle = (
    <button
      type="button"
      className="mt-0.5 cursor-grab rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
      aria-label={`Reorder ${props.rule.name}`}
      onPointerDown={(event) => event.stopPropagation()}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <RuleRowBody {...props} dragHandle={dragHandle} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dialog                                                       */
/* ------------------------------------------------------------------ */

export function FormattingRulesDialog({
  open,
  onOpenChange,
  rules,
  onApply,
  objectFields,
  targetFilter,
  initialRuleId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  rules: FormattingRule[];
  onApply: (next: FormattingRule[]) => void;
  objectFields: FieldDef[];
  targetFilter?: { type: 'field' | 'panel' | 'region'; id: string; panelId?: string };
  initialRuleId?: string;
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
    if (initialRuleId) {
      setSelectedRuleId(initialRuleId);
    } else {
      setSelectedRuleId(nextWorking[0]?.id ?? null);
    }
  }, [open, rules, initialRuleId]);

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

  const displayedRules = useMemo(() => {
    if (!targetFilter) return working;
    return working.filter((rule) => {
      if (targetFilter.type === 'field') {
        return (
          rule.target.kind === 'field' &&
          rule.target.fieldApiName === targetFilter.id &&
          (!targetFilter.panelId || rule.target.panelId === targetFilter.panelId)
        );
      }
      if (targetFilter.type === 'panel') {
        return rule.target.kind === 'panel' && rule.target.panelId === targetFilter.id;
      }
      return rule.target.kind === 'region' && rule.target.regionId === targetFilter.id;
    });
  }, [working, targetFilter]);

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
    let defaultTarget = resolveDefaultTarget(fieldTargets, panelTargets, regionTargets);
    if (targetFilter) {
      if (targetFilter.type === 'panel') {
        const match = panelTargets.find((p) => p.panelId === targetFilter.id);
        if (match) defaultTarget = { kind: 'panel', panelId: match.panelId };
      } else if (targetFilter.type === 'region') {
        const match = regionTargets.find((r) => r.regionId === targetFilter.id);
        if (match) defaultTarget = { kind: 'region', regionId: match.regionId };
      } else if (targetFilter.type === 'field' && targetFilter.panelId) {
        const match = fieldTargets.find(
          (f) => f.fieldApiName === targetFilter.id && f.panelId === targetFilter.panelId,
        );
        if (match) {
          defaultTarget = { kind: 'field', fieldApiName: match.fieldApiName, panelId: match.panelId };
        }
      }
    }
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
              {targetFilter
                ? 'First matching active rule wins.'
                : 'First matching active rule wins. Drag to reorder priority.'}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* ---- Left panel: rule list ---- */}
          <section className="flex min-h-0 flex-col rounded-lg border border-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
              <h3 className="text-sm font-medium text-gray-900">Rules</h3>
              <Button type="button" size="sm" onClick={addRule} disabled={!hasAnyValidTargetOptions}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add rule
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-3">
              {displayedRules.length === 0 ? (
                <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                  No formatting rules yet.
                </div>
              ) : targetFilter ? (
                <div className="space-y-2">
                  {displayedRules.map((rule) => (
                    <StaticRuleRow
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
              ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <SortableContext
                    items={displayedRules.map((rule) => rule.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {displayedRules.map((rule) => (
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

          {/* ---- Right panel: rule editor ---- */}
          <section className="min-h-0 overflow-auto rounded-lg border border-gray-200">
            {!selectedRule ? (
              <div className="p-6 text-sm text-gray-600">Select a rule to edit.</div>
            ) : (
              <div className="space-y-4 p-4">
                <ConditionBuilder
                  rule={selectedRule}
                  objectFields={objectFields}
                  fieldTargets={fieldTargets}
                  panelTargets={panelTargets}
                  regionTargets={regionTargets}
                  hasFieldTargetOptions={hasFieldTargetOptions}
                  hasPanelTargetOptions={hasPanelTargetOptions}
                  hasRegionTargetOptions={hasRegionTargetOptions}
                  onUpdateRule={updateRule}
                />

                <EffectPicker rule={selectedRule} onUpdateRule={updateRule} />

                <RulePreview rule={selectedRule} />
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
