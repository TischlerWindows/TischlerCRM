'use client';

import React from 'react';
import Link from 'next/link';
import { formatFieldValue, resolveLookupDisplayName, getLookupCachedRecord } from '@/lib/utils';
import { FieldDef, normalizeFieldType, type PageField } from '@/lib/schema';
import type { ObjectDef } from '@/lib/schema';
import LocationMapPreview from '@/components/location-map-preview';
import { DropboxFileBrowser } from '@/components/dropbox-file-browser';

// ── Lookup route map ───────────────────────────────────────────────────
const LOOKUP_ROUTE_MAP: Record<string, string> = {
  Contact: 'contacts',
  Account: 'accounts',
  Property: 'properties',
  Lead: 'leads',
  Opportunity: 'opportunities',
  Product: 'products',
  Quote: 'quotes',
  Project: 'projects',
  Service: 'service',
  Installation: 'installations',
  User: 'settings/users',
};

// ── getFieldDef ────────────────────────────────────────────────────────
/**
 * Resolves the FieldDef for a given API name, merging layout-enriched
 * data with the authoritative object-level definition.
 */
export function getFieldDef(
  apiName: string,
  objectDef: ObjectDef | undefined,
  layoutField?: PageField,
): FieldDef | undefined {
  const objField = objectDef?.fields.find((f) => f.apiName === apiName);

  if (layoutField && layoutField.type && layoutField.label) {
    const { column, order, presentation: _pres, colSpan: _cs, rowSpan: _rs, ...fieldProps } =
      layoutField as any;
    const def = {
      id: fieldProps.id || apiName,
      ...fieldProps,
      apiName,
      type: normalizeFieldType(fieldProps.type!),
    } as FieldDef;
    if (objField?.lookupObject) def.lookupObject = objField.lookupObject;
    if (objField?.relationshipName) def.relationshipName = objField.relationshipName;
    if (objField?.targetFields) def.targetFields = objField.targetFields;
    return def;
  }

  return objField;
}

// ── getRecordValue ─────────────────────────────────────────────────────
/**
 * Read a value from the flattened record, trying prefixed then stripped key.
 * Handles Formula computed values and CompositeText sub-field assembly.
 */
export function getRecordValue(
  apiName: string,
  record: Record<string, any> | null,
  fieldDef?: FieldDef,
  formulaValues?: Record<string, any>,
): any {
  if (!record) return undefined;

  // For Formula fields, return the computed value from the formula hook
  if (fieldDef?.type === 'Formula' && fieldDef.formulaExpr) {
    const computed = formulaValues?.[fieldDef.apiName] ?? formulaValues?.[apiName];
    if (computed !== undefined && computed !== null) return computed;
  }

  let value = record[apiName] ?? record[apiName.replace(/^[A-Za-z]+__/, '')];

  // For CompositeText, construct from sub-fields when missing
  if (!value && fieldDef?.type === 'CompositeText' && fieldDef.subFields) {
    const composite: Record<string, any> = {};
    for (const sf of fieldDef.subFields) {
      const v = record[sf.apiName] ?? record[sf.apiName.replace(/^[A-Za-z]+__/, '')];
      if (v) composite[sf.apiName] = v;
    }
    if (Object.keys(composite).length > 0) value = composite;
  }

  return value;
}

// ── renderValue ────────────────────────────────────────────────────────
/**
 * Render a field value with type-appropriate formatting (links for
 * email/phone/URL, locale formatting for numbers/dates, etc.).
 *
 * @param isLookupLoaded - true once the lookup cache has been populated; triggers re-render
 */
