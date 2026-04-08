// Core schema types for the Object Manager system

export type FieldType =
  | "AutoNumber" | "Formula" | "RollupSummary"
  | "Lookup" | "ExternalLookup"
  | "Checkbox" | "Currency" | "Date" | "DateTime" | "Email"
  | "Geolocation" | "Number" | "Percent" | "Phone"
  | "Picklist" | "MultiPicklist" | "MultiSelectPicklist" | "PicklistText" | "PicklistLookup"
  | "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText"
  | "Time" | "URL" | "Address" | "CompositeText" | "AutoUser" | "LookupUser"
  | "LocationSearch"
  | "DropboxFiles";

/**
 * Normalize field type strings from the database to canonical FieldType values.
 * Handles case mismatches (e.g. "text" → "Text") and aliases
 * (e.g. "MultiSelectPicklist" → "MultiPicklist").
 */
export function normalizeFieldType(raw: string): FieldType {
  const CANONICAL: Record<string, FieldType> = {
    autonumber: 'AutoNumber',
    formula: 'Formula',
    rollupsummary: 'RollupSummary',
    lookup: 'Lookup',
    externallookup: 'ExternalLookup',
    checkbox: 'Checkbox',
    currency: 'Currency',
    date: 'Date',
    datetime: 'DateTime',
    email: 'Email',
    geolocation: 'Geolocation',
    number: 'Number',
    percent: 'Percent',
    phone: 'Phone',
    picklist: 'Picklist',
    multipicklist: 'MultiPicklist',
    multiselectpicklist: 'MultiPicklist',
    text: 'Text',
    textarea: 'TextArea',
    longtextarea: 'LongTextArea',
    richtextarea: 'RichTextArea',
    encryptedtext: 'EncryptedText',
    time: 'Time',
    url: 'URL',
    address: 'Address',
    picklisttext: 'PicklistText',
    picklistlookup: 'PicklistLookup',
    compositetext: 'CompositeText',
    autouser: 'AutoUser',
    lookupuser: 'LookupUser',
    locationsearch: 'LocationSearch',
    dropboxfiles: 'DropboxFiles',
  };
  return CANONICAL[raw.toLowerCase()] || (raw as FieldType);
}

export interface FieldDef {
  id: string;
  apiName: string;
  label: string;
  type: FieldType;
  custom?: boolean;        // true for custom fields, false/undefined for system fields
  required?: boolean;
  unique?: boolean;
  readOnly?: boolean;
  precision?: number;
  scale?: number;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  picklistValues?: string[];
  picklistColors?: Record<string, string>; // option value → hex color (e.g. "#ef4444")
  picklistPosition?: 'left' | 'right';  // for PicklistText: which side gets the dropdown
  defaultValue?: any;
  helpText?: string;
  controllingField?: string; // for dependent picklists
  visibleIf?: ConditionExpr[]; // conditional visibility rules
  picklistDependencies?: PicklistDependencyRule[]; // conditional visibility for picklist values
  formulaExpr?: string;        // for formula fields
  lookupObject?: string;       // target object for lookup fields
  lookupField?: string;        // which field on the target object to display
  relationshipName?: string;   // name to display for relationship
  dependentValues?: { [controllingValue: string]: string[] }; // dependent picklist values
  relationship?: {
    targetObject: string;
    behavior?: "restrict" | "cascade" | "nullify";
  };
  rollup?: {
    relatedObject: string;
    relationshipField: string;
    aggregate: "COUNT" | "SUM" | "MIN" | "MAX";
    targetField?: string;
    filterExpr?: string;
  };
  encryption?: {
    strategy: "atRest";
    masked: boolean;
  };
  geolocation?: {
    format: "decimal";
  };
  autoNumber?: {
    displayFormat: string;
    startingNumber: number;
  };
  staticUrl?: string;  // for URL fields: a fixed hyperlink instead of a fillable field
  targetFields?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    lat?: string;
    lng?: string;
  };
  subFields?: Array<{
    apiName: string;
    label: string;
    type: string;
  }>;
}

