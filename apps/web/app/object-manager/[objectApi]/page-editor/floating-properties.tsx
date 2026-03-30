'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldDef, WidgetConfig } from '@/lib/schema';
import { SchemaRenderer } from '@/lib/widgets/schema-renderer';
import { getWidgetById } from '@/lib/widgets/registry-loader';
import DemoConfigPanel from '@/widgets/external/demo-widget/ConfigPanel';
import type { ConfigPanelProps } from '@/lib/widgets/types';
import { useEditorStore } from './editor-store';
import type { EditorPageLayout, LayoutPanel, LayoutSection, LayoutTab, LayoutWidget, PanelField } from './types';

type ConfigPanelComponent = React.ComponentType<ConfigPanelProps & { objectOptions?: Array<{ value: string; label: string }> }>;

const EXTERNAL_CONFIG_PANELS: Record<string, ConfigPanelComponent> = {
  'demo-widget': DemoConfigPanel,
};

interface FloatingPropertiesProps {
  onClose: () => void;
  availableFields?: FieldDef[];
}

const SWATCH_COLORS = [
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

const REGION_WIDTH_OPTIONS = [3, 4, 6, 8, 9, 12] as const;
const PANEL_COLUMN_OPTIONS = [1, 2, 3, 4] as const;

type ResolvedSelection =
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createId(prefix: 'region' | 'panel' | 'widget'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function withCopyLabel(label: string): string {
  return label.trim() ? `${label} Copy` : 'Copy';
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHex(value: string): string {
  return value.startsWith('#') ? value : `#${value}`;
}

function validColorForNativeInput(value: string | undefined): string {
  if (value && /^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return '#ffffff';
}

interface ColorControlProps {
  label: string;
  value?: string;
  onChange: (value: string) => void;
}

function ColorControl({ label, value, onChange }: ColorControlProps) {
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

const ALL_ACTIONS: Array<'edit' | 'delete'> = ['edit', 'delete'];
const ACTION_LABELS: Record<'edit' | 'delete', string> = { edit: 'Edit', delete: 'Delete' };

function HeaderHighlightsPicker({
  widgetId,
  selectedApiNames,
  visibleActions,
  availableFields,
}: {
  widgetId: string;
  selectedApiNames: string[];
  visibleActions: Array<'edit' | 'delete'>;
  availableFields: FieldDef[];
}) {
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const handleRemove = (apiName: string) => {
    updateWidget(widgetId, {
      config: {
        type: 'HeaderHighlights' as const,
        fieldApiNames: selectedApiNames.filter((n) => n !== apiName),
        visibleActions,
      },
    });
  };

  const handleAdd = (apiName: string) => {
    if (selectedApiNames.includes(apiName) || selectedApiNames.length >= 6) return;
    updateWidget(widgetId, {
      config: {
        type: 'HeaderHighlights' as const,
        fieldApiNames: [...selectedApiNames, apiName],
        visibleActions,
      },
    });
    setDropdownOpen(false);
    setFilterQuery('');
  };

  const handleToggleAction = (action: 'edit' | 'delete') => {
    const next = visibleActions.includes(action)
      ? visibleActions.filter((a) => a !== action)
      : [...visibleActions, action];
    updateWidget(widgetId, {
      config: {
        type: 'HeaderHighlights' as const,
        fieldApiNames: selectedApiNames,
        visibleActions: next,
      },
    });
  };

  const filteredOptions = availableFields.filter(
    (f) =>
      !selectedApiNames.includes(f.apiName) &&
      (f.label.toLowerCase().includes(filterQuery.toLowerCase()) ||
        f.apiName.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Highlight Fields (up to 6)</Label>
        <div className="flex flex-wrap gap-1.5 min-h-[28px]">
          {selectedApiNames.map((apiName) => {
            const fd = availableFields.find((f) => f.apiName === apiName);
            return (
              <span
                key={apiName}
                className="inline-flex items-center gap-1 rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-medium text-brand-navy"
              >
                {fd?.label ?? apiName}
                <button
                  type="button"
                  onClick={() => handleRemove(apiName)}
                  className="text-brand-navy/60 hover:text-brand-navy ml-0.5"
                  aria-label={`Remove ${fd?.label ?? apiName}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
        {selectedApiNames.length < 6 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex w-full items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
            >
              <span className="text-gray-400">+</span> Add field
            </button>
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => { setDropdownOpen(false); setFilterQuery(''); }}
                />
                <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  <div className="sticky top-0 border-b border-gray-100 bg-white p-1.5">
                    <Input
                      autoFocus
                      value={filterQuery}
                      onChange={(e) => setFilterQuery(e.target.value)}
                      placeholder="Search..."
                      className="h-7 text-xs"
                    />
                  </div>
                  {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400">No fields available</div>
                  ) : (
                    filteredOptions.map((f) => (
                      <button
                        key={f.apiName}
                        type="button"
                        onClick={() => handleAdd(f.apiName)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 text-left"
                      >
                        {f.label}
                        <span className="ml-auto text-[10px] text-gray-400">{f.apiName}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-600">Action Buttons</Label>
        <div className="space-y-1.5">
          {ALL_ACTIONS.map((action) => (
            <label
              key={action}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <input
                type="checkbox"
                checked={visibleActions.includes(action)}
                onChange={() => handleToggleAction(action)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-brand-navy accent-brand-navy"
              />
              <span className="text-xs text-gray-700">{ACTION_LABELS[action]}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabBar({
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

function VisibilityTab({ selection }: { selection: ResolvedSelection }) {
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

function RulesTab({
  selection,
  layout,
}: {
  selection: ResolvedSelection;
  layout: EditorPageLayout;
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

export function FloatingProperties({ onClose, availableFields = [] }: FloatingPropertiesProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedElement = useEditorStore((s) => s.selectedElement);
  const layout = useEditorStore((s) => s.layout);

  const updateSection = useEditorStore((s) => s.updateSection);
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const updateField = useEditorStore((s) => s.updateField);
  const updateWidget = useEditorStore((s) => s.updateWidget);

  const removeSection = useEditorStore((s) => s.removeSection);
  const removePanel = useEditorStore((s) => s.removePanel);
  const removeField = useEditorStore((s) => s.removeField);
  const removeWidget = useEditorStore((s) => s.removeWidget);

  const resizeSection = useEditorStore((s) => s.resizeSection);
  const addSection = useEditorStore((s) => s.addSection);
  const addPanel = useEditorStore((s) => s.addPanel);

  const [activeTab, setActiveTab] = useState<'style' | 'visibility' | 'rules'>('style');

  useEffect(() => {
    setActiveTab('style');
  }, [selectedElement?.id, selectedElement?.type]);

  const selection = useMemo<ResolvedSelection>(() => {
    if (!selectedElement) return null;

    for (const tab of layout.tabs) {
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

  const duplicateSection = () => {
    if (!selection || selection.kind !== 'region') return;

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

  const duplicatePanel = () => {
    if (!selection || selection.kind !== 'panel') return;
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
        {selection.kind === 'region' && (
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
        )}

        {selection.kind === 'panel' && (
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
              <Label className="text-xs text-gray-600">Header text style</Label>
              <div className="flex gap-2">
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
        )}

        {selection.kind === 'field' && (
          <>
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
        )}

        {selection.kind === 'widget' && (
          <>
            <div className="rounded-md bg-gray-50 px-2 py-1.5 text-xs text-gray-700">
              Type: <span className="font-medium">{selection.widget.widgetType}</span>
            </div>

            {selection.widget.config.type === 'RelatedList' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">relatedObjectApiName</Label>
                  <Input
                    value={selection.widget.config.relatedObjectApiName}
                    aria-label="Related object API name"
                    onChange={(e) =>
                      updateWidget(selection.widget.id, {
                        config: {
                          ...selection.widget.config,
                          relatedObjectApiName: e.target.value,
                        } as WidgetConfig,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">maxRows</Label>
                  <Input
                    type="number"
                    value={selection.widget.config.maxRows ?? 5}
                    aria-label="Related list max rows"
                    onChange={(e) =>
                      updateWidget(selection.widget.id, {
                        config: {
                          ...selection.widget.config,
                          maxRows: Math.max(1, parseNumber(e.target.value, 5)),
                        } as WidgetConfig,
                      })
                    }
                  />
                </div>
              </>
            )}

            {selection.widget.config.type === 'ActivityFeed' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">maxItems</Label>
                <Input
                  type="number"
                  value={selection.widget.config.maxItems ?? 10}
                  aria-label="Activity feed max items"
                  onChange={(e) =>
                    updateWidget(selection.widget.id, {
                      config: {
                        ...selection.widget.config,
                        maxItems: Math.max(1, parseNumber(e.target.value, 10)),
                      } as WidgetConfig,
                    })
                  }
                />
              </div>
            )}

            {selection.widget.config.type === 'FileFolder' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">provider</Label>
                  <select
                    className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                    value={selection.widget.config.provider}
                    aria-label="File folder provider"
                    onChange={(e) =>
                      updateWidget(selection.widget.id, {
                        config: {
                          ...selection.widget.config,
                          provider: e.target.value as 'dropbox' | 'google-drive' | 'local',
                        } as WidgetConfig,
                      })
                    }
                  >
                    <option value="dropbox">dropbox</option>
                    <option value="google-drive">google-drive</option>
                    <option value="local">local</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-600">folderId</Label>
                  <Input
                    value={selection.widget.config.folderId ?? ''}
                    aria-label="File folder ID"
                    onChange={(e) =>
                      updateWidget(selection.widget.id, {
                        config: {
                          ...selection.widget.config,
                          folderId: e.target.value,
                        } as WidgetConfig,
                      })
                    }
                  />
                </div>
              </>
            )}

            {selection.widget.config.type === 'CustomComponent' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">componentId</Label>
                <Input
                  value={selection.widget.config.componentId}
                  aria-label="Custom component ID"
                  onChange={(e) =>
                    updateWidget(selection.widget.id, {
                      config: {
                        ...selection.widget.config,
                        componentId: e.target.value,
                      } as WidgetConfig,
                    })
                  }
                />
              </div>
            )}

            {selection.widget.config.type === 'Spacer' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-600">minHeightPx</Label>
                <Input
                  type="number"
                  value={selection.widget.config.minHeightPx ?? 32}
                  aria-label="Spacer minimum height"
                  onChange={(e) =>
                    updateWidget(selection.widget.id, {
                      config: {
                        ...selection.widget.config,
                        minHeightPx: Math.max(8, parseNumber(e.target.value, 32)),
                      } as WidgetConfig,
                    })
                  }
                />
              </div>
            )}

            {selection.widget.config.type === 'HeaderHighlights' && (
              <HeaderHighlightsPicker
                widgetId={selection.widget.id}
                selectedApiNames={selection.widget.config.fieldApiNames ?? []}
                visibleActions={selection.widget.config.visibleActions ?? ['edit', 'delete']}
                availableFields={availableFields}
              />
            )}

            {selection.widget.config.type === 'ExternalWidget' && (() => {
              const externalConfig = selection.widget.config;
              const manifest = getWidgetById(externalConfig.externalWidgetId);
              const ExternalConfigPanel = EXTERNAL_CONFIG_PANELS[externalConfig.externalWidgetId];
              return (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-gray-600">Display Mode</Label>
                    <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs">
                      {(['full', 'column'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() =>
                            updateWidget(selection.widget.id, {
                              config: { ...externalConfig, displayMode: mode },
                            })
                          }
                          className={`flex-1 py-1.5 font-medium capitalize transition-colors ${
                            externalConfig.displayMode === mode
                              ? 'bg-brand-navy text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          } ${mode === 'column' ? 'border-l border-gray-200' : ''}`}
                        >
                          {mode === 'full' ? 'Full Width' : 'Column'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {ExternalConfigPanel ? (
                    <ExternalConfigPanel
                      config={externalConfig.config}
                      onChange={(newCfg) =>
                        updateWidget(selection.widget.id, {
                          config: { ...externalConfig, config: newCfg },
                        })
                      }
                      record={{}}
                      integration={null}
                      object={{ apiName: '', label: '', fields: [] }}
                      objectOptions={[]}
                    />
                  ) : manifest ? (
                    <SchemaRenderer
                      schema={manifest.configSchema}
                      config={externalConfig.config}
                      onChange={(key, value) =>
                        updateWidget(selection.widget.id, {
                          config: {
                            ...externalConfig,
                            config: { ...externalConfig.config, [key]: value },
                          },
                        })
                      }
                    />
                  ) : (
                    <div className="text-xs text-gray-400">
                      Widget &quot;{externalConfig.externalWidgetId}&quot; not found in registry.
                    </div>
                  )}

                  {manifest?.integration && (
                    <div className="rounded-md bg-blue-50 px-2.5 py-2 text-xs text-blue-700 border border-blue-100">
                      Powered by {manifest.integration}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="border-t border-gray-200 pt-3">
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                onClick={() => removeWidget(selection.widget.id)}
              >
                Delete widget
              </Button>
            </div>
          </>
        )}
      </div>
      )}

      {activeTab === 'visibility' && selection.kind !== 'widget' && <VisibilityTab selection={selection} />}
      {activeTab === 'rules' && selection.kind !== 'widget' && <RulesTab selection={selection} layout={layout} />}
    </div>
  );
}
