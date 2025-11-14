// Core schema types for the Object Manager system

export type FieldType =
  | "text" 
  | "textarea" 
  | "number" 
  | "currency" 
  | "percent"
  | "checkbox" 
  | "date" 
  | "datetime"
  | "picklist" 
  | "multipicklist"
  | "lookup"   // reference to another object by id
  | "formula"; // eval read-only, simple functions, e.g., CONCAT, SUM

export interface FieldDef {
  id: string;
  apiName: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  precision?: number;
  scale?: number;
  maxLength?: number;
  picklistValues?: string[];
  defaultValue?: string | number | boolean | null;
  helpText?: string;
  controllingField?: string; // for dependent picklists
  visibleIf?: ConditionExpr[]; // conditional visibility rules
  formulaExpr?: string;        // for formula fields
  lookupObject?: string;       // target object for lookup fields
  dependentValues?: { [controllingValue: string]: string[] }; // dependent picklist values
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

export interface PageSection {
  id: string;
  label: string;
  columns: 1 | 2 | 3;
  fields: string[]; // field apiNames
  visibleIf?: ConditionExpr[];
}

export interface PageTab {
  id: string;
  label: string;
  sections: PageSection[];
}

export interface PageLayout {
  id: string;
  name: string;
  tabs: PageTab[];
}

export interface PermissionSet {
  id: string;
  name: string;
  objectPermissions: { 
    [objectApi: string]: { 
      read: boolean; 
      create: boolean; 
      edit: boolean; 
      delete: boolean; 
    } 
  };
  fieldPermissions: { 
    [fieldApi: string]: { 
      read: boolean; 
      edit: boolean; 
    } 
  };
}

export interface ObjectDef {
  id: string;
  apiName: string;
  label: string;
  fields: FieldDef[];
  recordTypes: RecordType[];
  pageLayouts: PageLayout[];
  validationRules: ValidationRule[];
  defaultRecordTypeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrgSchema {
  version: number; // increment on save
  objects: ObjectDef[];
  permissionSets: PermissionSet[];
  updatedAt: string;
  createdBy?: string;
}

export type ConditionExpr = { 
  left: string; 
  op: "==" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | "INCLUDES" | "CONTAINS" | "STARTS_WITH"; 
  right: any;
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

// Default field definitions for system objects
export const SYSTEM_FIELDS: FieldDef[] = [
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

// Field type metadata for UI
export const FIELD_TYPES: FieldOption[] = [
  { label: 'Text', value: 'text', type: 'text' },
  { label: 'Text Area', value: 'textarea', type: 'textarea' },
  { label: 'Number', value: 'number', type: 'number' },
  { label: 'Currency', value: 'currency', type: 'currency' },
  { label: 'Percent', value: 'percent', type: 'percent' },
  { label: 'Checkbox', value: 'checkbox', type: 'checkbox' },
  { label: 'Date', value: 'date', type: 'date' },
  { label: 'Date & Time', value: 'datetime', type: 'datetime' },
  { label: 'Picklist', value: 'picklist', type: 'picklist' },
  { label: 'Multi-Select Picklist', value: 'multipicklist', type: 'multipicklist' },
  { label: 'Lookup Relationship', value: 'lookup', type: 'lookup' },
  { label: 'Formula', value: 'formula', type: 'formula' }
];

// Utility functions
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function generateApiName(label: string): string {
  return label
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/^(\d)/, '_$1') // prefix with _ if starts with number
    .substring(0, 40); // max 40 chars
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
    tabs: [
      {
        id: generateId(),
        label: 'Details',
        sections: [
          {
            id: generateId(),
            label: 'Information',
            columns: 2,
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