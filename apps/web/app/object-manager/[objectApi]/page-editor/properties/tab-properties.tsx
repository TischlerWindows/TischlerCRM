'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab } from '../types';
import { useEditorStore } from '../editor-store';
import { parseNumber } from './shared';

interface TabPropertiesProps {
  selection: {
    kind: 'tab';
    tab: LayoutTab;
  };
}

export function TabProperties({ selection }: TabPropertiesProps) {
  const updateTab = useEditorStore((s) => s.updateTab);

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Tab Label</Label>
        <Input
          value={selection.tab.label}
          onChange={(e) => updateTab(selection.tab.id, { label: e.target.value })}
          aria-label="Tab label"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Order</Label>
        <Input
          type="number"
          value={selection.tab.order}
          onChange={(e) => updateTab(selection.tab.id, { order: parseNumber(e.target.value, selection.tab.order) })}
          aria-label="Tab order"
          className="w-20"
          min={0}
        />
      </div>
    </>
  );
}
