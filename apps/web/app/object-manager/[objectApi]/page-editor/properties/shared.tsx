'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldVisibilityRuleEditor } from '@/components/field-visibility-rule-editor';
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
export const FONT_SIZE_PRESETS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32] as const;

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
  | { kind: 'tab'; tab: LayoutTab }
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

interface FontSizeComboboxProps {
  value: number | undefined;
  defaultValue: number;
  onChange: (value: number | undefined) => void;
}

export function FontSizeCombobox({ value, defaultValue, onChange }: FontSizeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const displayed = value ?? defaultValue;

  useEffect(() => {
    setDraft(String(displayed));
  }, [displayed]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const commit = (raw: string) => {
    const parsed = parseNumber(raw, defaultValue);
    const clamped = clamp(parsed, 8, 32);
    if (clamped === defaultValue) {
      onChange(undefined);
    } else {
      onChange(clamped);
    }
    setDraft(String(clamped));
  };

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <div className="flex items-center">
        <input
          type="text"
          className="h-8 w-[52px] rounded-l-md border border-gray-300 px-2 text-sm text-center focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(draft)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(draft);
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            } else if (e.key === 'Escape') {
              setDraft(String(displayed));
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Font size"
        />
        <button
          type="button"
          className="h-8 w-5 flex items-center justify-center rounded-r-md border border-l-0 border-gray-300 bg-white hover:bg-gray-50"
          onClick={() => setOpen((prev) => !prev)}
          tabIndex={-1}
          aria-label="Toggle font size presets"
        >
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>
      </div>
      {open && (
        <div className="absolute top-[33px] left-0 z-50 w-[72px] max-h-[200px] overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {FONT_SIZE_PRESETS.map((size) => (
            <button
              key={size}
              type="button"
              className={`flex w-full items-center justify-between px-2 py-1 text-sm hover:bg-gray-100 ${
                size === displayed ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-800'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                if (size === defaultValue) {
                  onChange(undefined);
                } else {
                  onChange(size);
                }
                setDraft(String(size));
                setOpen(false);
              }}
            >
              {size}
              {size === displayed && <Check className="h-3 w-3" />}
            </button>
          ))}
        </div>
      )}
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

/* ---------- Hide on New/Existing checkboxes ---------- */

/** Resolves legacy hideOnExisting into hideOnView + hideOnEdit for reading. */
export function resolveHideFlags(el: {
  hideOnNew?: boolean;
  hideOnView?: boolean;
  hideOnEdit?: boolean;
  hideOnExisting?: boolean;
}): { hideOnNew: boolean; hideOnView: boolean; hideOnEdit: boolean } {
  return {
    hideOnNew: !!el.hideOnNew,
    hideOnView: !!el.hideOnView || !!el.hideOnExisting,
    hideOnEdit: !!el.hideOnEdit || !!el.hideOnExisting,
  };
}

function getHideOnHelperText(
  hideOnNew: boolean,
  hideOnView: boolean,
  hideOnEdit: boolean,
  elementLabel: string,
): string | null {
  if (hideOnNew && hideOnView && hideOnEdit) {
    return `This ${elementLabel} is hidden everywhere. Consider using formatting rules instead.`;
  }
  const visible: string[] = [];
  if (!hideOnNew) visible.push('New Record');
  if (!hideOnView) visible.push('View');
  if (!hideOnEdit) visible.push('Edit');
  if (visible.length === 3) return null;
  if (visible.length === 0) return `This ${elementLabel} is hidden everywhere.`;
  return `This ${elementLabel} will only appear on: ${visible.join(', ')}.`;
}

export function HideOnCheckboxes({
  hideOnNew,
  hideOnView,
  hideOnEdit,
  hideOnExisting,
  onChange,
  elementLabel,
}: {
  hideOnNew?: boolean;
  hideOnView?: boolean;
  hideOnEdit?: boolean;
  /** @deprecated legacy flag — auto-migrated to hideOnView + hideOnEdit on first edit */
  hideOnExisting?: boolean;
  onChange: (patch: { hideOnNew?: boolean; hideOnView?: boolean; hideOnEdit?: boolean; hideOnExisting?: boolean }) => void;
  elementLabel: string;
}) {
  // Resolve legacy hideOnExisting into the new flags for display
  const resolved = resolveHideFlags({ hideOnNew, hideOnView, hideOnEdit, hideOnExisting });
  const helperText = getHideOnHelperText(resolved.hideOnNew, resolved.hideOnView, resolved.hideOnEdit, elementLabel);

  // When the user toggles any checkbox, migrate legacy hideOnExisting and clear it
  const handleToggle = (field: 'hideOnNew' | 'hideOnView' | 'hideOnEdit', checked: boolean) => {
    const next: { hideOnNew?: boolean; hideOnView?: boolean; hideOnEdit?: boolean; hideOnExisting?: boolean } = {
      hideOnNew: resolved.hideOnNew,
      hideOnView: resolved.hideOnView,
      hideOnEdit: resolved.hideOnEdit,
      hideOnExisting: undefined, // clear legacy flag after first edit
    };
    next[field] = checked;
    // Normalize false → undefined to keep JSON clean
    for (const key of ['hideOnNew', 'hideOnView', 'hideOnEdit'] as const) {
      if (!next[key]) next[key] = undefined;
    }
    onChange(next);
  };

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Record Visibility
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={resolved.hideOnNew}
            onChange={(e) => handleToggle('hideOnNew', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Hide on New Record
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={resolved.hideOnView}
            onChange={(e) => handleToggle('hideOnView', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Hide on View
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={resolved.hideOnEdit}
            onChange={(e) => handleToggle('hideOnEdit', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Hide on Edit
        </label>
      </div>
      {helperText && (
        <p className="mt-1.5 text-[11px] text-gray-400 italic">{helperText}</p>
      )}
    </div>
  );
}

export function VisibilityTab({ selection, availableFields = [] }: { selection: ResolvedSelection; availableFields?: import('@/lib/schema').FieldDef[] }) {
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const updateSection = useEditorStore((s) => s.updateSection);
  const updateField = useEditorStore((s) => s.updateField);
  const updateTab = useEditorStore((s) => s.updateTab);

  // All hooks MUST be called before any conditional returns (Rules of Hooks)
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  const handleSaveConditions = useCallback((conditions: import('@/lib/schema').ConditionExpr[]) => {
    if (!selection) return;
    if (selection.kind === 'region') {
      updateSection(selection.region.id, { visibleIf: conditions.length > 0 ? conditions : undefined } as any);
    } else if (selection.kind === 'panel') {
      updatePanel(selection.panel.id, { visibleIf: conditions.length > 0 ? conditions : undefined } as any);
    }
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 3000);
  }, [selection, updateSection, updatePanel]);

  // Conditional returns come AFTER all hooks
  if (!selection) return null;
  if (selection.kind === 'widget') return null;

  // For tabs, only show the HideOnCheckboxes (no always show/hide or visibleIf)
  if (selection.kind === 'tab') {
    return (
      <div className="overflow-y-auto flex-1 p-3 space-y-4">
        <HideOnCheckboxes
          hideOnNew={selection.tab.hideOnNew}
          hideOnView={selection.tab.hideOnView}
          hideOnEdit={selection.tab.hideOnEdit}
          hideOnExisting={selection.tab.hideOnExisting}
          onChange={(patch) => updateTab(selection.tab.id, patch)}
          elementLabel="tab"
        />
      </div>
    );
  }

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

  // visibleIf conditions for regions and panels
  const visibleIfConditions: import('@/lib/schema').ConditionExpr[] =
    selection.kind === 'region'
      ? (selection.region as any).visibleIf ?? []
      : selection.kind === 'panel'
      ? (selection.panel as any).visibleIf ?? []
      : [];

  // Build a fake FieldDef so we can reuse FieldVisibilityRuleEditor
  const fakeField: import('@/lib/schema').FieldDef = {
    id: 'visibility-conditions',
    apiName: '__visibility__',
    label: 'Visibility conditions',
    type: 'Text',
    visibleIf: visibleIfConditions,
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
        {(() => {
          const source: any =
            selection.kind === 'field' ? selection.field :
            selection.kind === 'panel' ? selection.panel :
            selection.region;
          const label =
            selection.kind === 'field' ? 'field' :
            selection.kind === 'panel' ? 'panel' : 'section';
          return (
            <HideOnCheckboxes
              hideOnNew={source.hideOnNew}
              hideOnView={source.hideOnView}
              hideOnEdit={source.hideOnEdit}
              hideOnExisting={source.hideOnExisting}
              onChange={(patch) => {
                if (selection.kind === 'field') {
                  updateField(selection.field.fieldApiName, selection.panel.id, patch);
                } else if (selection.kind === 'panel') {
                  updatePanel(selection.panel.id, patch);
                } else if (selection.kind === 'region') {
                  updateSection(selection.region.id, patch);
                }
              }}
              elementLabel={label}
            />
          );
        })()}
      </div>

      {(selection.kind === 'region' || selection.kind === 'panel') && (
        <div className="border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Show only when
          </div>
          <div className="text-[11px] text-gray-500 mb-2">
            When conditions are set, this {selection.kind === 'region' ? 'section' : 'panel'} is hidden by default and only shown when <strong>all</strong> conditions are met.
          </div>
          <FieldVisibilityRuleEditor
            field={fakeField}
            availableFields={availableFields}
            onSave={handleSaveConditions}
            onCancel={() => {}}
          />
          {saved && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-xs font-medium text-green-700 animate-in fade-in duration-200">
              <Check className="h-3.5 w-3.5" />
              Visibility rules saved
            </div>
          )}
        </div>
      )}
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
