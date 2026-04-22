'use client';

import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PageLayout, FieldDef, type LayoutSection, type PageField } from '@/lib/schema';
import type { ObjectDef } from '@/lib/schema';
import { evaluateVisibility } from '@/lib/field-visibility';
import {
  getFormattingEffectsForField,
  getFormattingEffectsForPanel,
  getFormattingEffectsForRegion,
  getFormattingEffectsForSection,
  getFormattingEffectsForTab,
} from '@/lib/layout-formatting';
import {
  badgePillClass,
  fieldHighlightWrapperClass,
  labelPresentationClassName,
} from '@/lib/layout-presentation';
import {
  resolveTabCanvasItems,
  TAB_GRID_COLUMNS,
} from '@/lib/tab-canvas-grid';
import { LayoutWidgetsInline } from '@/components/layout-widgets-inline';
import { useEnabledWidgetIds } from '@/lib/use-widget-settings';
import { getFieldDef, getRecordValue, MemoizedFieldValue } from './field-value-renderer';

// ── Types ──────────────────────────────────────────────────────────────

export interface RecordTabRendererProps {
  tab: any;
  tabIndex: number;
  pageLayout: PageLayout;
  record: Record<string, any> | null;
  objectDef: ObjectDef | undefined;
  formulaValues: Record<string, any>;
  isLookupLoaded: boolean;
  /** Section-level toggle state (for legacy model) */
  sectionToggles: Record<string, boolean>;
  setSectionToggles: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** Panel-level collapse state (for new model) */
  collapsedPanelIds: Set<string>;
  togglePanelCollapse: (panelId: string) => void;
  /** Widget-level collapse state */
  collapsedWidgetIds: Set<string>;
  toggleWidgetCollapse: (widgetId: string) => void;
}

