'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { FieldDef, ObjectDef } from '@/lib/schema';
import { cn, resolveLookupDisplayName } from '@/lib/utils';
import LocationMapPreview from '@/components/location-map-preview';

// ── getRecordLabel ───────────────────────────────────────────────────
// Derives a human-readable label from a flattened lookup record.

export function getRecordLabel(record: any): string {
  if (!record) return '';

  // Handle name object (Contact name with salutation, firstName, lastName)
  if (record.name && typeof record.name === 'object') {
    const nameObj = record.name;
    const nameParts = [
      nameObj.salutation || nameObj.Contact__name_salutation,
      nameObj.firstName || nameObj.Contact__name_firstName,
      nameObj.lastName || nameObj.Contact__name_lastName,
    ].filter(Boolean);
    if (nameParts.length > 0) return nameParts.join(' ');
  }

  // Handle simple name string
  if (record.name && typeof record.name === 'string') return record.name;

  if (record.title) return record.title;

  // Account name - check multiple variations
  if (record.accountName) return record.accountName;
  if (record.Account__accountName) return record.Account__accountName;

  // Property number
  if (record.propertyNumber) return record.propertyNumber;
  if (record.Property__propertyNumber) return record.Property__propertyNumber;

  // Account number as fallback for accounts
  if (record.accountNumber) return record.accountNumber;

  // Lead: show just lead number as label (contactName goes in subtext)
  const leadNum = record.leadNumber || record.Lead__leadNumber;
  if (leadNum) return leadNum;

  // Contact names
  if (record.firstName || record.lastName) {
    return `${record.firstName || ''} ${record.lastName || ''}`.trim();
  }
  if (record.email) return record.email;

  // Opportunity: show just opportunity number as label (name goes in subtext)
  const oppNum = record.opportunityNumber || record.Opportunity__opportunityNumber;
  if (oppNum) return oppNum;
  if (record.projectNumber) return record.projectNumber;
  if (record.quoteNumber) return record.quoteNumber;
  if (record.serviceNumber) return record.serviceNumber;
  if (record.installationNumber) return record.installationNumber;
  if (record.productName) return record.productName;

  // Handle address - could be string or object
  if (record.address) {
    if (typeof record.address === 'object') {
      const addrParts = [
        record.address.street,
        record.address.city,
        record.address.state,
      ].filter(Boolean);
      if (addrParts.length > 0) return addrParts.join(', ');
    } else {
      return record.address;
    }
  }

  // Search for prefixed field names as last resort
  const keys = Object.keys(record);
  const firstNameKey = keys.find((key) =>
    key.toLowerCase().endsWith('__firstname'),
  );
  const lastNameKey = keys.find((key) =>
    key.toLowerCase().endsWith('__lastname'),
  );
  if (firstNameKey || lastNameKey) {
    return `${record[firstNameKey || ''] || ''} ${record[lastNameKey || ''] || ''}`.trim();
  }
  const nameKey = keys.find((key) => key.toLowerCase().endsWith('__name'));
  if (nameKey && record[nameKey]) {
    const nameVal = record[nameKey];
    if (typeof nameVal === 'object' && nameVal !== null) {
      // CompositeText: extract display text from the object
      const nameKeys = Object.keys(nameVal);
      const findVal = (pattern: string) => {
        const k = nameKeys.find((nk) => nk.toLowerCase().includes(pattern));
        return k ? nameVal[k] : undefined;
      };
      const parts = [
        nameVal.salutation || findVal('salutation'),
        nameVal.firstName || findVal('firstname'),
        nameVal.lastName || findVal('lastname'),
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
      // Fallback: join all string values
      const allStringVals = Object.values(nameVal).filter(
        (v) => typeof v === 'string' && v,
      );
      if (allStringVals.length > 0) return allStringVals.join(' ');
    }
    return String(nameVal);
  }
  const accountKey = keys.find((key) =>
    key.toLowerCase().endsWith('__accountname'),
  );
  if (accountKey && record[accountKey]) return record[accountKey];
  const propertyKey = keys.find((key) =>
    key.toLowerCase().endsWith('__propertynumber'),
  );
  if (propertyKey && record[propertyKey]) return record[propertyKey];
  const emailKey = keys.find((key) =>
    key.toLowerCase().endsWith('__email'),
  );
  if (emailKey && record[emailKey]) return record[emailKey];

  // Final fallback - use any "name" or "number" field
  const anyNameField = keys.find(
    (key) => key.toLowerCase().includes('name') && record[key],
  );
  if (anyNameField && record[anyNameField]) {
    const val = record[anyNameField];
    if (typeof val === 'object' && val !== null) {
      const objKeys = Object.keys(val);
      const findVal = (pattern: string) => {
        const k = objKeys.find((nk) => nk.toLowerCase().includes(pattern));
        return k ? val[k] : undefined;
      };
      const parts = [
        val.salutation || findVal('salutation'),
        val.firstName || findVal('firstname'),
        val.lastName || findVal('lastname'),
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
      const allStringVals = Object.values(val).filter(
        (v) => typeof v === 'string' && v,
      );
      if (allStringVals.length > 0) return (allStringVals as string[]).join(' ');
    }
    return String(val);
  }
  const anyNumberField = keys.find(
    (key) => key.toLowerCase().includes('number') && record[key],
  );
  if (anyNumberField && record[anyNumberField])
    return String(record[anyNumberField]);

  return String(record.id || 'Record');
}

// ── getRecordSubtext ─────────────────────────────────────────────────
// Returns an optional secondary line for lookup dropdown items.

export function getRecordSubtext(record: any): string {
  if (!record) return '';

  // Property: show address as subtext.
  // Check both the legacy Address field (address / Property__address) and the
  // newer LocationSearch field (address_search / Property__address_search).
  const addrBlob =
    record.address_search ||
    record.Property__address_search ||
    // Also handle any prefixed __address_search key
    (() => {
      const k = Object.keys(record).find(
        (key) => key.toLowerCase().endsWith('__address_search') || key.toLowerCase() === 'address_search',
      );
      return k ? record[k] : undefined;
    })();
  const addrLegacy =
    record.address ||
    record.Property__address ||
    (() => {
      const k = Object.keys(record).find(
        (key) => (key.toLowerCase().endsWith('__address') || key.toLowerCase() === 'address') &&
                 !key.toLowerCase().includes('_search'),
      );
      return k ? record[k] : undefined;
    })();
  const addr = addrBlob || addrLegacy;
  if (addr) {
    if (typeof addr === 'object') {
      const parts = [addr.street, addr.city, addr.state, addr.zip || addr.postalCode].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    } else if (typeof addr === 'string') {
      return addr;
    }
  }

  // Contact: show email as subtext
  const email = record.email || record.Contact__email;
  if (email && typeof email === 'string') return email;

  // Lead: show contactName as subtext
  const leadContactName = record.contactName || record.Lead__contactName;
  if (leadContactName) return leadContactName;
  const leadFn = record.firstName || record.Lead__firstName || '';
  const leadLn = record.lastName || record.Lead__lastName || '';
  const rawLeadLn = leadLn && leadLn !== 'N/A' ? leadLn : '';
  const leadFullName = `${leadFn} ${rawLeadLn}`.trim();
  if (leadFullName) return leadFullName;

  // Opportunity: show opportunity name as subtext
  const oppName = record.opportunityName || record.Opportunity__opportunityName;
  if (oppName) return oppName;

  // Account: show account number as subtext
  if (record.accountNumber || record.Account__accountNumber) {
    return record.accountNumber || record.Account__accountNumber;
  }

  return '';
}

// ── getLookupTargetApi ──────────────────────────────────────────────

export function getLookupTargetApi(
  fieldDef: FieldDef,
  objectFields: FieldDef[],
  schemaObjects?: ObjectDef[],
): string | undefined {
  const relatedObject = (fieldDef as any).relatedObject as string | undefined;
  if (fieldDef.lookupObject) return fieldDef.lookupObject;
  if (fieldDef.relationship?.targetObject)
    return fieldDef.relationship.targetObject;
  if (relatedObject) return relatedObject;

  // Fallback: try to find from object.fields by apiName
  const objField = objectFields.find((f) => f.apiName === fieldDef.apiName);
  if (objField?.lookupObject) return objField.lookupObject;

  // Last resort: infer from apiName pattern (e.g., "ContactId" -> "Contact")
  if (fieldDef.apiName.endsWith('Id')) {
    const possibleTarget = fieldDef.apiName.slice(0, -2);
    const matchedObj = schemaObjects?.find(
      (o) => o.apiName === possibleTarget,
    );
    if (matchedObj) return matchedObj.apiName;
  }

  return undefined;
}

// ── LookupSearch component ──────────────────────────────────────────

export interface LookupSearchProps {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  error?: string;
  records: any[];
  lookupQuery: string;
  isActive: boolean;
  onQueryChange: (query: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onInlineCreate?: (targetApi: string) => void;
  schemaObjects?: ObjectDef[];
  /** When true, suppress the "-- None --" dropdown option. The clear control
   * provided by the parent (e.g. an X button on the bound row) is the user's
   * way to clear. Used by TeamMemberSlot to keep the dropdown feeling lighter. */
  hideNoneOption?: boolean;
}

export function LookupSearch({
  fieldDef,
  value,
  onChange,
  disabled,
  error,
  records,
  lookupQuery,
  isActive,
  onQueryChange,
  onFocus,
  onBlur,
  onInlineCreate,
  schemaObjects,
  hideNoneOption,
}: LookupSearchProps) {
  const recordsArray = Array.isArray(records) ? records : [];
  const targetApi = getLookupTargetApi(
    fieldDef,
    [],
    schemaObjects,
  );
  const selectedRecord = value
    ? recordsArray.find((r) => String(r.id) === String(value))
    : null;
  // When the local form cache hasn't loaded yet but a value is pre-filled,
  // fall back to the global lookup cache (populated by resolveLookupDisplayName).
  const selectedLabel = selectedRecord
    ? getRecordLabel(selectedRecord)
    : value && targetApi
    ? resolveLookupDisplayName(value, targetApi)
    : '';

  // Determine what to display:
  // - If lookup is active (user is typing), show the query
  // - If we have a locally-matched record, use its resolved label
  // - If the record isn't in the local cache yet, prefer the pre-filled lookupQuery
  //   (avoids showing a raw UUID when the cache hasn't loaded)
  // - Otherwise fall back to whatever resolveLookupDisplayName returned
  const displayValue = isActive
    ? lookupQuery
    : selectedRecord
    ? selectedLabel
    : lookupQuery || selectedLabel;

  const filteredRecords = recordsArray.filter((record) => {
    const label = getRecordLabel(record);
    const labelStr = typeof label === 'string' ? label : String(label || '');
    if (!labelStr) return true;
    const query = lookupQuery.toLowerCase();
    if (labelStr.toLowerCase().includes(query)) return true;
    const sub = getRecordSubtext(record);
    if (sub && sub.toLowerCase().includes(query)) return true;
    return Object.values(record).some(
      (val) => typeof val === 'string' && val.toLowerCase().includes(query),
    );
  });

  // Resolve lat/lng from a Property lookup record.
  // Priority: address_search blob (lat/lng keys) → top-level latitude/longitude
  // fields (either plain or prefixed) → any field whose value is numeric and
  // whose key ends with __lat / __lng.
  const resolvePropertyLatLng = (rec: any): { lat: number; lng: number } => {
    // 1. address_search blob (LocationSearch field stores {lat, lng} here)
    const blob =
      rec.address_search ??
      rec.Property__address_search ??
      (() => {
        const k = Object.keys(rec).find(
          (key) => key.toLowerCase().endsWith('__address_search') || key.toLowerCase() === 'address_search',
        );
        return k ? rec[k] : undefined;
      })();
    if (blob && typeof blob === 'object' && blob.lat != null && blob.lng != null) {
      const lat = parseFloat(String(blob.lat));
      const lng = parseFloat(String(blob.lng));
      if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
    }

    // 2. Top-level latitude/longitude (or any prefix variant)
    const latVal =
      rec.latitude ?? rec.Property__latitude ??
      (() => {
        const k = Object.keys(rec).find(
          (key) => key.toLowerCase().endsWith('__latitude') || key.toLowerCase() === 'latitude',
        );
        return k ? rec[k] : undefined;
      })();
    const lngVal =
      rec.longitude ?? rec.Property__longitude ??
      (() => {
        const k = Object.keys(rec).find(
          (key) => key.toLowerCase().endsWith('__longitude') || key.toLowerCase() === 'longitude',
        );
        return k ? rec[k] : undefined;
      })();
    const lat2 = parseFloat(String(latVal ?? ''));
    const lng2 = parseFloat(String(lngVal ?? ''));
    if (!isNaN(lat2) && !isNaN(lng2)) return { lat: lat2, lng: lng2 };

    // 3. Any field ending in __lat / __lng (mapped targetFields)
    const latKey = Object.keys(rec).find((k) => /(__lat|^lat)$/i.test(k));
    const lngKey = Object.keys(rec).find((k) => /(__lng|^lng)$/i.test(k));
    const lat3 = parseFloat(String(latKey ? rec[latKey] : ''));
    const lng3 = parseFloat(String(lngKey ? rec[lngKey] : ''));
    if (!isNaN(lat3) && !isNaN(lng3)) return { lat: lat3, lng: lng3 };

    return { lat: NaN, lng: NaN };
  };

  const { lat: propertyLat, lng: propertyLng } =
    targetApi === 'Property' && selectedRecord
      ? resolvePropertyLatLng(selectedRecord)
      : { lat: NaN, lng: NaN };
  const propertyAddress = targetApi === 'Property' && selectedRecord
    ? getRecordSubtext(selectedRecord) || undefined
    : undefined;
  const hasPropertyMap = !isNaN(propertyLat) && !isNaN(propertyLng) && propertyLat !== 0 && propertyLng !== 0;

  return (
    <>
    <div className="relative">
      <Input
        id={fieldDef.apiName}
        value={displayValue}
        placeholder={`Search ${fieldDef.relationshipName || targetApi || 'records'}...`}
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        className={cn(error && 'border-red-500')}
      />
      {isActive && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {!hideNoneOption && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                onQueryChange('');
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-500',
                !value && 'bg-blue-50',
              )}
            >
              -- None --
            </button>
          )}
          {filteredRecords.length > 0 ? (
            filteredRecords.slice(0, 20).map((record) => {
              const label = getRecordLabel(record);
              const displayLabel =
                typeof label === 'string' ? label : String(label || 'Record');
              return (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => {
                    onChange(record.id);
                    onQueryChange(displayLabel);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <div className="font-medium text-gray-900 truncate">
                    {displayLabel}
                  </div>
                  {(getRecordSubtext(record)) && (
                    <div className="text-xs text-gray-500 truncate">
                      {getRecordSubtext(record)}
                    </div>
                  )}
                </button>
              );
            })
          ) : lookupQuery ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              No matches found.
            </div>
          ) : null}
          {targetApi &&
            onInlineCreate &&
            (() => {
              const targetObj = schemaObjects?.find(
                (o) => o.apiName === targetApi,
              );
              const createLabel = targetObj?.label || targetApi;
              return (
                <button
                  type="button"
                  onClick={() => onInlineCreate(targetApi)}
                  className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-gray-100 rounded-b-lg"
                >
                  + Create new {createLabel}
                </button>
              );
            })()}
        </div>
      )}
    </div>
    {hasPropertyMap && !isActive && (
      <LocationMapPreview
        lat={propertyLat}
        lng={propertyLng}
        address={propertyAddress}
        className="mt-2"
      />
    )}
    </>
  );
}

