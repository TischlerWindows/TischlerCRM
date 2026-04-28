'use client';

import React from 'react';
import {
  FieldDef,
  FieldType,
  PageField,
  ObjectDef,
  normalizeFieldType,
  isSystemField,
} from '@/lib/schema';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { evaluateVisibility, VisibilityContext } from '@/lib/field-visibility';
import {
  getFormattingEffectsForField,
} from '@/lib/layout-formatting';
import { labelPresentationClassName } from '@/lib/layout-presentation';
import {
  CalendarIcon,
  DollarSign,
  Hash,
  Percent,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Lock,
  FileText,
  CheckSquare,
  List,
  Link as LinkIcon,
  Layout,
  User as UserIcon,
} from 'lucide-react';
import { cn, evaluateFormulaForRecord } from '@/lib/utils';

import { AddressInput, LocationSearchInput, GeolocationInput } from './address-field';
import AddressAutocomplete from '@/components/address-autocomplete';
import {
  PicklistInput,
  MultiPicklistInput,
  PicklistTextInput,
  PicklistTextDropdown,
  DropdownWithCustomInput,
  filterPicklistValues,
} from './picklist-fields';
import {
  LookupSearch,
  LookupUserSearch,
  getRecordLabel,
  getLookupTargetApi,
} from './lookup-search';

// ── LookupFields display component ─────────────────────────────────

