'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
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
  const allTabs = useEditorStore((s) => s.layout.tabs);

  // P3: Duplicate-tab-label warning. The wizard step indicator on create
  // forms uses the tab label verbatim, so two tabs both labeled "Main" (the
  // default) produce the "Main / Main / Review" stepper that QA flagged as
  // confusing. The rename input below has always existed; this banner makes
  // the problem discoverable so users actually use it.
  const trimmed = selection.tab.label.trim().toLowerCase();
  const duplicateCount = trimmed
    ? allTabs.filter((t) => t.label.trim().toLowerCase() === trimmed).length
    : 0;
  const hasDuplicate = duplicateCount > 1;

  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">Tab Label</Label>
        <Input
          value={selection.tab.label}
          onChange={(e) => updateTab(selection.tab.id, { label: e.target.value })}
          aria-label="Tab label"
          aria-invalid={hasDuplicate || undefined}
        />
        {hasDuplicate && (
          <div className="flex items-start gap-1.5 rounded border border-orange-300 bg-orange-50 px-2 py-1.5 text-[11px] text-orange-800">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              Another tab in this layout has the same label. The wizard
              step indicator will show duplicate names — give each tab a
              unique label.
            </span>
          </div>
        )}
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
