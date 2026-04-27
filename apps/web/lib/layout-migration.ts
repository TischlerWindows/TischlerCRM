/**
 * Layout migration — converts legacy PageTab/PageSection/PageField layouts
 * to the unified Region/Panel/Field hierarchy.
 */
import type {
  FormattingRule,
  LayoutPanel,
  LayoutSection,
  LayoutTab,
  LayoutWidget,
  LegacyPageField,
  LegacyPageLayout,
  LegacyPageSection,
  LegacyPageTab,
  PageLayout,
  PageWidget,
  PanelField,
  WidgetConfig,
  WidgetType,
} from './schema';

// ── Normalization helpers ────────────────────────────────────────────────

function parseBehavior(value: unknown): PanelField['behavior'] {
  if (value === 'required' || value === 'readOnly' || value === 'hidden') return value;
  return 'none';
}

function normalizePanelColumns(value: number | undefined): LayoutPanel['columns'] {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return 2;
}

function parseWidgetConfig(
  widgetType: WidgetType,
  value: unknown,
): WidgetConfig {
  if (value && typeof value === 'object' && 'type' in value) {
    return value as WidgetConfig;
  }
  switch (widgetType) {
    case 'RelatedList':
      return { type: 'RelatedList', relatedObjectApiName: '', relationshipFieldApiName: '', displayColumns: [] };
    case 'ActivityFeed':
      return { type: 'ActivityFeed', maxItems: 10 };
    case 'FileFolder':
      return { type: 'FileFolder', provider: 'local' };
    case 'CustomComponent':
      return { type: 'CustomComponent', componentId: '' };
    case 'Spacer':
      return { type: 'Spacer', minHeightPx: 32 };
    case 'HeaderHighlights':
      return { type: 'HeaderHighlights', fieldApiNames: [] };
    case 'ExternalWidget':
      return { type: 'ExternalWidget', externalWidgetId: '', displayMode: 'full', config: {} };
    default:
      return { type: 'Spacer', minHeightPx: 32 };
  }
}

function normalizeField(rawField: unknown, fieldIndex: number): PanelField {
  const candidate = (rawField ?? {}) as Record<string, unknown>;
  const kind = candidate.kind === 'teamMemberSlot' ? 'teamMemberSlot' : 'field';
  const slotConfig =
    kind === 'teamMemberSlot' && candidate.slotConfig && typeof candidate.slotConfig === 'object'
      ? (candidate.slotConfig as PanelField['slotConfig'])
      : undefined;
  return {
    ...(kind === 'teamMemberSlot' ? { kind: 'teamMemberSlot' as const } : {}),
    fieldApiName:
      typeof candidate.fieldApiName === 'string'
        ? candidate.fieldApiName
        : `field-${fieldIndex + 1}`,
    ...(slotConfig ? { slotConfig } : {}),
    colSpan: typeof candidate.colSpan === 'number' ? Math.max(1, candidate.colSpan) : 1,
    order: typeof candidate.order === 'number' ? candidate.order : fieldIndex,
    behavior: parseBehavior(candidate.behavior),
    labelOverride:
      typeof candidate.labelOverride === 'string' ? candidate.labelOverride : undefined,
    labelStyle:
      candidate.labelStyle && typeof candidate.labelStyle === 'object'
        ? (candidate.labelStyle as PanelField['labelStyle'])
        : {},
    valueStyle:
      candidate.valueStyle && typeof candidate.valueStyle === 'object'
        ? (candidate.valueStyle as PanelField['valueStyle'])
        : {},
    ...(typeof candidate.hideOnNew === 'boolean' ? { hideOnNew: candidate.hideOnNew } : {}),
    ...(typeof candidate.hideOnView === 'boolean' ? { hideOnView: candidate.hideOnView } : {}),
    ...(typeof candidate.hideOnEdit === 'boolean' ? { hideOnEdit: candidate.hideOnEdit } : {}),
  };
}

function normalizePanel(rawPanel: unknown, panelIndex: number): LayoutPanel {
  const candidate = (rawPanel ?? {}) as Record<string, unknown>;
  const fieldsRaw = Array.isArray(candidate.fields) ? candidate.fields : [];
  const columns =
    typeof candidate.columns === 'number' && candidate.columns >= 1 && candidate.columns <= 4
      ? candidate.columns
      : 2;
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `panel-${Date.now()}-${panelIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Panel ${panelIndex + 1}`,
    order: typeof candidate.order === 'number' ? candidate.order : panelIndex,
    columns: columns as LayoutPanel['columns'],
    style:
      candidate.style && typeof candidate.style === 'object'
        ? (candidate.style as LayoutPanel['style'])
        : {},
    fields: fieldsRaw.map((field: unknown, fieldIndex: number) => normalizeField(field, fieldIndex)),
    ...(typeof candidate.hidden === 'boolean' ? { hidden: candidate.hidden } : {}),
  };
}

