'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LayoutTab, LayoutSection, LayoutPanel, PanelField, LayoutWidget, PageLayout } from '../types';
import { useEditorStore } from '../editor-store';

/* ---------- constants ---------- */

export const SWATCH_COLORS = [
  '#ffffff',
  '#f1f5f9',
  '#e0f2fe',
  '#dcfce7',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#1e293b',
] as const;

export const REGION_WIDTH_OPTIONS = [3, 4, 6, 8, 9, 12] as const;
export const PANEL_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

/* ---------- types ---------- */

export type ResolvedSelection =
  | { kind: 'region'; tab: LayoutTab; region: LayoutSection }
  | { kind: 'panel'; tab: LayoutTab; region: LayoutSection; panel: LayoutPanel }
  | {
      kind: 'field';
      tab: LayoutTab;
      region: LayoutSection;
      panel: LayoutPanel;
      field: PanelField;
    }
  | { kind: 'widget'; tab: LayoutTab; region: LayoutSection; widget: LayoutWidget }
  | null;

export interface FloatingPropertiesProps {
  onClose: () => void;
  availableFields?: import('@/lib/schema').FieldDef[];
}

/* ---------- helper functions ---------- */

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createId(prefix: 'region' | 'panel' | 'widget'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function withCopyLabel(label: string): string {
  return label.trim() ? `${label} Copy` : 'Copy';
}

export function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeHex(value: string): string {
  return value.startsWith('#') ? value : `#${value}`;
}

export function validColorForNativeInput(value: string | undefined): string {
  if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return '#ffffff';
}

/* ---------- shared sub-components ---------- */

interface ColorControlProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}

export function ColorControl({ label, value, onChange }: ColorControlProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="grid grid-cols-7 gap-1">
        {SWATCH_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            className={`h-5 rounded border ${
              value?.toLowerCase() === swatch
                ? 'border-brand-navy ring-1 ring-brand-navy/40'
                : 'border-gray-300'
            }`}
            style={{ backgroundColor: swatch }}
            aria-label={`Set color ${swatch}`}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          className="h-8 w-10 rounded border border-gray-300 bg-white p-1"
          value={validColorForNativeInput(value)}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} color picker`}
        />
        <Input
          value={value ?? ''}
          onChange={(e) => {
            const next = e.target.value.trim();
            onChange(next ? normalizeHex(next) : '');
          }}
          placeholder="#ffffff"
          className="h-8 text-xs"
          aria-label={`${label} hex value`}
        />
      </div>
    </div>
  );
}

export function TabBar({
  active,
  onChange,
  rulesCount,
}: {
  active: 'style' | 'visibility' | 'rules';
  onChange: (tab: 'style' | 'visibility' | 'rules') => void;
  rulesCount: number;
}) {
  const tabs = [
    { id: 'style' as const, label: 'Style' },
    { id: 'visibility' as const, label: 'Visibility' },
    { id: 'rules' as const, label: rulesCount > 0 ? `Rules (${rulesCount})` : 'Rules' },
  ];
  return (
    <div className="flex border-b border-gray-200">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            active === tab.id
              ? 'border-b-2 border-brand-navy text-brand-navy font-semibold'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function VisibilityTab({ selection }: { selection: ResolvedSelection }) {
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const updateSection = useEditorStore((s) => s.updateSection);
  const updateField = useEditorStore((s) => s.updateField);

  if (!selection) return null;
  if (selection.kind === 'widget') return null;

  const isHidden =
    selection.kind === 'field'
      ? selection.field.behavior === 'hidden'
      : selection.kind === 'panel'
      ? selection.panel.hidden === true
      : selection.region.hidden === true;

  const handleToggle = (hide: boolean) => {
    if (selection.kind === 'field') {
      updateField(selection.field.fieldApiName, selection.panel.id, {
        behavior: hide ? 'hidden' : 'none',
      });
    } else if (selection.kind === 'panel') {
      updatePanel(selection.panel.id, { hidden: hide });
    } else if (selection.kind === 'region') {
      updateSection(selection.region.id, { hidden: hide });
    }
  };

  return (
    <div className="overflow-y-auto flex-1 p-3 space-y-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Visibility
        </div>
        <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => handleToggle(false)}
            className={`flex-1 py-1.5 font-medium transition-colors ${
              !isHidden ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Always show
          </button>
          <button
            type="button"
            onClick={() => handleToggle(true)}
            className={`flex-1 py-1.5 font-medium transition-colors border-l border-gray-200 ${
              isHidden ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Always hide
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="text-xs text-gray-500 mb-2">
          For conditional show/hide based on record values, use Formatting Rules.
        </div>
        <button
          type="button"
          className="w-full rounded-md border border-dashed border-gray-300 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent('open-formatting-rules', {
                detail: {
                  targetFilter: {
                    type: selection.kind === 'field' ? 'field' : selection.kind,
                    id:
                      selection.kind === 'field'
                        ? selection.field.fieldApiName
                        : selection.kind === 'panel'
                        ? selection.panel.id
                        : selection.kind === 'region'
                        ? selection.region.id
                        : '',
                    panelId: selection.kind === 'field' ? selection.panel.id : undefined,
                  },
                },
              })
            );
          }}
        >
          + Add condition rule
        </button>
      </div>
    </div>
  );
}

export function RulesTab({
  selection,
  layout,
}: {
  selection: ResolvedSelection;
  layout: PageLayout;
}) {
  if (!selection) return null;
  if (selection.kind === 'widget') return null;

  const matchingRules = (layout.formattingRules ?? []).filter((rule) => {
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
    return false;
  });

  if (matchingRules.length === 0) {
    return (
      <div className="overflow-y-auto flex-1 p-3">
        <div className="text-xs text-gray-500">
          No rules for this element.{' '}
          <span className="text-gray-700">Add one from the Visibility tab.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 p-3 space-y-2">
      {matchingRules.map((rule) => (
        <div key={rule.id} className="rounded-md border border-gray-200 p-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-gray-800">{rule.name || 'Unnamed rule'}</span>
            <button
              type="button"
              className="text-brand-navy hover:underline"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('open-formatting-rules', {
                    detail: { ruleId: rule.id },
                  })
                );
              }}
            >
              Edit
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {rule.effects.hidden && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Hidden</span>
            )}
            {rule.effects.readOnly && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Read Only</span>
            )}
            {rule.effects.badge && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Badge</span>
            )}
            {rule.effects.highlightToken && rule.effects.highlightToken !== 'none' && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">Highlight</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
