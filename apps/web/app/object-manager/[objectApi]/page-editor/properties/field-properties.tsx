'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab, LayoutSection, LayoutPanel, PanelField } from '../types';
import type { TeamMemberSlotConfig } from '@/lib/schema';
import { useEditorStore } from '../editor-store';
import { ColorControl } from './shared';
import TeamMemberSlotConfigPanel from '@/widgets/internal/team-member-slot/ConfigPanel';

interface FieldPropertiesProps {
  selection: {
    kind: 'field';
    tab: LayoutTab;
    region: LayoutSection;
    panel: LayoutPanel;
    field: PanelField;
  };
}

export function FieldProperties({ selection }: FieldPropertiesProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const removeField = useEditorStore((s) => s.removeField);

  const isSlot = selection.field.kind === 'teamMemberSlot' && !!selection.field.slotConfig;

  return (
    <>
      {isSlot && selection.field.slotConfig && (
        <div className="space-y-2 rounded-md border border-purple-200 bg-purple-50/40 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-700">
            Team Member Slot
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
        <Label className="text-xs text-gray-600">Label style</Label>
        <div className="flex gap-2">
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
        <Label className="text-xs text-gray-600">Value style</Label>
        <div className="flex gap-2">
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