function normalizeWidget(rawWidget: unknown, widgetIndex: number): LayoutWidget {
  const candidate = (rawWidget ?? {}) as Record<string, unknown>;
  const widgetType =
    candidate.widgetType === 'RelatedList' ||
    candidate.widgetType === 'ActivityFeed' ||
    candidate.widgetType === 'FileFolder' ||
    candidate.widgetType === 'CustomComponent' ||
    candidate.widgetType === 'Spacer' ||
    candidate.widgetType === 'HeaderHighlights' ||
    candidate.widgetType === 'ExternalWidget'
      ? (candidate.widgetType as WidgetType)
      : ('Spacer' as WidgetType);
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `widget-${Date.now()}-${widgetIndex}`,
    widgetType,
    order: typeof candidate.order === 'number' ? candidate.order : widgetIndex,
    config: parseWidgetConfig(widgetType, candidate.config),
    ...(typeof candidate.collapsible === 'boolean' ? { collapsible: candidate.collapsible } : {}),
  };
}

function normalizeRegion(rawRegion: unknown, regionIndex: number): LayoutSection {
  const candidate = (rawRegion ?? {}) as Record<string, unknown>;
  const panelsRaw = Array.isArray(candidate.panels) ? candidate.panels : [];
  const widgetsRaw = Array.isArray(candidate.widgets) ? candidate.widgets : [];
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `region-${Date.now()}-${regionIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Section ${regionIndex + 1}`,
    gridColumn: typeof candidate.gridColumn === 'number' ? candidate.gridColumn : 1,
    gridColumnSpan:
      typeof candidate.gridColumnSpan === 'number' ? Math.max(2, candidate.gridColumnSpan) : 12,
    gridRow: typeof candidate.gridRow === 'number' ? candidate.gridRow : regionIndex + 1,
    gridRowSpan: typeof candidate.gridRowSpan === 'number' ? candidate.gridRowSpan : 1,
    style:
      candidate.style && typeof candidate.style === 'object'
        ? (candidate.style as LayoutSection['style'])
        : {},
    panels: panelsRaw.map((panel: unknown, panelIndex: number) => normalizePanel(panel, panelIndex)),
    widgets: widgetsRaw.map((widget: unknown, widgetIndex: number) => normalizeWidget(widget, widgetIndex)),
    ...(typeof candidate.hidden === 'boolean' ? { hidden: candidate.hidden } : {}),
  };
}

function normalizeTab(rawTab: unknown, tabIndex: number): LayoutTab {
  const candidate = (rawTab ?? {}) as Record<string, unknown>;
  const regionsRaw = Array.isArray(candidate.regions) ? candidate.regions : [];
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `tab-${Date.now()}-${tabIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Tab ${tabIndex + 1}`,
    order: typeof candidate.order === 'number' ? candidate.order : tabIndex,
    regions: regionsRaw.map((region: unknown, regionIndex: number) => normalizeRegion(region, regionIndex)),
  };
}

// ── Legacy → New conversion helpers ─────────────────────────────────────

function toLayoutWidget(pageWidget: PageWidget, widgetIndex: number): LayoutWidget {
  return {
    id: pageWidget.id || `widget-${Date.now()}-${widgetIndex}`,
    widgetType: pageWidget.widgetType,
    order: typeof pageWidget.order === 'number' ? pageWidget.order : widgetIndex,
    config: parseWidgetConfig(pageWidget.widgetType, pageWidget.config),
    ...(typeof pageWidget.collapsible === 'boolean' ? { collapsible: pageWidget.collapsible } : {}),
  };
}

function toPanelField(pageField: LegacyPageField, fieldIndex: number): PanelField {
  const required = typeof pageField.required === 'boolean' ? pageField.required : false;
  const readOnly = typeof pageField.readOnly === 'boolean' ? pageField.readOnly : false;
  const behavior: PanelField['behavior'] = readOnly
    ? 'readOnly'
    : required
      ? 'required'
      : 'none';
  return {
    fieldApiName: pageField.apiName,
    colSpan: typeof pageField.colSpan === 'number' ? Math.max(1, pageField.colSpan) : 1,
    order: typeof pageField.order === 'number' ? pageField.order : fieldIndex,
    behavior,
    labelStyle: {},
    valueStyle: {},
  };
}

function toLayoutSectionFromSection(section: LegacyPageSection, sectionIndex: number): LayoutSection {
  const sectionWidgets = Array.isArray(section.widgets) ? section.widgets : [];
  const sectionFields = Array.isArray(section.fields) ? section.fields : [];
  const fields = [...sectionFields]
    .sort((a, b) => a.order - b.order)
    .map((field, fieldIndex) => toPanelField(field, fieldIndex));

  return {
    id: `region-${section.id || sectionIndex + 1}`,
    label: section.label || `Section ${sectionIndex + 1}`,
    gridColumn: typeof section.gridColumn === 'number' ? section.gridColumn : 1,
    gridColumnSpan:
      typeof section.gridColumnSpan === 'number' ? Math.max(1, section.gridColumnSpan) : 12,
    gridRow: typeof section.gridRow === 'number' ? section.gridRow : sectionIndex + 1,
    gridRowSpan: typeof section.gridRowSpan === 'number' ? Math.max(1, section.gridRowSpan) : 1,
    style: {},
    panels: [
      {
        id: `panel-${section.id || sectionIndex + 1}`,
        label: section.label || `Panel ${sectionIndex + 1}`,
        order: 0,
        columns: normalizePanelColumns(section.columns),
        style: {},
        fields,
      },
    ],
    widgets: sectionWidgets.map((widget, widgetIndex) => toLayoutWidget(widget, widgetIndex)),
  };
}

