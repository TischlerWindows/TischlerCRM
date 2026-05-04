'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { GripVertical, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab, LayoutSection, LayoutPanel, PanelField } from '../types';
import type { TeamMemberSlotConfig, FieldDef } from '@/lib/schema';
import { useEditorStore } from '../editor-store';
import { useSchemaStore } from '@/lib/schema-store';
import { ColorControl, FontSizeCombobox } from './shared';
import TeamMemberSlotConfigPanel from '@/widgets/internal/team-member-slot/ConfigPanel';
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

interface FieldPropertiesProps {
  selection: {
    kind: 'field';
    tab: LayoutTab;
    region: LayoutSection;
    panel: LayoutPanel;
    field: PanelField;
  };
}

function SortableFieldItem({
  apiName,
  label,
  onRemove,
}: {
  apiName: string
  label: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: apiName,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
    >
      <button
        type="button"
        className="cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing"
        aria-label={`Reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-gray-700">{label}</span>
      <button
        type="button"
        className="text-gray-300 hover:text-gray-500"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function DisplayFieldsSection({
  title,
  objectApiName,
  selectedFields,
  onChange,
}: {
  title: string
  objectApiName: string
  selectedFields: string[]
  onChange: (fields: string[]) => void
}) {
  const schema = useSchemaStore((s) => s.schema)

  const availableFields: FieldDef[] = useMemo(() => {
    if (!schema) return []
    const obj = schema.objects.find((o) => o.apiName === objectApiName)
    if (!obj) return []
    const SYSTEM_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'modifiedBy', 'ownerId'])
    const EXCLUDED_TYPES = new Set(['Lookup', 'ExternalLookup', 'LookupFields', 'LookupUser', 'PicklistLookup', 'AutoNumber', 'Formula', 'RollupSummary', 'AutoUser'])
    return obj.fields.filter(
      (f) => !SYSTEM_FIELDS.has(f.apiName) && !EXCLUDED_TYPES.has(f.type),
    )
  }, [schema, objectApiName])

  const unselectedFields = useMemo(
    () => availableFields.filter((f) => !selectedFields.includes(f.apiName)),
    [availableFields, selectedFields],
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = selectedFields.indexOf(String(active.id))
    const newIndex = selectedFields.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(selectedFields, oldIndex, newIndex))
  }

  const handleAdd = (apiName: string) => {
    onChange([...selectedFields, apiName])
  }

  const handleRemove = (apiName: string) => {
    onChange(selectedFields.filter((f) => f !== apiName))
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase text-gray-400">{title}</div>
      {selectedFields.length > 0 ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={selectedFields} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {selectedFields.map((apiName) => {
                const def = availableFields.find((f) => f.apiName === apiName)
                return (
                  <SortableFieldItem
                    key={apiName}
                    apiName={apiName}
                    label={def?.label ?? apiName}
                    onRemove={() => handleRemove(apiName)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="rounded border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] text-gray-400">
          No fields selected
        </div>
      )}
      {unselectedFields.length > 0 && (
        <select
          className="w-full rounded border border-dashed border-gray-300 bg-transparent px-2 py-1.5 text-[11px] text-gray-500"
          value=""
          onChange={(e) => {
            if (e.target.value) handleAdd(e.target.value)
          }}
        >
          <option value="">+ Add {objectApiName.toLowerCase()} field</option>
          {unselectedFields.map((f) => (
            <option key={f.apiName} value={f.apiName}>
              {f.label}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function FieldProperties({ selection }: FieldPropertiesProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const removeField = useEditorStore((s) => s.removeField);
  const schema = useSchemaStore((s) => s.schema);

  const routeParams = useParams();
  const objectApi = typeof routeParams?.objectApi === 'string' ? routeParams.objectApi : undefined;

  const isSlot = selection.field.kind === 'teamMemberSlot' && !!selection.field.slotConfig;
  const isLookupFieldsVirtual = selection.field.kind === 'lookupFields';

  // Real LookupFields FieldType (not the legacy virtual kind)
  const fieldDefType = useMemo(() => {
    if (!objectApi || !schema) return undefined;
    return schema.objects
      .find((o) => o.apiName === objectApi)
      ?.fields.find((f) => f.apiName === selection.field.fieldApiName)?.type;
  }, [objectApi, schema, selection.field.fieldApiName]);

  const isRealLookupFieldsType = fieldDefType === 'LookupFields';
  const isLookupFields = isLookupFieldsVirtual || isRealLookupFieldsType;

  // displayFields from the FieldDef (only relevant for real type)
  const fieldDefDisplayFields = useMemo<string[]>(() => {
    if (!objectApi || !schema) return [];
    const fd = schema.objects
      .find((o) => o.apiName === objectApi)
      ?.fields.find((f) => f.apiName === selection.field.fieldApiName);
    return (fd as any)?.displayFields ?? [];
  }, [objectApi, schema, selection.field.fieldApiName]);

  // Fields on the current object (for source-lookup selector)
  const currentObjectFields = useMemo(() => {
    if (!objectApi || !schema) return [];
    return schema.objects.find((o) => o.apiName === objectApi)?.fields ?? [];
  }, [objectApi, schema]);

  // All lookup-type fields on the current object
  const lookupTypeFields = useMemo(() => {
    return currentObjectFields.filter((f) =>
      f.type === 'Lookup' || f.type === 'ExternalLookup' || f.type === 'LookupUser' || f.type === 'PicklistLookup',
    );
  }, [currentObjectFields]);

  const lookupConfig = selection.field.lookupFieldsConfig;

  // Determine the target object api from the selected source lookup field
  const targetObjectApi = useMemo(() => {
    if (!lookupConfig?.sourceLookupApiName) return null;
    const src = currentObjectFields.find((f) => f.apiName === lookupConfig.sourceLookupApiName);
    return src?.lookupObject ?? (src as any)?.relationship?.targetObject ?? null;
  }, [lookupConfig?.sourceLookupApiName, currentObjectFields]);

  // Fields on the target object (for display-fields selector)
  const targetObjectFields = useMemo(() => {
    if (!targetObjectApi || !schema) return [];
    return schema.objects.find((o) => o.apiName === targetObjectApi)?.fields ?? [];
  }, [targetObjectApi, schema]);

  return (
    <>
      {isLookupFields && (
        <div className="space-y-3 rounded-md border border-blue-200 bg-blue-50/40 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            Lookup Fields
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-600">Source Lookup Field</Label>
            <select
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
              value={lookupConfig?.sourceLookupApiName ?? ''}
              aria-label="Source lookup field"
              onChange={(e) =>
                updateField(selection.field.fieldApiName, selection.panel.id, {
                  lookupFieldsConfig: {
                    sourceLookupApiName: e.target.value,
                    displayFields: [],
                  },
                })
              }
            >
              <option value="">— Select lookup field —</option>
              {lookupTypeFields.map((f) => (
                <option key={f.apiName} value={f.apiName}>
                  {f.label} ({f.apiName})
                </option>
              ))}
            </select>
          </div>

          {/* For virtual kind: editable display-fields checklist */}
          {isLookupFieldsVirtual && targetObjectApi && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">
                Fields to Display
                <span className="ml-1 text-gray-400">({targetObjectApi})</span>
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-md border border-gray-200 bg-white p-2">
                {targetObjectFields.map((f) => {
                  const isChecked = lookupConfig?.displayFields?.includes(f.apiName) ?? false;
                  return (
                    <label
                      key={f.apiName}
                      className="flex items-center gap-2 cursor-pointer py-0.5 px-1 rounded hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5"
                        checked={isChecked}
                        onChange={(e) => {
                          const curr = lookupConfig?.displayFields ?? [];
                          const next = e.target.checked
                            ? [...curr, f.apiName]
                            : curr.filter((n) => n !== f.apiName);
                          updateField(selection.field.fieldApiName, selection.panel.id, {
                            lookupFieldsConfig: {
                              ...lookupConfig,
                              sourceLookupApiName: lookupConfig?.sourceLookupApiName ?? '',
                              displayFields: next,
                            },
                          });
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-700">{f.label}</span>
                      <span className="shrink-0 text-[10px] text-gray-400">{f.apiName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* For real FieldType: show read-only summary of configured displayFields */}
          {isRealLookupFieldsType && fieldDefDisplayFields.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-600">Fields Displayed</Label>
              <div className="rounded-md border border-gray-200 bg-white p-2 text-xs text-gray-600">
                <p className="mb-1 text-[10px] text-gray-400">Configured in Object Manager</p>
                <ul className="space-y-0.5">
                  {fieldDefDisplayFields.map((apiName) => {
                    const tf = targetObjectFields.find((f) => f.apiName === apiName);
                    return (
                      <li key={apiName} className="truncate">
                        {tf ? tf.label : apiName}
                        <span className="ml-1 text-[10px] text-gray-400">({apiName})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {lookupConfig?.sourceLookupApiName && !targetObjectApi && (
            <p className="text-xs text-amber-700">
              Could not resolve target object for this lookup field.
            </p>
          )}
        </div>
      )}
      {isSlot && selection.field.slotConfig && (
        <div className="space-y-2 rounded-md border border-purple-200 bg-purple-50/40 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
            Connection Slot
          </div>
          <TeamMemberSlotConfigPanel
            config={selection.field.slotConfig as unknown as Record<string, unknown>}
            onChange={(next) =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                slotConfig: next as unknown as TeamMemberSlotConfig,
              })
            }
            record={{}}
            integration={null}
            object={{ apiName: '', label: '', fields: [] }}
          />
        </div>
      )}
      {isSlot && selection.field.slotConfig && (() => {
        const slotMode = (selection.field.slotConfig as TeamMemberSlotConfig).mode ?? 'paired'
        const currentDisplayFields = (selection.field.slotConfig as TeamMemberSlotConfig).displayFields ?? {}
        const showContact = slotMode === 'contact' || slotMode === 'paired'
        const showAccount = slotMode === 'account' || slotMode === 'paired'

        const updateDisplayFields = (patch: { Contact?: string[]; Account?: string[] }) => {
          const next = { ...currentDisplayFields, ...patch }
          updateField(selection.field.fieldApiName, selection.panel.id, {
            slotConfig: {
              ...(selection.field.slotConfig as TeamMemberSlotConfig),
              displayFields: next,
            } as unknown as TeamMemberSlotConfig,
          })
        }

        return (
          <div className="space-y-3 pt-2">
            {showContact && (
              <DisplayFieldsSection
                title="Display Fields — Contact"
                objectApiName="Contact"
                selectedFields={currentDisplayFields.Contact ?? []}
                onChange={(fields) => updateDisplayFields({ Contact: fields })}
              />
            )}
            {showAccount && (
              <DisplayFieldsSection
                title="Display Fields — Account"
                objectApiName="Account"
                selectedFields={currentDisplayFields.Account ?? []}
                onChange={(fields) => updateDisplayFields({ Account: fields })}
              />
            )}
            {slotMode === 'account' && (
              <div className="rounded bg-gray-50 px-2 py-1.5 text-center text-[11px] text-gray-400">
                Contact fields not available in account-only mode
              </div>
            )}
            {slotMode === 'contact' && (
              <div className="rounded bg-gray-50 px-2 py-1.5 text-center text-[11px] text-gray-400">
                Account fields not available in contact-only mode
              </div>
            )}
          </div>
        )
      })()}
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Label Override</Label>
        <Input
          value={selection.field.labelOverride ?? ''}
          aria-label="Field label override"
          onChange={(e) =>
            updateField(
              selection.field.fieldApiName,
              selection.panel.id,
              { labelOverride: e.target.value || undefined },
            )
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Behavior</Label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={selection.field.behavior}
          aria-label="Field behavior"
          onChange={(e) =>
            updateField(selection.field.fieldApiName, selection.panel.id, {
              behavior: e.target.value as PanelField['behavior'],
            })
          }
        >
          <option value="none">none</option>
          <option value="required">required</option>
          <option value="readOnly">readOnly</option>
          <option value="hidden">hidden</option>
        </select>
      </div>

      <ColorControl
        label="Label color"
        value={selection.field.labelStyle.color}
        onChange={(value) =>
          updateField(selection.field.fieldApiName, selection.panel.id, {
            labelStyle: { ...selection.field.labelStyle, color: value },
          })
        }
      />

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Label text</Label>
        <div className="flex items-center gap-1">
          <FontSizeCombobox
            value={selection.field.labelStyle.fontSize}
            defaultValue={12}
            onChange={(value) =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                labelStyle: { ...selection.field.labelStyle, fontSize: value },
              })
            }
          />
          <div className="w-px h-5.5 bg-gray-200 mx-0.5" />
          <Button
            type="button"
            size="sm"
            variant={selection.field.labelStyle.bold ? 'default' : 'outline'}
            aria-pressed={!!selection.field.labelStyle.bold}
            onClick={() =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                labelStyle: {
                  ...selection.field.labelStyle,
                  bold: !selection.field.labelStyle.bold,
                },
              })
            }
          >
            Bold
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selection.field.labelStyle.italic ? 'default' : 'outline'}
            aria-pressed={!!selection.field.labelStyle.italic}
            onClick={() =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                labelStyle: {
                  ...selection.field.labelStyle,
                  italic: !selection.field.labelStyle.italic,
                },
              })
            }
          >
            Italic
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selection.field.labelStyle.uppercase ? 'default' : 'outline'}
            aria-pressed={!!selection.field.labelStyle.uppercase}
            onClick={() =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                labelStyle: {
                  ...selection.field.labelStyle,
                  uppercase: !selection.field.labelStyle.uppercase,
                },
              })
            }
          >
            Uppercase
          </Button>
        </div>
      </div>

      <ColorControl
        label="Value color"
        value={selection.field.valueStyle.color}
        onChange={(value) =>
          updateField(selection.field.fieldApiName, selection.panel.id, {
            valueStyle: { ...selection.field.valueStyle, color: value },
          })
        }
      />

      <ColorControl
        label="Value background"
        value={selection.field.valueStyle.background}
        onChange={(value) =>
          updateField(selection.field.fieldApiName, selection.panel.id, {
            valueStyle: { ...selection.field.valueStyle, background: value },
          })
        }
      />

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Value text</Label>
        <div className="flex items-center gap-1">
          <FontSizeCombobox
            value={selection.field.valueStyle.fontSize}
            defaultValue={14}
            onChange={(value) =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                valueStyle: { ...selection.field.valueStyle, fontSize: value },
              })
            }
          />
          <div className="w-px h-5.5 bg-gray-200 mx-0.5" />
          <Button
            type="button"
            size="sm"
            variant={selection.field.valueStyle.bold ? 'default' : 'outline'}
            aria-pressed={!!selection.field.valueStyle.bold}
            onClick={() =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                valueStyle: {
                  ...selection.field.valueStyle,
                  bold: !selection.field.valueStyle.bold,
                },
              })
            }
          >
            Bold
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selection.field.valueStyle.italic ? 'default' : 'outline'}
            aria-pressed={!!selection.field.valueStyle.italic}
            onClick={() =>
              updateField(selection.field.fieldApiName, selection.panel.id, {
                valueStyle: {
                  ...selection.field.valueStyle,
                  italic: !selection.field.valueStyle.italic,
                },
              })
            }
          >
            Italic
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-3">
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          onClick={() => removeField(selection.field.fieldApiName, selection.panel.id)}
        >
          Remove from Layout
        </Button>
      </div>
    </>
  );
}
