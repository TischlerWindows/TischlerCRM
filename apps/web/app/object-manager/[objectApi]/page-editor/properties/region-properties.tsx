'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab, LayoutSection } from '../types';
import { useEditorStore } from '../editor-store';
import { ColorControl, REGION_WIDTH_OPTIONS, clamp, createId, withCopyLabel } from './shared';

interface RegionPropertiesProps {
  selection: {
    kind: 'region';
    tab: LayoutTab;
    region: LayoutSection;
  };
}

export function RegionProperties({ selection }: RegionPropertiesProps) {
  const updateSection = useEditorStore((s) => s.updateSection);
  const removeSection = useEditorStore((s) => s.removeSection);
  const resizeSection = useEditorStore((s) => s.resizeSection);
  const addSection = useEditorStore((s) => s.addSection);

  const duplicateSection = () => {
    const source = selection.region;
    const maxEndRow = selection.tab.regions.reduce((max, region) => {
      const rowEnd = region.gridRow + Math.max(1, region.gridRowSpan) - 1;
      return Math.max(max, rowEnd);
    }, 0);
    const clonedPanels = source.panels.map((panel, index) => ({
      ...structuredClone(panel),
      id: createId('panel'),
      order: index,
    }));
    const clonedWidgets = source.widgets.map((widget, index) => ({
      ...structuredClone(widget),
      id: createId('widget'),
      order: index,
    }));

    const clonedSection: LayoutSection = {
      ...structuredClone(source),
      id: createId('region'),
      label: withCopyLabel(source.label),
      gridColumn: 1,
      gridColumnSpan: clamp(source.gridColumnSpan, 1, 12),
      gridRow: maxEndRow + 1,
      panels: clonedPanels,
      widgets: clonedWidgets,
    };

    addSection(clonedSection, selection.tab.id);
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Label</Label>
        <Input
          value={selection.region.label}
          onChange={(e) => updateSection(selection.region.id, { label: e.target.value })}
          aria-label="Section label"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Width (grid columns)</Label>
        <div className="flex flex-wrap gap-1.5">
          {REGION_WIDTH_OPTIONS.map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={selection.region.gridColumnSpan === value ? 'default' : 'outline'}
              onClick={() => resizeSection(selection.region.id, value)}
            >
              {value}
            </Button>
          ))}
        </div>
      </div>

      <ColorControl
        label="Background color"
        value={selection.region.style.background}
        onChange={(value) =>
          updateSection(selection.region.id, {
            style: { ...selection.region.style, background: value },
          })
        }
      />

      <ColorControl
        label="Border color"
        value={selection.region.style.borderColor}
        onChange={(value) =>
          updateSection(selection.region.id, {
            style: { ...selection.region.style, borderColor: value },
          })
        }
      />

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Border style</Label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={selection.region.style.borderStyle ?? 'solid'}
          aria-label="Section border style"
          onChange={(e) =>
            updateSection(selection.region.id, {
              style: {
                ...selection.region.style,
                borderStyle: e.target.value as 'solid' | 'dashed' | 'none',
              },
            })
          }
        >
          <option value="solid">solid</option>
          <option value="dashed">dashed</option>
          <option value="none">none</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Shadow</Label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={selection.region.style.shadow ?? 'none'}
          aria-label="Section shadow"
          onChange={(e) =>
            updateSection(selection.region.id, {
              style: { ...selection.region.style, shadow: e.target.value as 'none' | 'sm' | 'md' },
            })
          }
        >
          <option value="none">none</option>
          <option value="sm">sm</option>
          <option value="md">md</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Corner radius</Label>
        <select
          className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
          value={selection.region.style.borderRadius ?? 'none'}
          aria-label="Section corner radius"
          onChange={(e) =>
            updateSection(selection.region.id, {
              style: {
                ...selection.region.style,
                borderRadius: e.target.value as 'none' | 'sm' | 'lg',
              },
            })
          }
        >
          <option value="none">none</option>
          <option value="sm">sm</option>
          <option value="lg">lg</option>
        </select>
      </div>

      <div className="flex gap-2 border-t border-gray-200 pt-3">
        <Button type="button" variant="outline" className="flex-1" onClick={duplicateSection}>
          Duplicate Section
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          onClick={() => removeSection(selection.region.id)}
        >
          Delete Section
        </Button>
      </div>
    </>
  );
}