export interface ValidationRule {
  id: string;
  name: string;
  errorMessage: string;
  active: boolean;
  condition: string; // boolean expression using field apiNames
}

export interface RecordType {
  id: string;
  name: string;
  description?: string;
  default?: boolean;
  /** @deprecated Use layout assignment rules instead; retained for backward compatibility */
  pageLayoutId?: string;
}

/** @deprecated Use PanelField.labelStyle / ValueStyle in the new Region→Panel→Field hierarchy */
export type LabelColorToken = 'default' | 'brand' | 'muted' | 'danger' | 'success';

/** @deprecated Use PanelField.labelStyle in the new Region→Panel→Field hierarchy */
export interface PageFieldPresentation {
  labelBold?: boolean;
  labelColorToken?: LabelColorToken;
}

export type FormattingRuleTarget =
  | { kind: 'field'; fieldApiName: string; panelId: string }
  | { kind: 'panel'; panelId: string }
  | { kind: 'region'; regionId: string };

export type FieldHighlightToken = 'none' | 'subtle' | 'attention' | 'positive' | 'critical';

/** Layout-level conditional formatting (first matching active rule wins — see spec) */
export interface FormattingRule {
  id: string;
  name: string;
  active: boolean;
  /** Lower values run first */
  order: number;
  when: ConditionExpr[];
  target: FormattingRuleTarget;
  effects: {
    hidden?: boolean;
    readOnly?: boolean;
    badge?: 'success' | 'warning' | 'destructive';
    highlightToken?: FieldHighlightToken;
  };
}

/** Persisted JSON on `PageLayout` (database); mirrors top-level `formattingRules` when synced */
export interface PageLayoutExtensions {
  formattingRules?: FormattingRule[];
  version?: number;
  [key: string]: unknown;
}

// ── Widget system ──────────────────────────────────────────────

export type WidgetType = 'RelatedList' | 'CustomComponent' | 'ActivityFeed' | 'FileFolder' | 'Spacer' | 'HeaderHighlights' | 'ExternalWidget';

export type RelatedListFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export interface RelatedListFilter {
  field: string;
  operator: RelatedListFilterOperator;
  value: string;
}

