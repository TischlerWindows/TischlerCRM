'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab, LayoutSection, LayoutPanel } from '../types';
import { useEditorStore } from '../editor-store';
import { ColorControl, FontSizeCombobox, PANEL_COLUMN_OPTIONS, createId, withCopyLabel } from './shared';

interface PanelPropertiesProps {
  selection: {
    kind: 'panel';
    tab: LayoutTab;
    region: LayoutSection;
    panel: LayoutPanel;
  };
}

export function PanelProperties({ selection }: PanelPropertiesProps) {
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const removePanel = useEditorStore((s) => s.removePanel);
  const addPanel = useEditorStore((s) => s.addPanel);

  const duplicatePanel = () => {
    const source = selection.panel;

    const clonedPanel: LayoutPanel = {
      ...structuredClone(source),
      id: createId('panel'),
      label: withCopyLabel(source.label),
      order: selection.region.panels.length,
      fields: source.fields.map((field, index) => ({ ...structuredClone(field), order: index })),
    };

    addPanel(clonedPanel, selection.region.id);
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Label</Label>
        <Input
          value={selection.panel.label}
          onChange={(e) => updatePanel(selection.panel.id, { label: e.target.value })}
          aria-label="Panel label"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Columns</Label>
        <div className="flex flex-wrap gap-1.5">
          {PANEL_COLUMN_OPTIONS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={selection.panel.columns === value ? 'default' : 'outline'}
              onClick={() => updatePanel(selection.panel.id, { columns: value })}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <ColorControl
        label="Header background"
        value={selection.panel.style.headerBackground}
        onChange={(value) =>
          updatePanel(selection.panel.id, {
            style: { ...selection.panel.style, headerBackground: value },
          })
        }
      />

      <ColorControl
        label="Header text color"
        value={selection.panel.style.headerTextColor}
        onChange={(value) =>
          updatePanel(selection.panel.id, {
            style: { ...selection.panel.style, headerTextColor: value },
          })
        }
      />

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Header text</Label>
        <div className="flex items-center gap-1">
          <FontSizeCombobox
            value={selection.panel.style.headerFontSize}
            defaultValue={14}
            onChange={(value) =>
              updatePanel(selection.panel.id, {
                style: { ...selection.panel.style, headerFontSize: value },
              })
            }
          />
          <div className="w-px h-5.5 bg-gray-200 mx-0.5" />
          <Button
            type="button"
            size="sm"
            variant={selection.panel.style.headerBold ? 'default' : 'outline'}
            aria-pressed={!!selection.panel.style.headerBold}
            onClick={() =>
              updatePanel(selection.panel.id, {
                style: {
                  ...selection.panel.style,
                  headerBold: !selection.panel.style.headerBold,
                },
              })
            }
          >
            Bold
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selection.panel.style.headerItalic ? 'default' : 'outline'}
            aria-pressed={!!selection.panel.style.headerItalic}
            onClick={() =>
              updatePanel(selection.panel.id, {
                style: {
                  ...selection.panel.style,
                  headerItalic: !selection.panel.style.headerItalic,
                },
              })
            }
          >
            Italic
          </Button>
          <Button
            type="button"
            size="sm"
            variant={selection.panel.style.headerUppercase ? 'default' : 'outline'}
            aria-pressed={!!selection.panel.style.headerUppercase}
            onClick={() =>
              updatePanel(selection.panel.id, {
                style: {
                  ...selection.panel.style,
                  headerUppercase: !selection.panel.style.headerUppercase,
                },
              })
            }
          >
            Uppercase
          </Button>
        </div>
      </div>

      <ColorControl
        label="Body background"
        value={selection.panel.style.bodyBackground}
        onChange={(value) =>
          updatePanel(selection.panel.id, {
            style: { ...selection.panel.style, bodyBackground: value },
          })
        }
      />

      <div className="flex gap-2 border-t border-gray-200 pt-3">
        <Button type="button" variant="outline" className="flex-1" onClick={duplicatePanel}>
          Duplicate Panel
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={() => removePanel(selection.panel.id)}
        >
          Delete Panel
        </Button>
      </div>
    </>
  );
}