function toLayoutSectionsFromLegacyTab(tab: LegacyPageTab): LayoutSection[] {
  const sections = Array.isArray(tab.sections) ? tab.sections : [];
  const regions = [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, sectionIndex) => toLayoutSectionFromSection(section, sectionIndex));
  const tabWidgets = Array.isArray(tab.widgets) ? tab.widgets : [];

  tabWidgets.forEach((widget, widgetIndex) => {
    regions.push({
      id: `region-widget-${widget.id || widgetIndex + 1}`,
      label: `Widget ${widgetIndex + 1}`,
      gridColumn: typeof widget.gridColumn === 'number' ? widget.gridColumn : 1,
      gridColumnSpan: typeof widget.gridColumnSpan === 'number' ? Math.max(1, widget.gridColumnSpan) : 12,
      gridRow: typeof widget.gridRow === 'number' ? widget.gridRow : regions.length + 1,
      gridRowSpan: typeof widget.gridRowSpan === 'number' ? Math.max(1, widget.gridRowSpan) : 1,
      style: {},
      panels: [],
      widgets: [toLayoutWidget(widget, widgetIndex)],
    });
  });

  return regions;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Detects if a layout uses the legacy PageTab/PageSection/PageField hierarchy
 * (i.e. it needs migration). Returns true when the first tab has `sections`
 * instead of `regions`.
 */
export function isLegacyLayout(layout: unknown): boolean {
  if (!layout || typeof layout !== 'object') return false;
  const obj = layout as Record<string, unknown>;
  const tabs = Array.isArray(obj.tabs) ? obj.tabs : [];
  if (tabs.length === 0) return false;
  const firstTab = tabs[0] as Record<string, unknown> | undefined;
  if (!firstTab) return false;
  return Array.isArray(firstTab.sections) && !Array.isArray(firstTab.regions);
}

const DEFAULT_BLANK_TAB: LayoutTab = {
  id: 'tab-default',
  label: 'Details',
  order: 0,
  regions: [],
};

/**
 * Migrates a legacy PageLayout (tabs: LegacyPageTab[]) to the new unified
 * PageLayout (tabs: LayoutTab[]).
 *
 * - If `extensions.editorTabs` exists, the tabs are already in the new format
 *   and are normalized directly.
 * - Otherwise, converts from the legacy PageTab → LayoutSection hierarchy.
 * - Handles missing/malformed data gracefully with sensible defaults.
 * - Preserves formatting rules from both top-level and extensions.
 */
export function migrateLegacyLayout(legacy: LegacyPageLayout): PageLayout {
  const extensions =
    legacy.extensions && typeof legacy.extensions === 'object'
      ? (legacy.extensions as Record<string, unknown>)
      : null;

  const extensionTabs =
    extensions && Array.isArray(extensions.editorTabs) ? extensions.editorTabs : [];

  const tabsSource =
    extensionTabs.length > 0
      ? extensionTabs
      : legacy.tabs.map((tab, tabIndex) => ({
          id: tab.id,
          label: tab.label,
          order: typeof tab.order === 'number' ? tab.order : tabIndex,
          regions: toLayoutSectionsFromLegacyTab(tab),
        }));

  const tabs = tabsSource.map((tab: unknown, index: number) => normalizeTab(tab, index));

  const topLevelFormattingRules = Array.isArray(legacy.formattingRules)
    ? legacy.formattingRules
    : [];
  const extensionFormattingRules =
    extensions && Array.isArray(extensions.formattingRules)
      ? (extensions.formattingRules as FormattingRule[])
      : [];
  const formattingRules =
    topLevelFormattingRules.length > 0 ? topLevelFormattingRules : extensionFormattingRules;

  return {
    id: legacy.id || '',
    name: legacy.name || 'Layout',
    objectApi: legacy.objectApi,
    active: Boolean(legacy.active),
    isDefault: Boolean(legacy.isDefault),
    roles: Array.isArray(legacy.roles)
      ? legacy.roles.filter((role): role is string => typeof role === 'string')
      : [],
    tabs: tabs.length > 0 ? tabs : [{ ...DEFAULT_BLANK_TAB }],
    highlightFields: legacy.highlightFields,
    formattingRules,
    extensions: legacy.extensions,
  };
}