export interface RelatedListConfig {
  type: 'RelatedList';
  relatedObjectApiName: string;
  relationshipFieldApiName: string;
  displayColumns: string[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  maxRows?: number;
  /** Custom header label shown in the widget header. Falls back to object label when absent. */
  label?: string;
  objectApiName?: string;
  columns?: string[];
  linkField?: string;
  rowLimit?: number;
  showSearch?: boolean;
  /** 'list' renders a table; 'tile' renders a card grid. Defaults to 'list'. */
  viewMode?: 'list' | 'tile';
  /** Show the action bar (New button) above the list. */
  showActionBar?: boolean;
  /** Show a "New" button in the action bar pre-filling the link field. */
  showNewButton?: boolean;
  /** Admin-defined filters applied after fetch (users cannot override). Up to 10. */
  filters?: RelatedListFilter[];
}

export interface CustomComponentConfig {
  type: 'CustomComponent';
  componentId: string;
  props?: Record<string, unknown>;
}

export interface ActivityFeedConfig {
  type: 'ActivityFeed';
  maxItems?: number;
}

export interface FileFolderConfig {
  type: 'FileFolder';
  provider: 'dropbox' | 'google-drive' | 'local';
  folderId?: string;
}

/** Layout-only blank vertical space (builder + preview) */
export interface SpacerConfig {
  type: 'Spacer';
  /** Minimum height in CSS pixels */
  minHeightPx?: number;
}

export interface HeaderHighlightsConfig {
  type: 'HeaderHighlights';
  /** Up to 6 field API names to display as highlight badges */
  fieldApiNames: string[];
  /** Which action buttons to show in the highlights bar. Defaults to edit + delete when absent. */
  visibleActions?: Array<'edit' | 'delete' | 'clone' | 'print'>;
}

export interface ExternalWidgetLayoutConfig {
  type: 'ExternalWidget';
  externalWidgetId: string;
  displayMode: 'full' | 'column';
  config: Record<string, unknown>;
}

export type WidgetConfig =
  | RelatedListConfig
  | CustomComponentConfig
  | ActivityFeedConfig
  | FileFolderConfig
  | SpacerConfig
  | HeaderHighlightsConfig
  | ExternalWidgetLayoutConfig;

export interface PageWidget {
  id: string;
  widgetType: WidgetType;
  column: number;
  order: number;
  colSpan?: number;
  rowSpan?: number;
  config: WidgetConfig;
  /** Tab canvas placement (12-column grid); omit when widget is inside a section only */
  gridColumn?: number;
  gridColumnSpan?: number;
  gridRow?: number;
  gridRowSpan?: number;
}

// ── Page layout sections ───────────────────────────────────────

export interface LegacyPageSection {
  id: string;
  label: string;
  columns: 1 | 2 | 3 | 4;
  order: number;
  fields: LegacyPageField[];
  widgets?: PageWidget[];
  /** Shown under the section title in form/detail when supported */
  description?: string;
  visibleIf?: ConditionExpr[];
  /** When false, the section is completely hidden on the record detail view */
  showInRecord?: boolean;
  /** When false, the section is hidden in the create/edit form template */
  showInTemplate?: boolean;
  /**
   * Sections with the same id render side-by-side in one row (builder + runtime).
   * Omit or use unique ids per row for full-width stacked sections.
   */
  layoutRowId?: string;
  /** Flex grow weight within the row (default 1). */
  rowWeight?: number;
  /**
   * Tab canvas placement (12-column grid). Legacy layouts without these fields are inferred at load
   * from `layoutRowId` + `rowWeight` (see `normalizeCanvasTabGrids` / `resolveTabCanvasItems`).
   */
  gridColumn?: number;
  gridColumnSpan?: number;
  gridRow?: number;
  gridRowSpan?: number;
}

/** @deprecated Use LegacyPageSection — alias retained for backward compatibility */
export type PageSection = LegacyPageSection;

/**
 * A field reference inside a legacy page layout section.
 *
 * Self-contained: every rendering-relevant property from the parent
 * FieldDef is embedded directly so DynamicForm never needs to cross-
 * reference `object.fields` at render time.  The enrichment happens
 * once during schema load (see `enrichLayoutFieldDefs` in schema-service).
 */
export type LegacyPageField = {
  apiName: string;
  column: number;
  order: number;
  colSpan?: number;
  rowSpan?: number;
} & Partial<Omit<FieldDef, 'apiName'>>;

/** @deprecated Use LegacyPageField — alias retained for backward compatibility */
export type PageField = LegacyPageField;

export interface LegacyPageTab {
  id: string;
  label: string;
  order: number;
  sections: LegacyPageSection[];
  /** Widgets on the tab canvas (not inside a section), e.g. related lists above the fold */
  widgets?: PageWidget[];
}

/** @deprecated Use LegacyPageTab — alias retained for backward compatibility */
export type PageTab = LegacyPageTab;

// ── New page editor hierarchy (Region → Panel → Field) ─────────────

export interface RegionStyle {
  background?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'none';
  shadow?: 'sm' | 'md' | 'none';
  borderRadius?: 'none' | 'sm' | 'lg';
}

export interface PanelStyle {
  headerBackground?: string;
  headerTextColor?: string;
  headerBold?: boolean;
  headerItalic?: boolean;
  headerUppercase?: boolean;
  bodyBackground?: string;
}

export interface LabelStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
}