export function LookupFieldsDisplay({
  config,
  formData,
  objectFields,
  lookupRecordsCache,
  schema,
  labelOverride,
}: {
  config: import('@/lib/schema').LookupFieldsConfig;
  formData: Record<string, any>;
  objectFields: FieldDef[];
  lookupRecordsCache: Record<string, any[]>;
  schema: any;
  labelOverride?: string;
}) {
  const { sourceLookupApiName, displayFields } = config;

  // Find the source lookup field definition
  const sourceDef = objectFields.find(f => f.apiName === sourceLookupApiName);
  const targetApi = sourceDef ? getLookupTargetApi(sourceDef, objectFields, schema?.objects) : null;
  const records: any[] = targetApi ? (lookupRecordsCache[targetApi] || []) : [];

  // Get the ID stored in formData for the source lookup
  const rawVal = formData[sourceLookupApiName];
  const lookupId: string | null =
    rawVal && typeof rawVal === 'object'
      ? (rawVal.lookup ? String(rawVal.lookup) : null)
      : (rawVal !== undefined && rawVal !== null && rawVal !== '') ? String(rawVal) : null;

  // Find the related record
  const relatedRecord = lookupId ? records.find(r => String(r.id) === lookupId) : null;

  // Resolve object prefix to strip from field names when reading record
  const targetObj = schema?.objects?.find((o: any) => o.apiName === targetApi);
  const prefix = targetApi ? `${targetApi}__` : '';

  const getFieldLabel = (fieldApiName: string): string => {
    const field = targetObj?.fields?.find((f: any) => f.apiName === fieldApiName || f.apiName === `${prefix}${fieldApiName}`);
    return field?.label || fieldApiName;
  };

  const getFieldValue = (fieldApiName: string): string => {
    if (!relatedRecord) return '—';
    const val = relatedRecord[fieldApiName] ?? relatedRecord[`${prefix}${fieldApiName}`];
    if (val === undefined || val === null || val === '') return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-0">
      <div className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
        <LinkIcon className="h-4 w-4 text-gray-400" />
        {labelOverride || (sourceDef?.label ? `Fields from ${sourceDef.label}` : 'Linked Fields')}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {displayFields.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-400 italic">No fields configured</div>
        ) : (
          displayFields.map((fieldApiName, i) => (
            <div
              key={fieldApiName}
              className={cn(
                'flex items-start px-3 py-2 gap-3',
                i < displayFields.length - 1 && 'border-b border-gray-100',
                i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white',
              )}
            >
              <span className="text-xs font-medium text-gray-500 min-w-[100px] pt-0.5">
                {getFieldLabel(fieldApiName)}
              </span>
              <span className="text-sm text-gray-900">
                {getFieldValue(fieldApiName)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Field icon map ──────────────────────────────────────────────────

export function getFieldIcon(type: FieldType) {
  const iconMap: Record<string, any> = {
    Text: FileText,
    TextArea: FileText,
    LongTextArea: FileText,
    RichTextArea: FileText,
    EncryptedText: Lock,
    Email: Mail,
    Phone: Phone,
    URL: Globe,
    Number: Hash,
    Currency: DollarSign,
    Percent: Percent,
    Date: CalendarIcon,
    DateTime: CalendarIcon,
    Time: Clock,
    Checkbox: CheckSquare,
    Picklist: List,
    MultiPicklist: List,
    MultiSelectPicklist: List,
    PicklistText: List,
    DropdownWithCustom: List,
    Address: MapPin,
    Geolocation: MapPin,
    Lookup: LinkIcon,
    ExternalLookup: LinkIcon,
    LookupUser: UserIcon,
    AutoNumber: Hash,
    AutoUser: Layout,
    Formula: Hash,
    RollupSummary: Hash,
    CompositeText: FileText,
  };
  return iconMap[type] || FileText;
}

// ── Auto-generated field type detection ─────────────────────────────

const AUTO_GENERATED_FIELD_TYPES = new Set([
  'AutoNumber',
  'Formula',
  'RollupSummary',
  'AutoUser',
]);

// ── FieldInput props ────────────────────────────────────────────────

export interface FieldInputProps {
  fieldDef: FieldDef;
  layoutField?: PageField;
  layout: import('@/lib/schema').PageLayout;
  formData: Record<string, any>;
  errors: Record<string, string>;
  visibilityCtx: VisibilityContext;
  objectApiName: string;
  schema: any;
  stretch?: boolean;
  // Callbacks
  onFieldChange: (fieldApiName: string, value: any) => void;
  // Lookup state & callbacks
  lookupQueries: Record<string, string>;
  activeLookupField: string | null;
  lookupRecordsCache: Record<string, any[]>;
  objectFields: FieldDef[];
  onLookupQueryChange: (fieldApiName: string, query: string) => void;
  onLookupFocus: (fieldApiName: string) => void;
  onLookupBlur: (fieldApiName: string) => void;
  onInlineCreate: (targetApi: string, forField: string) => void;
}

// ── FieldInput component ────────────────────────────────────────────

export function FieldInput({
  fieldDef,
  layoutField,
  layout,
  formData,
  errors,
  visibilityCtx,
  objectApiName,
  schema,
  stretch,
  onFieldChange,
  lookupQueries,
  activeLookupField,
  lookupRecordsCache,
  objectFields,
  onLookupQueryChange,
  onLookupFocus,
  onLookupBlur,
  onInlineCreate,
}: FieldInputProps) {
  // Check if field should be visible based on visibility rules
  const isVisible = evaluateVisibility(
    fieldDef.visibleIf,
    formData,
    visibilityCtx,
  );
  if (!isVisible) return null;

  const formatFx = getFormattingEffectsForField(
    layout,
    fieldDef.apiName,
    formData,
    visibilityCtx,
  );
  if (formatFx?.hidden) return null;

  // ── LookupFields: virtual display-only panel field ───────────
  if ((layoutField as any)?.kind === 'lookupFields' && (layoutField as any)?.lookupFieldsConfig) {
    return (
      <LookupFieldsDisplay
        config={(layoutField as any).lookupFieldsConfig}
        formData={formData}
        objectFields={objectFields}
        lookupRecordsCache={lookupRecordsCache}
        schema={schema}
        labelOverride={(layoutField as any).labelOverride}
      />
    );
  }

  const value = formData[fieldDef.apiName];
  const error = errors[fieldDef.apiName];
  const Icon = getFieldIcon(fieldDef.type);
  const isFieldAutoGenerated =
    AUTO_GENERATED_FIELD_TYPES.has(fieldDef.type as string) ||
    isSystemField(fieldDef.apiName);
  const isReadOnly =
    fieldDef.readOnly ||
    isFieldAutoGenerated ||
    formatFx?.readOnly === true;

  const commonProps = {
    id: fieldDef.apiName,
    value: value || '',
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => onFieldChange(fieldDef.apiName, e.target.value),
    disabled: isReadOnly,
    placeholder: isFieldAutoGenerated ? 'Auto-generated' : undefined,
    className: cn(error && 'border-red-500'),
  };

  let inputElement: React.ReactNode;

  switch (fieldDef.type) {
    // ── Checkbox ──────────────────────────────────────────────
    case 'Checkbox':
      inputElement = (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={fieldDef.apiName}
            checked={value || false}
            onChange={(e) =>
              onFieldChange(fieldDef.apiName, e.target.checked)
            }
            disabled={isReadOnly}
            className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
          />
          <Label
            htmlFor={fieldDef.apiName}
            className={cn(
              'text-sm',
              labelPresentationClassName((layoutField as any)?.presentation),
            )}
          >
            {fieldDef.label}
            {fieldDef.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </Label>
        </div>
      );
      return (
        <div key={fieldDef.apiName} className="flex flex-col">
          {inputElement}
          {error && (
            <span className="text-xs text-red-500 mt-1" role="alert">{error}</span>
          )}
          {fieldDef.helpText && (
            <span className="text-xs text-gray-500 mt-1">
              {fieldDef.helpText}
            </span>
          )}
        </div>
      );

    // ── TextArea / LongTextArea / RichTextArea ───────────────
    case 'TextArea':
      inputElement = <Textarea {...commonProps} rows={3} />;
      break;
    case 'LongTextArea':
      inputElement = <Textarea {...commonProps} rows={6} />;
      break;
    case 'RichTextArea':
      inputElement = <Textarea {...commonProps} rows={8} />;
      break;

    // ── Picklist ─────────────────────────────────────────────
    case 'Picklist':
      inputElement = (
        <PicklistInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          disabled={isReadOnly}
          error={error}
          formData={formData}
          visibilityCtx={visibilityCtx}
        />
      );
      break;

    // ── MultiPicklist ────────────────────────────────────────
    case 'MultiPicklist':
    case 'MultiSelectPicklist':
      inputElement = (
        <MultiPicklistInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          disabled={isReadOnly}
          formData={formData}
          visibilityCtx={visibilityCtx}
        />
      );
      break;

    // ── DropdownWithCustom ────────────────────────────────────
    case 'DropdownWithCustom':
      inputElement = (
        <DropdownWithCustomInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          disabled={isReadOnly}
          error={error}
          formData={formData}
          visibilityCtx={visibilityCtx}
        />
      );
      break;

    // ── PicklistText ─────────────────────────────────────────
    case 'PicklistText':
      inputElement = (
        <PicklistTextInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          disabled={isReadOnly}
          formData={formData}
          visibilityCtx={visibilityCtx}
        />
      );
      break;

    // ── Date / DateTime / Time ───────────────────────────────
    case 'Date':
      inputElement = <Input {...commonProps} type="date" />;
      break;
    case 'DateTime':
      if (isSystemField(fieldDef.apiName)) {
        const formatted = value
          ? new Date(value).toLocaleString(undefined, {
              year: 'numeric', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })
          : null;
        inputElement = (
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
            {formatted || '(Auto-generated)'}
          </div>
        );
      } else {
        inputElement = <Input {...commonProps} type="datetime-local" />;
      }
      break;
    case 'Time':
      inputElement = <Input {...commonProps} type="time" />;
      break;

    // ── Number / Currency / Percent ──────────────────────────
    case 'Number':
    case 'Currency':
    case 'Percent':
      inputElement = (
        <div className="relative">
          {fieldDef.type === 'Currency' && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              $
            </span>
          )}
          <Input
            {...commonProps}
            type="number"
            step={
              fieldDef.scale
                ? `0.${'0'.repeat(fieldDef.scale - 1)}1`
                : '1'
            }
            className={cn(
              commonProps.className,
              fieldDef.type === 'Currency' && 'pl-8',
              fieldDef.type === 'Percent' && 'pr-8',
            )}
          />
          {fieldDef.type === 'Percent' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
              %
            </span>
          )}
        </div>
      );
      break;

    // ── Email / Phone / URL / EncryptedText ──────────────────
    case 'Email':
      inputElement = <Input {...commonProps} type="email" />;
      break;
    case 'Phone':
      inputElement = <Input {...commonProps} type="tel" />;
      break;
    case 'URL':
      if (fieldDef.staticUrl) {
        inputElement = (
          <a
            href={fieldDef.staticUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 text-brand-navy hover:text-brand-dark underline text-sm"
          >
            {fieldDef.staticUrl}
          </a>
        );
      } else {
        inputElement = <Input {...commonProps} type="url" />;
      }
      break;
    case 'EncryptedText':
      inputElement = <Input {...commonProps} type="password" />;
      break;

    // ── AutoNumber / RollupSummary ───────────────────────────
    case 'AutoNumber':
    case 'RollupSummary':
      inputElement = (
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
          {value || '(Auto-generated)'}
        </div>
      );
      break;

    // ── Formula ──────────────────────────────────────────────
    case 'Formula': {
      const objectDef = schema?.objects.find(
        (o: ObjectDef) => o.apiName === objectApiName,
      );
      let formulaDisplay: any = value;
      if (fieldDef.formulaExpr) {
        const computed = evaluateFormulaForRecord(
          fieldDef.formulaExpr,
          formData,
          objectDef,
        );
        if (computed !== null && computed !== undefined)
          formulaDisplay = computed;
      }
      inputElement = (
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
          {formulaDisplay != null && formulaDisplay !== ''
            ? String(formulaDisplay)
            : '(Computed)'}
        </div>
      );
      break;
    }

    // ── AutoUser ─────────────────────────────────────────────
    case 'AutoUser':
      inputElement = (
        <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
          {value || '(Current user)'}
        </div>
      );
      break;

    // ── Address ──────────────────────────────────────────────
    // Render sub-fields directly (same pattern as CompositeText)
    // so edits go through the same onFieldChange path that works
    // for every other field type.
    case 'Address': {
      const addrObj =
        value && typeof value === 'object' && !Array.isArray(value)
          ? value
          : (() => {
              if (typeof value === 'string') {
                try { const p = JSON.parse(value); return typeof p === 'object' && p ? p : {}; } catch { return {}; }
              }
              return {};
            })();

      const addrDisplay = [addrObj.street, addrObj.city, addrObj.state, addrObj.postalCode, addrObj.country]
        .filter(Boolean)
        .join(', ');

      inputElement = (
        <div className="space-y-2 border border-gray-300 rounded-lg p-3">
          {!isReadOnly && (
            <AddressAutocomplete
              disabled={isReadOnly}
              placeholder="Search for an address..."
              value={addrDisplay}
              onAddressSelected={(addr) => {
                onFieldChange(fieldDef.apiName, {
                  street: addr.street,
                  city: addr.city,
                  state: addr.state,
                  postalCode: addr.postalCode,
                  country: addr.country,
                  lat: addr.lat,
                  lng: addr.lng,
                });
              }}
            />
          )}
          <input
            type="text"
            placeholder="Street"
            value={addrObj.street || ''}
            onChange={(e) =>
              onFieldChange(fieldDef.apiName, {
                ...addrObj,
                street: e.target.value,
              })
            }
            disabled={isReadOnly}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City"
              value={addrObj.city || ''}
              onChange={(e) =>
                onFieldChange(fieldDef.apiName, {
                  ...addrObj,
                  city: e.target.value,
                })
              }
              disabled={isReadOnly}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
            />
            <input
              type="text"
              placeholder="State/Province"
              value={addrObj.state || ''}
              onChange={(e) =>
                onFieldChange(fieldDef.apiName, {
                  ...addrObj,
                  state: e.target.value,
                })
              }
              disabled={isReadOnly}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Postal Code"
              value={addrObj.postalCode || ''}
              onChange={(e) =>
                onFieldChange(fieldDef.apiName, {
                  ...addrObj,
                  postalCode: e.target.value,
                })
              }
              disabled={isReadOnly}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
            />
            <input
              type="text"
              placeholder="Country"
              value={addrObj.country || ''}
              onChange={(e) =>
                onFieldChange(fieldDef.apiName, {
                  ...addrObj,
                  country: e.target.value,
                })
              }
              disabled={isReadOnly}
              className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ pointerEvents: 'auto', position: 'relative', zIndex: 1 }}
            />
          </div>
        </div>
      );
      break;
    }

    // ── LocationSearch ───────────────────────────────────────
    case 'LocationSearch' as FieldType:
      inputElement = (
        <LocationSearchInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          onFieldChange={onFieldChange}
          formData={formData}
          disabled={isReadOnly}
        />
      );
      break;

    // ── Geolocation ──────────────────────────────────────────
    case 'Geolocation':
      inputElement = (
        <GeolocationInput
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => onFieldChange(fieldDef.apiName, val)}
          disabled={isReadOnly}
        />
      );
      break;

    // ── Lookup / ExternalLookup ──────────────────────────────
    case 'Lookup':
    case 'ExternalLookup': {
      const targetApi = getLookupTargetApi(
        fieldDef,
        objectFields,
        schema?.objects,
      );
      const records = targetApi ? lookupRecordsCache[targetApi] || [] : [];
      inputElement = (
        <LookupSearch
          fieldDef={fieldDef}
          value={value}
          onChange={(val) => {
            onFieldChange(fieldDef.apiName, val);
          }}
          disabled={isReadOnly}
          error={error}
          records={records}
          lookupQuery={lookupQueries[fieldDef.apiName] ?? ''}
          isActive={activeLookupField === fieldDef.apiName}
          onQueryChange={(q) => onLookupQueryChange(fieldDef.apiName, q)}
          onFocus={() => onLookupFocus(fieldDef.apiName)}
          onBlur={() => onLookupBlur(fieldDef.apiName)}
          onInlineCreate={(tApi) => onInlineCreate(tApi, fieldDef.apiName)}
          schemaObjects={schema?.objects}
        />
      );
      break;
    }

    // ── LookupUser ───────────────────────────────────────────
    case 'LookupUser': {
      const userRecords = lookupRecordsCache['__users__'] || [];
      if (isSystemField(fieldDef.apiName)) {
        const matchedUser = value
          ? userRecords.find((u: any) => String(u.id) === String(value))
          : null;
        const displayName = matchedUser
          ? (matchedUser.name || matchedUser.email || String(value))
          : (value ? String(value) : null);
        inputElement = (
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
            {displayName || '(Auto-generated)'}
          </div>
        );
      } else {
        inputElement = (
          <LookupUserSearch
            fieldDef={fieldDef}
            value={value}
            onChange={(val) => onFieldChange(fieldDef.apiName, val)}
            disabled={isReadOnly}
            error={error}
            userRecords={userRecords}
            lookupQuery={lookupQueries[fieldDef.apiName] ?? ''}
            isActive={activeLookupField === fieldDef.apiName}
            onQueryChange={(q) => onLookupQueryChange(fieldDef.apiName, q)}
            onFocus={() => onLookupFocus(fieldDef.apiName)}
            onBlur={() => onLookupBlur(fieldDef.apiName)}
          />
        );
      }
      break;
    }

    // ── CompositeText ────────────────────────────────────────
    case 'CompositeText': {
      const compositeValue = value || {};
      inputElement = (
        <div className="space-y-3 border border-gray-300 rounded-lg p-3">
          {fieldDef.subFields &&
            fieldDef.subFields.map((subField) => {
              if (subField.type === 'Picklist') {
                return (
                  <div
                    key={subField.apiName}
                    className="flex flex-col space-y-1"
                  >
                    <label className="text-sm font-medium text-gray-700">
                      {subField.label}
                    </label>
                    <select
                      value={compositeValue[subField.apiName] || ''}
                      onChange={(e) =>
                        onFieldChange(fieldDef.apiName, {
                          ...compositeValue,
                          [subField.apiName]: e.target.value,
                        })
                      }
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
                    >
                      <option value="">-- Select --</option>
                      {fieldDef.apiName === 'Contact__name' &&
                        subField.apiName ===
                          'Contact__name_salutation' && (
                          <>
                            <option value="Mr.">Mr.</option>
                            <option value="Mrs.">Mrs.</option>
                            <option value="Ms.">Ms.</option>
                            <option value="Dr.">Dr.</option>
                            <option value="Prof.">Prof.</option>
                          </>
                        )}
                    </select>
                  </div>
                );
              } else {
                return (
                  <div
                    key={subField.apiName}
                    className="flex flex-col space-y-1"
                  >
                    <label className="text-sm font-medium text-gray-700">
                      {subField.label}
                    </label>
                    <Input
                      type="text"
                      value={compositeValue[subField.apiName] || ''}
                      onChange={(e) =>
                        onFieldChange(fieldDef.apiName, {
                          ...compositeValue,
                          [subField.apiName]: e.target.value,
                        })
                      }
                      disabled={isReadOnly}
                      placeholder={subField.label}
                    />
                  </div>
                );
              }
            })}
        </div>
      );
      break;
    }

    // ── PicklistLookup ───────────────────────────────────────
    case 'PicklistLookup': {
      const plkOptions = filterPicklistValues(
        fieldDef.picklistValues || [],
        fieldDef,
        formData,
        visibilityCtx,
      );
      const plkValue =
        typeof value === 'object' && value !== null
          ? value
          : { picklist: '', lookup: '' };
      const plkPosition = (fieldDef as any).picklistPosition || 'left';
      const plkTargetApi = getLookupTargetApi(
        fieldDef,
        objectFields,
        schema?.objects,
      );
      const plkRecords = plkTargetApi
        ? lookupRecordsCache[plkTargetApi] || []
        : [];
      const plkRecordsArray = Array.isArray(plkRecords) ? plkRecords : [];
      const plkSelectedRecord = plkValue.lookup
        ? plkRecordsArray.find(
            (r) => String(r.id) === String(plkValue.lookup),
          )
        : null;
      const plkSelectedLabel = plkSelectedRecord
        ? getRecordLabel(plkSelectedRecord)
        : '';
      const plkLookupQuery =
        lookupQueries[fieldDef.apiName + '__lookup'] ?? '';
      const isPlkLookupActive =
        activeLookupField === fieldDef.apiName + '__lookup';
      const plkDisplayValue = isPlkLookupActive
        ? plkLookupQuery
        : plkSelectedLabel || (plkValue.lookup ? plkLookupQuery : '');

      const plkFilteredRecords = plkRecordsArray.filter((record) => {
        const label = getRecordLabel(record);
        const labelStr =
          typeof label === 'string' ? label : String(label || '');
        if (!labelStr) return true;
        const query = plkLookupQuery.toLowerCase();
        if (labelStr.toLowerCase().includes(query)) return true;
        return Object.values(record).some(
          (val) =>
            typeof val === 'string' && val.toLowerCase().includes(query),
        );
      });

      const picklistSide = (
        <PicklistTextDropdown
          options={plkOptions}
          value={plkValue.picklist || ''}
          onChange={(val) =>
            onFieldChange(fieldDef.apiName, {
              ...plkValue,
              picklist: val,
            })
          }
          disabled={isReadOnly}
          colors={(fieldDef as any).picklistColors as Record<string, string> | undefined}
        />
      );

      const lookupSide = (
        <div className="relative w-1/2 min-w-0">
          <Input
            value={plkDisplayValue}
            placeholder={`Search ${fieldDef.relationshipName || plkTargetApi || 'records'}...`}
            onChange={(e) => {
              onLookupQueryChange(
                fieldDef.apiName + '__lookup',
                e.target.value,
              );
              onLookupFocus(fieldDef.apiName + '__lookup');
            }}
            onFocus={() => onLookupFocus(fieldDef.apiName + '__lookup')}
            onBlur={() => onLookupBlur(fieldDef.apiName + '__lookup')}
            disabled={isReadOnly}
          />
          {isPlkLookupActive && (
            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => {
                  onFieldChange(fieldDef.apiName, {
                    ...plkValue,
                    lookup: '',
                  });
                  onLookupQueryChange(fieldDef.apiName + '__lookup', '');
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-500',
                  !plkValue.lookup && 'bg-blue-50',
                )}
              >
                -- None --
              </button>
              {plkFilteredRecords.length > 0 ? (
                plkFilteredRecords.slice(0, 20).map((record) => {
                  const label = getRecordLabel(record);
                  const displayLabel =
                    typeof label === 'string'
                      ? label
                      : String(label || 'Record');
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => {
                        onFieldChange(fieldDef.apiName, {
                          ...plkValue,
                          lookup: record.id,
                        });
                        onLookupQueryChange(
                          fieldDef.apiName + '__lookup',
                          displayLabel,
                        );
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900 truncate">
                        {displayLabel}
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.id}
                      </div>
                    </button>
                  );
                })
              ) : plkLookupQuery ? (
                <div className="px-3 py-2 text-xs text-gray-500">
                  No matches found.
                </div>
              ) : null}
              {plkTargetApi &&
                (() => {
                  const targetObj = schema?.objects?.find(
                    (o: ObjectDef) => o.apiName === plkTargetApi,
                  );
                  const createLabel = targetObj?.label || plkTargetApi;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        onInlineCreate(plkTargetApi, fieldDef.apiName)
                      }
                      className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-gray-100 rounded-b-lg"
                    >
                      + Create new {createLabel}
                    </button>
                  );
                })()}
            </div>
          )}
        </div>
      );

      inputElement = (
        <div className="flex gap-2 items-start">
          {plkPosition === 'left' ? (
            <>
              {picklistSide}
              {lookupSide}
            </>
          ) : (
            <>
              {lookupSide}
              {picklistSide}
            </>
          )}
        </div>
      );
      break;
    }

    // ── Default (Text and any unrecognized type) ─────────────
    default:
      // LookupFields type: use fieldDef.displayFields + layout-level sourceLookupApiName
      if (fieldDef.type === 'LookupFields') {
        const sourceLookupApiName: string =
          (layoutField as any)?.lookupFieldsConfig?.sourceLookupApiName ?? '';
        const config: import('@/lib/schema').LookupFieldsConfig = {
          sourceLookupApiName,
          displayFields: (fieldDef as any).displayFields ?? [],
        };
        return (
          <LookupFieldsDisplay
            key={fieldDef.apiName}
            config={config}
            formData={formData}
            objectFields={objectFields}
            lookupRecordsCache={lookupRecordsCache}
            schema={schema}
            labelOverride={(layoutField as any)?.labelOverride ?? fieldDef.label}
          />
        );
      }
      inputElement = <Input {...commonProps} type="text" />;
  }

  // ── Standard field wrapper (label + input + error + help) ─────
  return (
    <div
      key={fieldDef.apiName}
      className={cn('flex flex-col space-y-1', stretch && 'flex-1')}
    >
      {fieldDef.type !== ('Checkbox' as FieldType) && (
        <Label
          htmlFor={fieldDef.apiName}
          className="flex items-center gap-2 text-sm"
        >
          <Icon className="h-4 w-4 text-gray-400" />
          <span
            className={labelPresentationClassName((layoutField as any)?.presentation)}
          >
            {fieldDef.label}
            {fieldDef.required && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </span>
        </Label>
      )}
      {stretch ? (
        <div className="flex-1 flex flex-col [&>*]:flex-1 [&>select]:h-auto [&>textarea]:h-auto [&>input]:h-auto [&>div]:flex-1">
          {inputElement}
        </div>
      ) : (
        inputElement
      )}
      {error && <span className="text-xs text-red-500" role="alert">{error}</span>}
      {!error && fieldDef.helpText && (
        <span className="text-xs text-gray-500">{fieldDef.helpText}</span>
      )}
    </div>
  );
}
