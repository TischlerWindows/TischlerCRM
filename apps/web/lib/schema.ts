// Core schema types for the Object Manager system

export type FieldType =
  | "AutoNumber" | "Formula" | "RollupSummary"
  | "Lookup" | "ExternalLookup"
  | "Checkbox" | "Currency" | "Date" | "DateTime" | "Email"
  | "Geolocation" | "Number" | "Percent" | "Phone"
  | "Picklist" | "MultiPicklist" | "MultiSelectPicklist" | "PicklistText"
  | "Text" | "TextArea" | "LongTextArea" | "RichTextArea" | "EncryptedText"
  | "Time" | "URL" | "Address" | "CompositeText" | "AutoUser" | "LookupUser";

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
    compositetext: 'CompositeText',
    autouser: 'AutoUser',
    lookupuser: 'LookupUser',
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
  picklistPosition?: 'left' | 'right';  // for PicklistText: which side gets the dropdown
  defaultValue?: any;
  helpText?: string;
  controllingField?: string; // for dependent picklists
  visibleIf?: ConditionExpr[]; // conditional visibility rules
  picklistDependencies?: PicklistDependencyRule[]; // conditional visibility for picklist values
  formulaExpr?: string;        // for formula fields
  lookupObject?: string;       // target object for lookup fields
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
  pageLayoutId?: string;
}

export interface FormattingRule {
  id: string;
  name: string;
  active: boolean;
  when: string; // boolean expr using field apiNames
  effects: {
    hidden?: boolean;
    readOnly?: boolean;
    badge?: "success" | "warning" | "destructive";
    className?: string;
    icon?: string;
  };
}

export interface PageSection {
  id: string;
  label: string;
  columns: 1 | 2 | 3;
  order: number;
  fields: PageField[];
  visibleIf?: ConditionExpr[];
  /** When false, the section is completely hidden on the record detail view */
  showInRecord?: boolean;
  /** When false, the section is hidden in the create/edit form template */
  showInTemplate?: boolean;
}

/**
 * A field reference inside a page layout section.
 *
 * Self-contained: every rendering-relevant property from the parent
 * FieldDef is embedded directly so DynamicForm never needs to cross-
 * reference `object.fields` at render time.  The enrichment happens
 * once during schema load (see `enrichLayoutFieldDefs` in schema-service).
 */
export type PageField = {
  apiName: string;
  column: number;
  order: number;
} & Partial<Omit<FieldDef, 'apiName'>>;

export interface PageTab {
  id: string;
  label: string;
  order: number;
  sections: PageSection[];
}

export interface PageLayout {
  id: string;
  name: string;
  layoutType: 'create' | 'edit'; // New Record vs Existing Record
  tabs: PageTab[];
  formattingRules?: FormattingRule[];
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

export interface OrgSchema {
  version: number; // increment on save
  objects: ObjectDef[];
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
    type: 'text',
    required: true,
    unique: true,
    helpText: 'System-generated unique identifier'
  },
  {
    id: 'createdDate',
    apiName: 'CreatedDate',
    label: 'Created Date',
    type: 'datetime',
    helpText: 'Date and time when record was created'
  },
  {
    id: 'lastModifiedDate',
    apiName: 'LastModifiedDate', 
    label: 'Last Modified Date',
    type: 'datetime',
    helpText: 'Date and time when record was last modified'
  },
  {
    id: 'createdBy',
    apiName: 'CreatedById',
    label: 'Created By',
    type: 'lookup',
    lookupObject: 'User',
    helpText: 'User who created this record'
  },
  {
    id: 'lastModifiedBy',
    apiName: 'LastModifiedById',
    label: 'Last Modified By', 
    type: 'lookup',
    lookupObject: 'User',
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
  { label: 'Text', value: 'Text', type: 'Text' },
  { label: 'Text Area', value: 'TextArea', type: 'TextArea' },
  { label: 'Text Area (Long)', value: 'LongTextArea', type: 'LongTextArea' },
  { label: 'Text Area (Rich)', value: 'RichTextArea', type: 'RichTextArea' },
  { label: 'Text (Encrypted)', value: 'EncryptedText', type: 'EncryptedText' },
  { label: 'Time', value: 'Time', type: 'Time' },
  { label: 'URL', value: 'URL', type: 'URL' },
  { label: 'Address', value: 'Address', type: 'Address' },
  { label: 'Lookup User', value: 'LookupUser', type: 'LookupUser' }
];

// Helper to get field type categories
export const getFieldTypeCategory = (type: FieldType): string => {
  if (["AutoNumber", "Formula", "RollupSummary"].includes(type)) return "Advanced";
  if (["Lookup", "ExternalLookup", "LookupUser"].includes(type)) return "Relationship";
  if (["Text", "TextArea", "LongTextArea", "RichTextArea", "EncryptedText"].includes(type)) return "Text";
  if (["Number", "Currency", "Percent"].includes(type)) return "Number";
  if (["Date", "DateTime", "Time"].includes(type)) return "Date/Time";
  if (["Picklist", "MultiPicklist", "PicklistText"].includes(type)) return "Selection";
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
    Text: "type",
    TextArea: "align-left",
    LongTextArea: "file-text",
    RichTextArea: "file-edit",
    EncryptedText: "lock",
    Time: "clock",
    URL: "link",
    Address: "map",
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
        sections: [
          {
            id: generateId(),
            label: 'Information',
            columns: 2,
            order: 0,
            fields: []
          }
        ]
      }
    ]
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