export interface ValueStyle {
  color?: string;
  background?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface PanelField {
  fieldApiName: string;
  labelOverride?: string;
  colSpan: number;
  order: number;
  labelStyle: LabelStyle;
  valueStyle: ValueStyle;
  behavior: 'none' | 'required' | 'readOnly' | 'hidden';
}

export interface LayoutPanel {
  id: string;
  label: string;
  order: number;
  columns: 1 | 2 | 3 | 4;
  style: PanelStyle;
  fields: PanelField[];
  hidden?: boolean;   // true = dim in editor canvas; excluded from record renderer
}

export interface LayoutWidget {
  id: string;
  widgetType: WidgetType;
  order: number;
  config: WidgetConfig;
}

export interface LayoutSection {
  id: string;
  label: string;
  gridColumn: number;
  gridColumnSpan: number;
  gridRow: number;
  gridRowSpan: number;
  style: RegionStyle;
  panels: LayoutPanel[];
  widgets: LayoutWidget[];
  hidden?: boolean;   // true = dim in editor canvas; excluded from record renderer
}

export interface LayoutTab {
  id: string;
  label: string;
  order: number;
  regions: LayoutSection[];
}

export interface PageLayout {
  id: string;
  name: string;
  objectApi?: string;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
  isDefault?: boolean;
  roles?: string[];
  layoutType?: 'create' | 'edit';
  tabs: LayoutTab[];
  /** Up to ~6 field API names shown in record header highlights strip */
  highlightFields?: string[];
  formattingRules?: FormattingRule[];
  /** Optional DB mirror / forward-compatible bag */
  extensions?: PageLayoutExtensions;
}

/** Legacy PageLayout shape — tabs use the old PageTab/PageSection/PageField hierarchy */
export interface LegacyPageLayout {
  id: string;
  name: string;
  objectApi?: string;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
  isDefault?: boolean;
  roles?: string[];
  layoutType?: 'create' | 'edit';
  tabs: LegacyPageTab[];
  highlightFields?: string[];
  formattingRules?: FormattingRule[];
  extensions?: PageLayoutExtensions;
}

export interface ObjectDef {
  id: string;
  apiName: string;
  label: string;
  pluralLabel?: string;
  description?: string;
  fields: FieldDef[];
  recordTypes: RecordType[];
  pageLayouts: PageLayout[];
  validationRules: ValidationRule[];
  /** Global search configuration — which fields are searched and how results display */
  searchConfig?: {
    /** Whether this object appears in the universal search bar */
    enabled: boolean;
    /** Field apiNames to match the search query against */
    searchableFields: string[];
    /** Field apiName used as the result title (e.g. "name") */
    titleField?: string;
    /** Field apiNames shown as the result subtitle */
    subtitleFields?: string[];
  };
  searchLayouts?: {
    defaultFields: string[];
    lookupDialogFields: string[];
    listViewFields: string[];
  };
  compactLayout?: {
    fieldApiNames: string[];
  };
  defaultRecordTypeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaVersion {
  version: number;
  timestamp: string;
  schema: OrgSchema;
  changedBy?: string;
  description?: string;
}

export type TemplatePanelDef = Omit<LayoutPanel, 'fields'>;
export type TemplateSectionDef = Omit<LayoutSection, 'panels' | 'widgets'> & {
  panels: TemplatePanelDef[];
};
export type TemplateTabDef = Omit<LayoutTab, 'regions'> & { regions: TemplateSectionDef[] };

/** Structural skeleton of a saved layout template (no field data) */
export interface CustomLayoutTemplate {
  id: string;
  name: string;
  objectApi: string;
  tabs: TemplateTabDef[];
  createdAt: string;
}

export interface OrgSchema {
  version: number; // increment on save
  objects: ObjectDef[];
  flows?: FlowDefinition[];
  customLayoutTemplates?: CustomLayoutTemplate[];
  updatedAt: string;
  createdBy?: string;
}

export type ConditionExpr = { 
  left: string; 
  op: "==" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | "INCLUDES" | "CONTAINS" | "STARTS_WITH"; 
  right: any;
};

/** A dependency rule for picklist values: when ALL conditions are met, show the listed values */
export type PicklistDependencyRule = {
  conditions: ConditionExpr[];
  values: string[];
};

// Helper types for UI components
export interface FieldOption {
  label: string;
  value: string;
  type: FieldType;
  icon?: string;
}

export interface DragDropItem {
  id: string;
  type: 'field' | 'section' | 'tab';
  data: any;
}

// Default field definitions for system objects.
// Exported as a getter so every consumer receives fresh clones — prevents
// shared-reference mutations across different ObjectDef instances.
const _SYSTEM_FIELDS: FieldDef[] = [
  {
    id: 'id',
    apiName: 'Id',
    label: 'Record ID',
    type: 'Text',
    readOnly: true,
    required: true,
    unique: true,
    helpText: 'System-generated unique identifier'
  },
  {
    id: 'createdDate',
    apiName: 'CreatedDate',
    label: 'Created Date',
    type: 'DateTime',
    readOnly: true,
    helpText: 'Date and time when record was created'
  },
  {
    id: 'lastModifiedDate',
    apiName: 'LastModifiedDate', 
    label: 'Last Modified Date',
    type: 'DateTime',
    readOnly: true,
    helpText: 'Date and time when record was last modified'
  },
  {
    id: 'createdBy',
    apiName: 'CreatedById',
    label: 'Created By',
    type: 'LookupUser',
    readOnly: true,
    helpText: 'User who created this record'
  },
  {
    id: 'lastModifiedBy',
    apiName: 'LastModifiedById',
    label: 'Last Modified By', 
    type: 'LookupUser',
    readOnly: true,
    helpText: 'User who last modified this record'
  }
];

/** Return a deep-cloned copy of the system fields so no two objects share references. */
export const SYSTEM_FIELDS: FieldDef[] = Object.freeze(
  _SYSTEM_FIELDS
) as unknown as FieldDef[];

/** Get independent copies of system fields for embedding in a new object. */
export function cloneSystemFields(): FieldDef[] {
  return _SYSTEM_FIELDS.map(f => ({ ...f }));
}

// Field type metadata for UI
export const FIELD_TYPES: FieldOption[] = [
  { label: 'Auto Number', value: 'AutoNumber', type: 'AutoNumber' },
  { label: 'Formula', value: 'Formula', type: 'Formula' },
  { label: 'Roll-Up Summary', value: 'RollupSummary', type: 'RollupSummary' },
  { label: 'Lookup Relationship', value: 'Lookup', type: 'Lookup' },
  { label: 'External Lookup', value: 'ExternalLookup', type: 'ExternalLookup' },
  { label: 'Checkbox', value: 'Checkbox', type: 'Checkbox' },
  { label: 'Currency', value: 'Currency', type: 'Currency' },
  { label: 'Date', value: 'Date', type: 'Date' },
  { label: 'Date/Time', value: 'DateTime', type: 'DateTime' },
  { label: 'Email', value: 'Email', type: 'Email' },
  { label: 'Geolocation', value: 'Geolocation', type: 'Geolocation' },
  { label: 'Number', value: 'Number', type: 'Number' },
  { label: 'Percent', value: 'Percent', type: 'Percent' },
  { label: 'Phone', value: 'Phone', type: 'Phone' },
  { label: 'Picklist', value: 'Picklist', type: 'Picklist' },
  { label: 'Multi-Select Picklist', value: 'MultiPicklist', type: 'MultiPicklist' },
  { label: 'Picklist with Text', value: 'PicklistText', type: 'PicklistText' },
  { label: 'Picklist with Lookup', value: 'PicklistLookup', type: 'PicklistLookup' },
  { label: 'Text', value: 'Text', type: 'Text' },
  { label: 'Text Area', value: 'TextArea', type: 'TextArea' },
  { label: 'Text Area (Long)', value: 'LongTextArea', type: 'LongTextArea' },
  { label: 'Text Area (Rich)', value: 'RichTextArea', type: 'RichTextArea' },
  { label: 'Text (Encrypted)', value: 'EncryptedText', type: 'EncryptedText' },
  { label: 'Time', value: 'Time', type: 'Time' },
  { label: 'URL', value: 'URL', type: 'URL' },
  { label: 'Address', value: 'Address', type: 'Address' },
  { label: 'Lookup User', value: 'LookupUser', type: 'LookupUser' },
  { label: 'Dropbox Files', value: 'DropboxFiles', type: 'DropboxFiles' }
];

// Helper to get field type categories
export const getFieldTypeCategory = (type: FieldType): string => {
  if (["AutoNumber", "Formula", "RollupSummary"].includes(type)) return "Advanced";
  if (["Lookup", "ExternalLookup", "LookupUser", "PicklistLookup"].includes(type)) return "Relationship";
  if (["Text", "TextArea", "LongTextArea", "RichTextArea", "EncryptedText"].includes(type)) return "Text";
  if (["Number", "Currency", "Percent"].includes(type)) return "Number";
  if (["Date", "DateTime", "Time"].includes(type)) return "Date/Time";
  if (["Picklist", "MultiPicklist", "PicklistText"].includes(type)) return "Selection";
  if (["DropboxFiles"].includes(type)) return "Integration";
  return "Other";
};

// Helper to get field type icon
export const getFieldTypeIcon = (type: FieldType): string => {
  const icons: Record<string, string> = {
    AutoNumber: "hash",
    Formula: "function",
    RollupSummary: "sigma",
    Lookup: "link",
    ExternalLookup: "external-link",
    LookupUser: "user",
    Checkbox: "check-square",
    Currency: "dollar-sign",
    Date: "calendar",
    DateTime: "calendar-clock",
    Email: "mail",
    Geolocation: "map-pin",
    Number: "hash",
    Percent: "percent",
    Phone: "phone",
    Picklist: "list",
    MultiPicklist: "list-checks",
    PicklistText: "list",
    PicklistLookup: "list",
    Text: "type",
    TextArea: "align-left",
    LongTextArea: "file-text",
    RichTextArea: "file-edit",
    EncryptedText: "lock",
    Time: "clock",
    URL: "link",
    Address: "map",
    DropboxFiles: "cloud",
  };
  return icons[type] || "circle";
};

// Utility functions
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function generateApiName(label: string): string {
  const raw = label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^(\d)/, '_$1') // prefix with _ if starts with number
    .substring(0, 40); // max 40 chars
  // Capitalize first letter so the API regex /^[A-Z].../ passes
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function validateApiName(apiName: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(apiName) && apiName.length <= 40;
}

export function getFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPES.find(ft => ft.value === type)?.label || type;
}

export function isSystemField(fieldApiName: string): boolean {
  return SYSTEM_FIELDS.some(sf => sf.apiName === fieldApiName);
}

export function createDefaultPageLayout(objectApiName: string): PageLayout {
  return {
    id: generateId(),
    name: `${objectApiName} Layout`,
    layoutType: 'edit',
    tabs: [
      {
        id: generateId(),
        label: 'Details',
        order: 0,
        regions: [
          {
            id: generateId(),
            label: 'Main',
            gridColumn: 1,
            gridColumnSpan: 12,
            gridRow: 1,
            gridRowSpan: 1,
            style: {},
            panels: [],
            widgets: [],
          },
        ],
      },
    ],
  };
}

export function createDefaultRecordType(objectApiName: string, pageLayoutId: string): RecordType {
  return {
    id: generateId(),
    name: 'Master',
    description: `Default record type for ${objectApiName}`,
    default: true,
    pageLayoutId
  };
}