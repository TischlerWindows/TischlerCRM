'use client';

import type { CSSProperties, JSX } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { WidgetType } from '@/lib/schema';
import type { WidgetManifest } from '@/lib/widgets/types';
import { internalWidgets } from '@/widgets/internal/registry';
import { externalWidgets } from '@/widgets/external/registry';
import {
  Activity,
  Component,
  FolderOpen,
  LayoutGrid,
  List,
  Minus,
  Puzzle,
  Sparkles,
  StretchHorizontal,
  Table2,
} from 'lucide-react';
import type { ElementType } from 'react';

const LUCIDE_ICON_MAP: Record<string, ElementType> = {
  Activity,
  Component,
  FolderOpen,
  LayoutGrid,
  List,
  Minus,
  Puzzle,
  Sparkles,
  StretchHorizontal,
  Table2,
};

function getLucideIcon(name: string): ElementType {
  return LUCIDE_ICON_MAP[name] ?? Puzzle;
}

const MANIFEST_ID_TO_WIDGET_TYPE: Record<string, WidgetType> = {
  'related-list': 'RelatedList',
  'activity-feed': 'ActivityFeed',
  'header-highlights': 'HeaderHighlights',
  'file-folder': 'FileFolder',
  'spacer': 'Spacer',
  'custom-component': 'CustomComponent',
};

function InternalDraggableCard({ manifest }: { manifest: WidgetManifest }): JSX.Element {
  const widgetType = MANIFEST_ID_TO_WIDGET_TYPE[manifest.id] ?? (manifest.id as WidgetType);
  const Icon = getLucideIcon(manifest.icon);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-new-${widgetType}`,
    data: {
      type: 'palette-widget',
      widgetType,
      label: manifest.name,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-navy/30 hover:bg-brand-navy/[0.03] active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-700">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900">{manifest.name}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{manifest.description}</span>
        </span>
      </div>
    </button>
  );
}

function ExternalDraggableCard({
  manifest,
  enabled,
}: {
  manifest: WidgetManifest;
  enabled: boolean;
}): JSX.Element {
  const Icon = getLucideIcon(manifest.icon);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-new-ext-${manifest.id}`,
    disabled: !enabled,
    data: {
      type: 'palette-widget',
      widgetType: 'ExternalWidget' as WidgetType,
      externalWidgetId: manifest.id,
      label: manifest.name,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : enabled ? 1 : 0.45,
  };

  const disabledReason = !enabled
    ? manifest.integration
      ? `Requires ${manifest.integration} integration`
      : 'Not enabled for this org'
    : undefined;

  return (
    <div title={disabledReason}>
      <button
        ref={setNodeRef}
        type="button"
        style={style}
        {...(enabled ? { ...listeners, ...attributes } : {})}
        disabled={!enabled}
        className={`w-full rounded-lg border p-3 text-left shadow-sm transition ${
          enabled
            ? 'border-blue-200 bg-white hover:border-blue-400 hover:bg-blue-50/30 active:cursor-grabbing'
            : 'cursor-not-allowed border-gray-200 bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 rounded-md border p-1.5 ${
              enabled ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-gray-200 bg-gray-100 text-gray-400'
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`block text-sm font-medium ${enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                {manifest.name}
              </span>
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-medium leading-none text-blue-700">
                EXT
              </span>
            </span>
            <span className={`mt-0.5 block text-xs leading-4 ${enabled ? 'text-gray-500' : 'text-gray-400'}`}>
              {manifest.description}
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}

const FIELD_SECTION_VARIANTS: { id: string; label: string; columns: 1 | 2 | 3; description: string }[] = [
  { id: 'field-section-1col', label: 'Field Section (1 Column)', columns: 1, description: 'Single-column field container' },
  { id: 'field-section-2col', label: 'Field Section (2 Columns)', columns: 2, description: 'Two-column field container' },
  { id: 'field-section-3col', label: 'Field Section (3 Columns)', columns: 3, description: 'Three-column field container' },
];

function FieldSectionDraggableCard({
  variant,
}: {
  variant: (typeof FIELD_SECTION_VARIANTS)[number];
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-panel-${variant.id}`,
    data: {
      type: 'palette-panel',
      columns: variant.columns,
      label: `New Section`,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="w-full rounded-lg border border-emerald-200 bg-white p-3 text-left shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50/30 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-md border border-emerald-200 bg-emerald-50 p-1.5 text-emerald-600">
          <Table2 className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900">{variant.label}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{variant.description}</span>
        </span>
      </div>
    </button>
  );
}

interface PaletteComponentsProps {
  enabledExternalWidgetIds?: string[];
  connectedProviders?: string[];
}

export function PaletteComponents({
  enabledExternalWidgetIds = externalWidgets.map((w) => w.id),
  connectedProviders = [],
}: PaletteComponentsProps): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Field Sections
          </div>
          {FIELD_SECTION_VARIANTS.map((variant) => (
            <FieldSectionDraggableCard key={variant.id} variant={variant} />
          ))}
        </div>

        <div className="space-y-2">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Components
          </div>
          {internalWidgets.map((manifest) => (
            <InternalDraggableCard key={manifest.id} manifest={manifest} />
          ))}
        </div>

        {externalWidgets.length > 0 && (
          <div className="space-y-2">
            <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              External
            </div>
            {externalWidgets.map((manifest) => {
              const enabled =
                enabledExternalWidgetIds.includes(manifest.id) &&
                (manifest.integration === null || connectedProviders.includes(manifest.integration));
              return (
                <ExternalDraggableCard key={manifest.id} manifest={manifest} enabled={enabled} />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
