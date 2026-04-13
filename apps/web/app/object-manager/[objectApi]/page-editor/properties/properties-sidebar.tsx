'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FieldDef } from '@/lib/schema';
import { useEditorStore } from '../editor-store';
import type { ResolvedSelection, FloatingPropertiesProps } from './shared';
import { TabBar, VisibilityTab, RulesTab } from './shared';
import { RegionProperties } from './region-properties';
import { PanelProperties } from './panel-properties';
import { FieldProperties } from './field-properties';
import { WidgetConfigPanel } from './widget-config-panel';
import { TabProperties } from './tab-properties';

export function FloatingProperties({ onClose, availableFields = [] }: FloatingPropertiesProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedElement = useEditorStore((s) => s.selectedElement);
  const layout = useEditorStore((s) => s.layout);

  const [activeTab, setActiveTab] = useState<'style' | 'visibility' | 'rules'>('style');

  useEffect(() => {
    setActiveTab('style');
  }, [selectedElement?.id, selectedElement?.type]);

  const selection = useMemo<ResolvedSelection>(() => {
    if (!selectedElement) return null;

    for (const tab of layout.tabs) {
      if (selectedElement.type === 'tab' && selectedElement.id === tab.id) {
        return { kind: 'tab', tab };
      }

      for (const region of tab.regions) {
        if (selectedElement.type === 'region' && selectedElement.id === region.id) {
          return { kind: 'region', tab, region };
        }

        for (const panel of region.panels) {
          if (selectedElement.type === 'panel' && selectedElement.id === panel.id) {
            return { kind: 'panel', tab, region, panel };
          }
          if (
            selectedElement.type === 'field' &&
            selectedElement.panelId === panel.id
          ) {
            const field = panel.fields.find(
              (candidate) => candidate.fieldApiName === selectedElement.id,
            );
            if (field) {
              return { kind: 'field', tab, region, panel, field };
            }
          }
        }

        if (selectedElement.type === 'widget') {
          const widget = region.widgets.find((candidate) => candidate.id === selectedElement.id);
          if (widget) {
            return { kind: 'widget', tab, region, widget };
          }
        }
      }
    }

    return null;
  }, [layout.tabs, selectedElement]);

  const rulesCount = useMemo(() => {
    if (!selection || !layout.formattingRules) return 0;
    return layout.formattingRules.filter((rule) => {
      if (rule.active === false) return false;
      if (selection.kind === 'field') {
        return (
          rule.target.kind === 'field' &&
          rule.target.fieldApiName === selection.field.fieldApiName &&
          rule.target.panelId === selection.panel.id
        );
      }
      if (selection.kind === 'panel') {
        return rule.target.kind === 'panel' && rule.target.panelId === selection.panel.id;
      }
      if (selection.kind === 'region') {
        return rule.target.kind === 'region' && rule.target.regionId === selection.region.id;
      }
      if (selection.kind === 'tab') {
        return rule.target.kind === 'tab' && rule.target.tabId === selection.tab.id;
      }
      return false;
    }).length;
  }, [layout.formattingRules, selection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  if (!selection) {
    return (
      <div className="flex h-full flex-col border-l border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="text-sm font-semibold text-gray-900">Properties</div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <div className="rounded-full bg-gray-100 p-3">
            <Settings className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">Click a section, panel, or field to configure it</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col overflow-hidden border-l border-gray-200 bg-white"
      role="region"
      aria-label="Properties panel"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="text-sm font-semibold text-gray-900">
          {selection.kind === 'region' && 'Section Properties'}
          {selection.kind === 'panel' && 'Panel Properties'}
          {selection.kind === 'field' && 'Field Properties'}
          {selection.kind === 'widget' && 'Widget Properties'}
          {selection.kind === 'tab' && 'Tab Properties'}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label="Close properties panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {selection.kind !== 'widget' && (
        <TabBar active={activeTab} onChange={setActiveTab} rulesCount={rulesCount} />
      )}

      {activeTab === 'style' && (
        <div className="overflow-y-auto flex-1 space-y-4 p-3 text-sm">
          {selection.kind === 'region' && <RegionProperties selection={selection} />}
          {selection.kind === 'panel' && <PanelProperties selection={selection} />}
          {selection.kind === 'field' && <FieldProperties selection={selection} />}
          {selection.kind === 'widget' && (
            <WidgetConfigPanel selection={selection} availableFields={availableFields} />
          )}
          {selection.kind === 'tab' && <TabProperties selection={selection} />}
        </div>
      )}

      {activeTab === 'visibility' && selection.kind !== 'widget' && <VisibilityTab selection={selection} availableFields={availableFields} />}
      {activeTab === 'rules' && selection.kind !== 'widget' && <RulesTab selection={selection} layout={layout} />}
    </div>
  );
}