interface InternalRendererProps extends RecordTabRendererProps {
  enabledWidgetIds: Set<string>;
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildObjectDefPayload(objectDef: ObjectDef | undefined) {
  if (!objectDef) return undefined;
  return {
    apiName: objectDef.apiName,
    label: objectDef.label,
    fields: objectDef.fields.map((f) => ({
      apiName: f.apiName,
      label: f.label,
      type: String(f.type),
    })),
  };
}

// ── Column track grouping ─────────────────────────────────────────────

interface GridPlacement {
  gridColumn: number;
  gridColumnSpan: number;
  gridRow: number;
}

interface ColumnTrack<T> {
  startCol: number;
  span: number;
  items: T[];
}

type LayoutBand<T> =
  | { kind: 'full-width'; items: T[] }
  | { kind: 'columns'; tracks: ColumnTrack<T>[] };

/**
 * Groups items into independent column tracks so that items in different
 * columns stack independently (not affected by sibling column height).
 * Full-width items break the multi-column flow and become standalone bands.
 */
function groupIntoColumnTracks<T>(
  items: T[],
  getPlacement: (item: T) => GridPlacement,
  totalColumns: number = TAB_GRID_COLUMNS,
): LayoutBand<T>[] {
  const sorted = [...items].sort((a, b) => {
    const pa = getPlacement(a);
    const pb = getPlacement(b);
    return pa.gridRow - pb.gridRow || pa.gridColumn - pb.gridColumn;
  });

  const bands: LayoutBand<T>[] = [];
  let pendingPartial: T[] = [];

  const flushPartial = () => {
    if (pendingPartial.length === 0) return;
    const trackMap = new Map<number, { span: number; items: T[] }>();
    for (const item of pendingPartial) {
      const p = getPlacement(item);
      const existing = trackMap.get(p.gridColumn);
      if (existing) {
        existing.items.push(item);
        existing.span = Math.max(existing.span, p.gridColumnSpan);
      } else {
        trackMap.set(p.gridColumn, { span: p.gridColumnSpan, items: [item] });
      }
    }
    const tracks: ColumnTrack<T>[] = [...trackMap.entries()]
      .sort(([a], [b]) => a - b)
      .map(([startCol, { span, items: trackItems }]) => ({
        startCol,
        span,
        items: trackItems.sort((x, y) => getPlacement(x).gridRow - getPlacement(y).gridRow),
      }));
    bands.push({ kind: 'columns', tracks });
    pendingPartial = [];
  };

  for (const item of sorted) {
    const p = getPlacement(item);
    if (p.gridColumnSpan >= totalColumns) {
      flushPartial();
      const last = bands[bands.length - 1];
      if (last?.kind === 'full-width') {
        last.items.push(item);
      } else {
        bands.push({ kind: 'full-width', items: [item] });
      }
    } else {
      pendingPartial.push(item);
    }
  }
  flushPartial();

  return bands;
}

// ── NEW model renderer: tab.regions ────────────────────────────────────

function renderNewModelTab(props: InternalRendererProps): React.ReactNode {
  const {
    tab,
    tabIndex: ti,
    pageLayout,
    record,
    objectDef,
    formulaValues,
    isLookupLoaded,
    collapsedPanelIds,
    togglePanelCollapse,
    collapsedWidgetIds,
    toggleWidgetCollapse,
    enabledWidgetIds,
  } = props;

  const layoutVisibilityData = { ...record, ...formulaValues } as Record<string, unknown>;
  const regions = (tab as any).regions as LayoutSection[];

  const visibleRegions = regions.filter((region) => {
    if (region.hidden) return false;
    // Detail page is "view" mode — check hideOnView with legacy hideOnExisting fallback
    if ((region as any).hideOnView || (region as any).hideOnExisting) return false;
    if ((region as any).visibleIf?.length > 0 && !evaluateVisibility((region as any).visibleIf, layoutVisibilityData)) return false;
    const regionFx = getFormattingEffectsForRegion(pageLayout, region.id, layoutVisibilityData);
    return !regionFx?.hidden;
  });

  const bands = groupIntoColumnTracks(
    visibleRegions,
    (r) => ({
      gridColumn: r.gridColumn ?? 1,
      gridColumnSpan: r.gridColumnSpan ?? TAB_GRID_COLUMNS,
      gridRow: r.gridRow ?? 1,
    }),
  );

  // Render a single region's inner content (panels + widgets)
  const renderRegion = (region: LayoutSection) => {
    const sortedPanels = [...(region.panels ?? [])].sort((a: any, b: any) => a.order - b.order);
    // HeaderHighlights are consumed by the header card — don't render them inline
    const sortedWidgets = [...(region.widgets ?? [])]
      .filter((w: any) => !w.hideOnView && !w.hideOnExisting && w.widgetType !== 'HeaderHighlights')
      .sort((a: any, b: any) => a.order - b.order);

    // Skip entirely-empty regions (e.g. a HeaderHighlights-only "Header" region)
    if (sortedPanels.length === 0 && sortedWidgets.length === 0) return null;

    const regionStyle: React.CSSProperties = {
      ...(region.style?.background ? { backgroundColor: region.style.background } : {}),
      ...(region.style?.borderColor ? { borderColor: region.style.borderColor } : {}),
      ...(region.style?.borderStyle ? { borderStyle: region.style.borderStyle } : {}),
      borderRadius: region.style?.borderRadius === 'lg' ? 12 : region.style?.borderRadius === 'sm' ? 6 : undefined,
      boxShadow: region.style?.shadow === 'md'
        ? '0 10px 24px rgba(15,23,42,.14)'
        : region.style?.shadow === 'sm'
          ? '0 1px 3px rgba(15,23,42,.12)'
          : undefined,
    };

    return (
      <div key={region.id} style={regionStyle} className="min-w-0 space-y-4 p-2">
        {/* Region header */}
        {region.label && (
          <h3 className="text-sm font-semibold text-gray-700 px-1">{region.label}</h3>
        )}
        {/* Panels */}
          {sortedPanels.map((panel: any) => {
            if (panel.hidden) return null;
            if (panel.hideOnView || panel.hideOnExisting) return null;
            if (panel.visibleIf?.length > 0 && !evaluateVisibility(panel.visibleIf, layoutVisibilityData)) return null;
            const panelFx = getFormattingEffectsForPanel(pageLayout, panel.id, layoutVisibilityData);
          if (panelFx?.hidden) return null;

          // Component panels — render their widgets via LayoutWidgetsInline
          if (panel.panelType === 'components') {
            const panelWidgets = [...(panel.widgets ?? [])]
              .filter((w: any) => !w.hideOnView && !w.hideOnExisting)
              .sort((a: any, b: any) => a.order - b.order);

            const isPanelCollapsed = collapsedPanelIds.has(panel.id);
            const headerStyle: React.CSSProperties = {
              ...(panel.style?.headerBackground ? { backgroundColor: panel.style.headerBackground } : {}),
              ...(panel.style?.headerTextColor ? { color: panel.style.headerTextColor } : {}),
              fontWeight: panel.style?.headerBold ? 700 : undefined,
              fontStyle: panel.style?.headerItalic ? 'italic' : undefined,
              textTransform: panel.style?.headerUppercase ? 'uppercase' : undefined,
            };

            return (
              <div key={panel.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => togglePanelCollapse(panel.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  style={headerStyle}
                  aria-label={isPanelCollapsed ? `Expand ${panel.label} panel` : `Collapse ${panel.label} panel`}
                  aria-expanded={!isPanelCollapsed}
                >
                  <span className="text-sm font-semibold text-gray-700" style={headerStyle}>{panel.label}</span>
                  {isPanelCollapsed
                    ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
                    : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
                  }
                </button>
                {!isPanelCollapsed && (
                  <div className="p-2">
                    {panelWidgets.length > 0 ? (
                      <LayoutWidgetsInline
                        widgets={panelWidgets as any}
                        enabledIds={enabledWidgetIds}
                        record={record ?? undefined}
                        objectDef={buildObjectDefPayload(objectDef)}
                        collapsedWidgetIds={collapsedWidgetIds}
                        toggleWidgetCollapse={toggleWidgetCollapse}
                      />
                    ) : (
                      <div className="py-4 text-center text-sm text-gray-400">No components configured</div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const sortedFields = [...(panel.fields ?? [])].sort((a: any, b: any) => a.order - b.order);
          const visibleFields = sortedFields.filter((f: any) => {
            if (f.behavior === 'hidden') return false;
            if (f.hideOnView || f.hideOnExisting) return false;
            const fd = getFieldDef(f.fieldApiName, objectDef);
            if (!fd) return false;
            if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return false;
            const fFx = getFormattingEffectsForField(pageLayout, f.fieldApiName, layoutVisibilityData);
            if (fFx?.hidden) return false;
            return true;
          });

          if (visibleFields.length === 0) return null;

          const headerStyle: React.CSSProperties = {
            ...(panel.style?.headerBackground ? { backgroundColor: panel.style.headerBackground } : {}),
            ...(panel.style?.headerTextColor ? { color: panel.style.headerTextColor } : {}),
            fontWeight: panel.style?.headerBold ? 700 : undefined,
            fontStyle: panel.style?.headerItalic ? 'italic' : undefined,
            textTransform: panel.style?.headerUppercase ? 'uppercase' : undefined,
          };
          const bodyStyle: React.CSSProperties = {
            ...(panel.style?.bodyBackground ? { backgroundColor: panel.style.bodyBackground } : {}),
          };

          const isPanelCollapsed = collapsedPanelIds.has(panel.id);
          return (
            <div key={panel.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => togglePanelCollapse(panel.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                style={headerStyle}
                aria-label={isPanelCollapsed ? `Expand ${panel.label} panel` : `Collapse ${panel.label} panel`}
                aria-expanded={!isPanelCollapsed}
              >
                <span className="text-sm font-semibold text-gray-700" style={headerStyle}>{panel.label}</span>
                {isPanelCollapsed
                  ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
                  : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" aria-hidden="true" />
                }
              </button>
              {!isPanelCollapsed && (
                <div
                  className="panel-field-grid grid gap-x-6 gap-y-4 p-4"
                  style={{
                    ...bodyStyle,
                    gridTemplateColumns: `repeat(${panel.columns}, minmax(0, 1fr))`,
                  }}
                >
                  {visibleFields.map((f: any) => {
                    const fd = getFieldDef(f.fieldApiName, objectDef);
                    if (!fd) return null;
                    const raw = getRecordValue(f.fieldApiName, record, fd, formulaValues);
                    const labelStyle: React.CSSProperties = {
                      ...(f.labelStyle?.color ? { color: f.labelStyle.color } : {}),
                      fontWeight: f.labelStyle?.bold ? 700 : undefined,
                      fontStyle: f.labelStyle?.italic ? 'italic' : undefined,
                      textTransform: f.labelStyle?.uppercase ? 'uppercase' : undefined,
                    };
                    const valueStyle: React.CSSProperties = {
                      ...(f.valueStyle?.color ? { color: f.valueStyle.color } : {}),
                      ...(f.valueStyle?.background ? { backgroundColor: f.valueStyle.background, padding: '2px 6px', borderRadius: 4 } : {}),
                      fontWeight: f.valueStyle?.bold ? 700 : undefined,
                      fontStyle: f.valueStyle?.italic ? 'italic' : undefined,
                    };
                    const displayLabel = f.labelOverride || fd.label;
                    return (
                      <div
                        key={f.fieldApiName}
                        style={{ gridColumn: `span ${Math.min(f.colSpan ?? 1, panel.columns)}` }}
                      >
                        <div className="text-xs font-medium text-gray-500 mb-0.5" style={labelStyle}>
                          {displayLabel}
                        </div>
                        <div className="text-sm text-gray-900" style={valueStyle}>
                          <MemoizedFieldValue apiName={f.fieldApiName} rawValue={raw} fieldDef={fd} record={record} isLookupLoaded={isLookupLoaded} objectApiName={objectDef?.apiName} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Widgets */}
        {sortedWidgets.length > 0 && (
          <LayoutWidgetsInline
            widgets={sortedWidgets as any}
            enabledIds={enabledWidgetIds}
            record={record ?? undefined}
            objectDef={buildObjectDefPayload(objectDef)}
            collapsedWidgetIds={collapsedWidgetIds}
            toggleWidgetCollapse={toggleWidgetCollapse}
          />
        )}
      </div>
    );
  };

  return (
    <div key={tab.id ?? ti} className="flex flex-col gap-4">
      {bands.map((band, bi) => {
        if (band.kind === 'full-width') {
          return <React.Fragment key={`fw-${bi}`}>{band.items.map(renderRegion)}</React.Fragment>;
        }
        if (band.tracks.length === 1) {
          return <React.Fragment key={`band-${bi}`}>{band.tracks[0].items.map(renderRegion)}</React.Fragment>;
        }
        return (
          <div key={`band-${bi}`} className="flex flex-col md:flex-row gap-4">
            {band.tracks.map((track) => (
              <div
                key={`track-${track.startCol}`}
                className="flex flex-col gap-4 min-w-0"
                style={{ flex: track.span }}
              >
                {track.items.map(renderRegion)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── LEGACY model renderer: tab.sections ────────────────────────────────

function renderLegacyTab(props: InternalRendererProps): React.ReactNode {
  const {
    tab,
    tabIndex: ti,
    pageLayout,
    record,
    objectDef,
    formulaValues,
    isLookupLoaded,
    sectionToggles,
    setSectionToggles,
    collapsedWidgetIds,
    toggleWidgetCollapse,
    enabledWidgetIds,
  } = props;

  const layoutVisibilityData = { ...record, ...formulaValues } as Record<string, unknown>;
  const legacyTab = tab as any;
  const sorted = [...(legacyTab.sections ?? [])].sort((a: any, b: any) => a.order - b.order);

  const eligible = sorted.filter((section: any) => {
    if (section.showInRecord === false) return false;
    if (!evaluateVisibility(section.visibleIf, layoutVisibilityData)) return false;
    const sectionFx = getFormattingEffectsForSection(pageLayout, section.id, layoutVisibilityData);
    if (sectionFx?.hidden) return false;
    const columnArrays: { layoutField: typeof section.fields[0]; fieldDef: FieldDef }[][] = [];
    for (let c = 0; c < section.columns; c++) {
      columnArrays[c] = section.fields
        .filter((f: any) => f.column === c)
        .sort((a: any, b: any) => a.order - b.order)
        .map((f: any) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, objectDef, f)! }))
        .filter((entry: any) => entry.fieldDef != null)
        .filter(({ layoutField, fieldDef }: any) => {
          if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
          const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
          if (fFx?.hidden) return false;
          return true;
        });
    }
    // If the section has an explicit visibility rule that already passed, show it
    // regardless of whether its fields are populated (e.g. a newly-created record).
    if (section.visibleIf?.length > 0) return true;

    const allFieldsEmpty = columnArrays.every((col) =>
      col.every(({ layoutField, fieldDef }: any) => {
        const v = getRecordValue(layoutField.apiName, record, fieldDef, formulaValues);
        return v === undefined || v === null || v === '' || v === 'N/A';
      }),
    );
    return !allFieldsEmpty;
  });

  const isSectionShown = (section: any) =>
    eligible.some((s: any) => s.id === section.id);

  const items = resolveTabCanvasItems(legacyTab);
  const visibleItems = items.filter((item) => {
    if (item.kind === 'widget') return true;
    return isSectionShown(item.section);
  });

  function getItemPlacement(item: (typeof visibleItems)[0]): GridPlacement {
    if (item.kind === 'widget') {
      return {
        gridColumn: item.widget.gridColumn ?? 1,
        gridColumnSpan: item.widget.gridColumnSpan ?? TAB_GRID_COLUMNS,
        gridRow: item.widget.gridRow ?? 1,
      };
    }
    return {
      gridColumn: item.section.gridColumn ?? 1,
      gridColumnSpan: item.section.gridColumnSpan ?? TAB_GRID_COLUMNS,
      gridRow: item.section.gridRow ?? 1,
    };
  }

  const bands = groupIntoColumnTracks(visibleItems, getItemPlacement);

  const renderLegacyItem = (item: (typeof visibleItems)[0]) => {
    if (item.kind === 'widget') {
      const g = item.widget;
      return (
        <div key={g.id} className="min-w-0">
          <LayoutWidgetsInline
            widgets={[g]}
            enabledIds={enabledWidgetIds}
            record={record ?? undefined}
            objectDef={buildObjectDefPayload(objectDef)}
            collapsedWidgetIds={collapsedWidgetIds}
            toggleWidgetCollapse={toggleWidgetCollapse}
          />
        </div>
      );
    }

    const section = item.section;
    const columnArrays: { layoutField: typeof section.fields[0]; fieldDef: FieldDef }[][] = [];
    for (let c = 0; c < section.columns; c++) {
      columnArrays[c] = section.fields
        .filter((f: PageField) => f.column === c)
        .sort((a: PageField, b: PageField) => a.order - b.order)
        .map((f: PageField) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, objectDef, f)! }))
        .filter((entry) => entry.fieldDef != null)
        .filter(({ layoutField, fieldDef }) => {
          if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
          const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
          if (fFx?.hidden) return false;
          return true;
        });
    }

    const hasSpanning = section.fields.some(
      (f: any) => ((f as any).colSpan ?? 1) > 1 || ((f as any).rowSpan ?? 1) > 1,
    );

    const sectionKey = `${ti}-${section.id}`;
    const isCollapsed = sectionToggles[sectionKey] === false;

    const toggleSection = () => {
      if (!isCollapsed) {
        setSectionToggles((prev) => ({ ...prev, [sectionKey]: false }));
      } else {
        setSectionToggles((prev) => {
          const next = { ...prev };
          delete next[sectionKey];
          return next;
        });
      }
    };

    return (
      <div
        key={section.id}
        className="bg-white rounded-lg border border-gray-200 overflow-hidden min-w-0"
      >
        <button
          type="button"
          onClick={toggleSection}
          className="w-full flex items-center justify-between bg-gray-50 px-6 py-3 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          aria-label={isCollapsed ? `Expand ${section.label} section` : `Collapse ${section.label} section`}
          aria-expanded={!isCollapsed}
        >
          <div className="text-left">
            <h3 className="font-medium text-gray-900">{section.label}</h3>
            {section.description ? (
              <p className="text-xs text-gray-500 mt-0.5 font-normal">
                {section.description}
              </p>
            ) : null}
          </div>
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
          )}
        </button>

        {!isCollapsed && (
          <div className="p-6">
            {hasSpanning ? (() => {
              const allFields = section.fields
                .map((f: PageField) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, objectDef, f)! }))
                .filter((e: any) => e.fieldDef != null)
                .filter(({ layoutField, fieldDef }: any) => {
                  if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
                  const fx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                  return !fx?.hidden;
                });
              const occupied = new Set<string>();
              const colGroups: typeof allFields[] = [];
              for (let c = 0; c < section.columns; c++) {
                colGroups[c] = allFields
                  .filter((e: any) => e.layoutField.column === c)
                  .sort((a: any, b: any) => a.layoutField.order - b.layoutField.order);
              }
              const placed: (typeof allFields[0] & { gridRow: number; colSpan: number; rowSpan: number })[] = [];
              for (let c = 0; c < section.columns; c++) {
                for (const entry of (colGroups[c] ?? [])) {
                  const f = entry.layoutField;
                  const cs = Math.min((f as any).colSpan ?? 1, section.columns - f.column);
                  const rs = (f as any).rowSpan ?? 1;
                  let row = 1;
                  search: while (true) {
                    for (let dr = 0; dr < rs; dr++) {
                      for (let dc = 0; dc < cs; dc++) {
                        if (occupied.has(`${row + dr},${f.column + dc}`)) { row++; continue search; }
                      }
                    }
                    break;
                  }
                  placed.push({ ...entry, gridRow: row, colSpan: cs, rowSpan: rs });
                  for (let dr = 0; dr < rs; dr++) {
                    for (let dc = 0; dc < cs; dc++) {
                      occupied.add(`${row + dr},${f.column + dc}`);
                    }
                  }
                }
              }
              return (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${section.columns}, 1fr)`, gridAutoRows: 'minmax(60px, auto)', gap: '1.5rem' }}>
                  {placed.map(({ layoutField, fieldDef, gridRow, colSpan, rowSpan }) => {
                    const value = getRecordValue(layoutField.apiName, record, fieldDef, formulaValues);
                    const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                    const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                    const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                    const labelCn = labelPresentationClassName((layoutField as any).presentation);
                    return (
                      <div
                        key={layoutField.apiName}
                        style={{
                          gridColumn: `${layoutField.column + 1} / span ${Math.min(colSpan, section.columns - layoutField.column)}`,
                          gridRow: `${gridRow} / span ${rowSpan}`,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                        className={hl || undefined}
                      >
                        <dt className={`text-sm ${labelCn}`}>
                          {fieldDef.label}
                          {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                          {fFx?.readOnly ? (
                            <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
                          ) : null}
                        </dt>
                        <dd
                          className="mt-1 text-sm text-gray-900 flex flex-wrap items-center gap-2"
                          style={rowSpan > 1 ? { flex: 1 } : undefined}
                        >
                          <MemoizedFieldValue apiName={layoutField.apiName} rawValue={value} fieldDef={fieldDef} record={record} isLookupLoaded={isLookupLoaded} objectApiName={objectDef?.apiName} />
                          {badgeC ? <span className={badgeC}>Status</span> : null}
                        </dd>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (
            <div
              className={`grid gap-6 ${
                section.columns === 1
                  ? 'grid-cols-1'
                  : section.columns === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : section.columns === 4
                      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                      : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              {columnArrays.map((colFields, colIdx) => (
                <div key={`col-${colIdx}`} className="flex flex-col gap-4">
                  {colFields.map(({ layoutField, fieldDef }) => {
                    const value = getRecordValue(layoutField.apiName, record, fieldDef, formulaValues);
                    const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                    const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                    const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                    const labelCn = labelPresentationClassName((layoutField as any).presentation);
                    return (
                      <div key={layoutField.apiName} className={hl || undefined}>
                        <dt className={`text-sm ${labelCn}`}>
                          {fieldDef.label}
                          {fieldDef.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                          {fFx?.readOnly ? (
                            <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
                          ) : null}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-900 flex flex-wrap items-center gap-2">
                          <MemoizedFieldValue apiName={layoutField.apiName} rawValue={value} fieldDef={fieldDef} record={record} isLookupLoaded={isLookupLoaded} objectApiName={objectDef?.apiName} />
                          {badgeC ? <span className={badgeC}>Status</span> : null}
                        </dd>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div key={tab.id ?? ti} className="flex flex-col gap-4 mb-6">
      {bands.map((band, bi) => {
        if (band.kind === 'full-width') {
          return <React.Fragment key={`fw-${bi}`}>{band.items.map(renderLegacyItem)}</React.Fragment>;
        }
        if (band.tracks.length === 1) {
          return <React.Fragment key={`band-${bi}`}>{band.tracks[0].items.map(renderLegacyItem)}</React.Fragment>;
        }
        return (
          <div key={`band-${bi}`} className="flex flex-col md:flex-row gap-4">
            {band.tracks.map((track) => (
              <div
                key={`track-${track.startCol}`}
                className="flex flex-col gap-4 min-w-0"
                style={{ flex: track.span }}
              >
                {track.items.map(renderLegacyItem)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Renders a single tab's content.
 * Detects whether the tab uses the new model (tab.regions) or legacy
 * model (tab.sections) and delegates accordingly.
 */
export function RecordTabRenderer(props: RecordTabRendererProps): React.ReactNode {
  const { tab } = props;
  const { ids: enabledWidgetIds } = useEnabledWidgetIds();
  const internalProps: InternalRendererProps = { ...props, enabledWidgetIds };

  if ('regions' in tab && Array.isArray((tab as any).regions)) {
    return renderNewModelTab(internalProps);
  }

  return renderLegacyTab(internalProps);
}