// ── LookupUserSearch component ──────────────────────────────────────

export interface LookupUserSearchProps {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  error?: string;
  userRecords: any[];
  lookupQuery: string;
  isActive: boolean;
  onQueryChange: (query: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function LookupUserSearch({
  fieldDef,
  value,
  onChange,
  disabled,
  error,
  userRecords,
  lookupQuery,
  isActive,
  onQueryChange,
  onFocus,
  onBlur,
}: LookupUserSearchProps) {
  const selectedUser = value
    ? userRecords.find((u) => String(u.id) === String(value))
    : null;
  const selectedUserLabel = selectedUser
    ? selectedUser.name || selectedUser.email || ''
    : '';
  const userDisplayValue = isActive ? lookupQuery : selectedUserLabel;

  const filteredUsers = userRecords.filter((user) => {
    const query = lookupQuery.toLowerCase();
    if (!query) return true;
    const name = (user.name || '').toLowerCase();
    const email = (user.email || '').toLowerCase();
    const title = (user.title || '').toLowerCase();
    return (
      name.includes(query) || email.includes(query) || title.includes(query)
    );
  });

  return (
    <div className="relative">
      <Input
        id={fieldDef.apiName}
        value={userDisplayValue}
        placeholder="Search users..."
        onChange={(e) => onQueryChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={disabled}
        className={cn(error && 'border-red-500')}
      />
      {isActive && (
        <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange('');
              onQueryChange('');
            }}
            className={cn(
              'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-500',
              !value && 'bg-blue-50',
            )}
          >
            -- None --
          </button>
          {filteredUsers.length > 0 ? (
            filteredUsers.slice(0, 20).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  onChange(user.id);
                  onQueryChange(user.name || user.email);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <div className="font-medium text-gray-900 truncate">
                  {user.name || user.email}
                </div>
                <div className="text-xs text-gray-500">
                  {user.email}
                  {user.title ? ` \u00b7 ${user.title}` : ''}
                </div>
              </button>
            ))
          ) : lookupQuery ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              No users found.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