export function renderValue(
  apiName: string,
  rawValue: any,
  fieldDef: FieldDef | undefined,
  record: Record<string, any> | null,
  isLookupLoaded: boolean,
  compact = false,
  objectApiName?: string,
): React.ReactNode {
  // Auto-parse JSON strings
  let value = rawValue;
  if (typeof value === 'string' && value.startsWith('{')) {
    try { value = JSON.parse(value); } catch { /* not JSON */ }
  }
  const fieldType = fieldDef?.type;

  // DropboxFiles — render Dropbox browser panel on record pages
  if (fieldType === 'DropboxFiles' && record) {
    const recordId = String(record.id ?? record.Id ?? '');
    if (!recordId) return '-';

    // Prefer explicitly passed objectApiName, fall back to prefix on the field API name
    const sourceApiName = fieldDef?.apiName || apiName;
    const resolvedObjectApiName =
      objectApiName ||
      sourceApiName.match(/^([A-Za-z][A-Za-z0-9]*)__/)?.[1];
    if (!resolvedObjectApiName) return '-';

    const folderName = typeof value === 'string' && value.trim() ? value : undefined;

    return (
      <DropboxFileBrowser
        objectApiName={resolvedObjectApiName}
        recordId={recordId}
        folderName={folderName}
      />
    );
  }

  // LocationSearch — works like Address but merges scattered data first
  if (fieldType === 'LocationSearch' && record) {
    // Build a merged address object from all data sources (mirrors
    // buildLocationBlob in address-field.tsx).
    const valObj: Record<string, any> = (typeof value === 'object' && value) ? { ...value } : {};
    const tf = fieldDef?.targetFields || {};
    const fieldBase = (fieldDef?.apiName || '').replace(/^[A-Za-z]+__/, '');

    // 1. Dotted flat keys (e.g. address_search.city)
    for (const key of Object.keys(record)) {
      if (key.startsWith(fieldBase + '.')) {
        const sub = key.slice(fieldBase.length + 1);
        if (sub && valObj[sub] == null && record[key] != null && record[key] !== '') {
          valObj[sub] = record[key];
        }
      }
    }

    // 2. Compound address object at the street target
    if (tf.street) {
      const raw = record[tf.street] ?? record[tf.street.replace(/^[A-Za-z]+__/, '')];
      if (typeof raw === 'object' && raw) {
        for (const [k, v] of Object.entries(raw as Record<string, any>)) {
          if (valObj[k] == null && v != null && v !== '') valObj[k] = v;
        }
      }
    }

    // 3. Safe individual target-field columns (skip street)
    for (const jsonKey of ['city', 'state', 'postalCode', 'country', 'lat', 'lng'] as const) {
      if (valObj[jsonKey] == null && tf[jsonKey]) {
        const raw = record[tf[jsonKey]] ?? record[tf[jsonKey].replace(/^[A-Za-z]+__/, '')];
        if (raw != null && raw !== '' && typeof raw !== 'object') valObj[jsonKey] = raw;
      }
    }

    // Render exactly like Address
    const parts = [valObj.street, valObj.city, valObj.state, valObj.postalCode, valObj.country].filter(Boolean);
    const addressText = parts.length > 0 ? parts.join(', ') : '-';
    const lat = Number(valObj.lat);
    const lng = Number(valObj.lng);
    if (!compact && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return (
        <div className="space-y-2">
          <span>{addressText}</span>
          <LocationMapPreview lat={lat} lng={lng} address={addressText !== '-' ? addressText : undefined} />
        </div>
      );
    }
    return addressText;
  }

  if (value === null || value === undefined || value === '') return '-';

  // Lookup → clickable link showing resolved label (not raw UUID)
  if ((fieldType === 'Lookup' || fieldType === 'LookupUser') && (fieldDef?.lookupObject || fieldType === 'LookupUser')) {
    const lookupTarget = fieldDef?.lookupObject || 'User';
    const route = LOOKUP_ROUTE_MAP[lookupTarget];
    const displayLabel = resolveLookupDisplayName(value, lookupTarget);
    const link = route ? (
      <Link href={`/${route}/${value}`} className="text-brand-navy hover:underline underline-offset-2">
        {displayLabel}
      </Link>
    ) : displayLabel;

    // For Property lookups, show a Google Maps preview if the property has lat/lng
    if (lookupTarget === 'Property' && !compact) {
      const propRecord = getLookupCachedRecord('Property', String(value));
      if (propRecord) {
        // lat/lng may live inside address_search blob or as top-level fields
        const blob = propRecord.address_search ?? propRecord.Property__address_search ??
          (() => { const k = Object.keys(propRecord).find(x => x.toLowerCase().endsWith('__address_search') || x.toLowerCase() === 'address_search'); return k ? propRecord[k] : undefined; })();
        const lat = parseFloat(String(blob?.lat ?? propRecord.latitude ?? propRecord.Property__latitude ?? ''));
        const lng = parseFloat(String(blob?.lng ?? propRecord.longitude ?? propRecord.Property__longitude ?? ''));
        const address = typeof blob === 'object' && blob
          ? [blob.street, blob.city, blob.state, blob.postalCode].filter(Boolean).join(', ')
          : undefined;
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          return (
            <div>
              {link}
              <LocationMapPreview lat={lat} lng={lng} address={address} className="mt-2" />
            </div>
          );
        }
      }
    }

    if (route) {
      return (
        <Link href={`/${route}/${value}`} className="text-brand-navy hover:underline underline-offset-2">
          {displayLabel}
        </Link>
      );
    }
    return displayLabel;
  }

  // TextArea — preserve line breaks
  if (fieldType === 'TextArea' && typeof value === 'string') {
    return <span className="whitespace-pre-wrap">{value}</span>;
  }

  // CompositeText (e.g. Name)
  if (fieldType === 'CompositeText' && typeof value === 'object') {
    const keys = Object.keys(value);
    const salutation =
      value.salutation ||
      keys.find((k) => k.toLowerCase().includes('salutation')) &&
        value[keys.find((k) => k.toLowerCase().includes('salutation'))!];
    const firstName =
      value.firstName ||
      keys.find((k) => k.toLowerCase().includes('firstname')) &&
        value[keys.find((k) => k.toLowerCase().includes('firstname'))!];
    const lastName =
      value.lastName ||
      keys.find((k) => k.toLowerCase().includes('lastname')) &&
        value[keys.find((k) => k.toLowerCase().includes('lastname'))!];
    const parts = [salutation, firstName, lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : '-';
  }

  // Email
  if (fieldType === 'Email') {
    return (
      <a href={`mailto:${value}`} className="text-brand-navy hover:underline underline-offset-2">
        {value}
      </a>
    );
  }

  // Phone
  if (fieldType === 'Phone') {
    return (
      <a href={`tel:${value}`} className="text-brand-navy hover:underline underline-offset-2">
        {value}
      </a>
    );
  }

  // URL
  if (fieldType === 'URL') {
    const href = fieldDef?.staticUrl || value;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:underline underline-offset-2">
        {fieldDef?.staticUrl || value}
      </a>
    );
  }

  // Checkbox
  if (fieldType === 'Checkbox') {
    return value ? 'Yes' : 'No';
  }

  // PicklistText
  if (fieldType === 'PicklistText' && typeof value === 'object' && value !== null) {
    const parts = [value.picklist, value.text].filter(Boolean);
    return parts.length > 0 ? parts.join(' — ') : '-';
  }

  // PicklistLookup — composite: picklist selection + lookup record
  if (fieldType === 'PicklistLookup' && typeof value === 'object' && value !== null) {
    const lookupTarget = fieldDef?.lookupObject;
    const picklistPart = value.picklist || '';
    let lookupPart: React.ReactNode = '';
    if (value.lookup && lookupTarget) {
      const route = LOOKUP_ROUTE_MAP[lookupTarget];
      const displayLabel = resolveLookupDisplayName(value.lookup, lookupTarget);
      lookupPart = route ? (
        <Link href={`/${route}/${value.lookup}`} className="text-brand-navy hover:underline underline-offset-2">
          {displayLabel}
        </Link>
      ) : displayLabel;
    }
    if (!picklistPart && !lookupPart) return '-';
    return (
      <span className="inline-flex items-center gap-1">
        {picklistPart}{picklistPart && lookupPart ? ' — ' : ''}{lookupPart}
      </span>
    );
  }

  // Address (object) — show map preview when lat/lng are available
  if (fieldType === 'Address' && typeof value === 'object') {
    const parts = [value.street, value.city, value.state, value.postalCode, value.country].filter(Boolean);
    const addressText = parts.length > 0 ? parts.join(', ') : '-';
    const lat = Number(value.lat);
    const lng = Number(value.lng);
    if (!compact && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      return (
        <div className="space-y-2">
          <span>{addressText}</span>
          <LocationMapPreview lat={lat} lng={lng} address={addressText !== '-' ? addressText : undefined} />
        </div>
      );
    }
    return addressText;
  }

  // Date — locale-aware formatting
  if (fieldType === 'Date' && typeof value === 'string') {
    const d = new Date(value + (value.includes('T') ? '' : 'T00:00:00'));
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }).format(d);
    }
  }

  // DateTime — locale-aware formatting
  if (fieldType === 'DateTime' && typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
    }
  }

  return formatFieldValue(value, fieldType, fieldDef?.lookupObject);
}

// ── MemoizedFieldValue ────────────────────────────────────────────────
/**
 * A memoized wrapper component around `renderValue`. Re-renders only when
 * one of the inputs changes, avoiding expensive re-computation of JSON
 * parsing, date formatting, and lookup resolution on every parent render.
 */
interface MemoizedFieldValueProps {
  apiName: string;
  rawValue: any;
  fieldDef: FieldDef | undefined;
  record: Record<string, any> | null;
  isLookupLoaded: boolean;
  compact?: boolean;
  objectApiName?: string;
}

function MemoizedFieldValueInner({
  apiName,
  rawValue,
  fieldDef,
  record,
  isLookupLoaded,
  compact,
  objectApiName,
}: MemoizedFieldValueProps) {
  const rendered = React.useMemo(
    () => renderValue(apiName, rawValue, fieldDef, record, isLookupLoaded, compact, objectApiName),
    [apiName, rawValue, fieldDef, record, isLookupLoaded, compact, objectApiName],
  );
  return <>{rendered}</>;
}

export const MemoizedFieldValue = React.memo(MemoizedFieldValueInner);
