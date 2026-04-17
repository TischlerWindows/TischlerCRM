'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { FieldDef } from '@/lib/schema';
import AddressAutocomplete from '@/components/address-autocomplete';

// ── helpers ─────────────────────────────────────────────────────────

/** Normalise any value into a plain address object. */
function toAddressObject(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

function addrKey(a: Record<string, any>): string {
  return [a.street, a.city, a.state, a.postalCode, a.country, a.lat, a.lng]
    .map((v) => v ?? '')
    .join('|');
}

// ── Address field input ─────────────────────────────────────────────

export function AddressInput({
  fieldDef,
  value,
  onChange,
  disabled,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
}) {
  // Use LOCAL state so sub-field edits are always immediately visible,
  // regardless of how fast the parent re-renders / propagates new props.
  const [local, setLocal] = useState<Record<string, any>>(() => toAddressObject(value));

  // Sync from parent when the parent value changes meaningfully
  // (e.g. after autocomplete selection or when the dialog first opens)
  useEffect(() => {
    const incoming = toAddressObject(value);
    if (addrKey(incoming) !== addrKey(local)) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSubField = useCallback(
    (field: string, fieldValue: string) => {
      setLocal((prev) => {
        const next = { ...prev, [field]: fieldValue };
        onChange(next);
        return next;
      });
    },
    [onChange],
  );

  const handleAutocomplete = useCallback(
    (addr: any) => {
      const next = {
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        lat: addr.lat,
        lng: addr.lng,
      };
      setLocal(next);
      onChange(next);
    },
    [onChange],
  );

  // Build display string from current sub-field values so the search
  // bar always reflects the actual data (search is only for lookup).
  const addressDisplay = [local.street, local.city, local.state, local.postalCode, local.country].filter(Boolean).join(', ');

  return (
    <div className="space-y-2 border border-gray-300 rounded-lg p-3">
      {!disabled && (
        <AddressAutocomplete
          disabled={disabled}
          placeholder="Search for an address..."
          value={addressDisplay}
          onAddressSelected={handleAutocomplete}
        />
      )}
      <Input
        placeholder="Street"
        value={local.street || ''}
        onChange={(e) => handleSubField('street', e.target.value)}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={local.city || ''}
          onChange={(e) => handleSubField('city', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="State/Province"
          value={local.state || ''}
          onChange={(e) => handleSubField('state', e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Postal Code"
          value={local.postalCode || ''}
          onChange={(e) => handleSubField('postalCode', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Country"
          value={local.country || ''}
          onChange={(e) => handleSubField('country', e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ── LocationSearch field input ───────────────────────────────────────
// Works identically to AddressInput (local state, single JSON blob) but
// ALSO writes each sub-field to its mapped target field so downstream
// consumers (Dropbox folder naming, etc.) stay in sync.

/** Merge all scattered data sources into one address object. */
function buildLocationBlob(
  value: any,
  fieldApiName: string,
  formData: Record<string, any>,
  targetFields: Record<string, string>,
): Record<string, any> {
  const blob = toAddressObject(value);
  const fieldBase = fieldApiName.replace(/^[A-Za-z]+__/, '');

  // 1. Dotted flat keys  (e.g. address_search.city → city)
  for (const key of Object.keys(formData)) {
    if (key.startsWith(fieldBase + '.')) {
      const sub = key.slice(fieldBase.length + 1);
      if (sub && !blob[sub] && formData[key] != null && formData[key] !== '') {
        blob[sub] = formData[key];
      }
    }
  }

  // 2. Compound address object at the street target (legacy records
  //    store {lat, lng, street, …} in the 'address' key)
  const streetKey = targetFields.street;
  if (streetKey) {
    const raw = formData[streetKey] ?? formData[streetKey.replace(/^[A-Za-z]+__/, '')];
    if (typeof raw === 'object' && raw) {
      for (const [k, v] of Object.entries(raw as Record<string, any>)) {
        if (!blob[k] && v != null && v !== '') blob[k] = v;
      }
    }
  }

  // 3. Individual target-field columns (skip street – it collides with
  //    the full formatted address string that lives in 'address')
  for (const [jsonKey, tfKey] of [
    ['city', targetFields.city],
    ['state', targetFields.state],
    ['postalCode', targetFields.postalCode],
    ['country', targetFields.country],
    ['lat', targetFields.lat],
    ['lng', targetFields.lng],
  ] as const) {
    if (!blob[jsonKey] && tfKey) {
      const v = formData[tfKey] ?? formData[tfKey.replace(/^[A-Za-z]+__/, '')];
      if (v != null && v !== '' && typeof v !== 'object') blob[jsonKey] = v;
    }
  }

  return blob;
}

export function LocationSearchInput({
  fieldDef,
  value,
  onChange,
  onFieldChange,
  formData,
  disabled,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  onFieldChange: (fieldApiName: string, val: any) => void;
  formData: Record<string, any>;
  disabled?: boolean;
}) {
  const tf = fieldDef.targetFields || {};

  // ── LOCAL STATE (mirrors AddressInput pattern exactly) ──
  const [local, setLocal] = useState<Record<string, any>>(() =>
    buildLocationBlob(value, fieldDef.apiName, formData, tf),
  );

  // Sync from parent when the parent value changes meaningfully
  useEffect(() => {
    const incoming = buildLocationBlob(value, fieldDef.apiName, formData, tf);
    if (addrKey(incoming) !== addrKey(local)) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Push a complete blob to parent + individual target fields
  const pushAll = useCallback(
    (next: Record<string, any>) => {
      onChange(next);
      if (tf.street) onFieldChange(tf.street, next.street ?? '');
      if (tf.city) onFieldChange(tf.city, next.city ?? '');
      if (tf.state) onFieldChange(tf.state, next.state ?? '');
      if (tf.postalCode) onFieldChange(tf.postalCode, next.postalCode ?? '');
      if (tf.country) onFieldChange(tf.country, next.country ?? '');
      if (tf.lat) onFieldChange(tf.lat, next.lat != null ? String(next.lat) : '');
      if (tf.lng) onFieldChange(tf.lng, next.lng != null ? String(next.lng) : '');
    },
    [onChange, onFieldChange, tf],
  );

  const handleSubField = useCallback(
    (field: string, fieldValue: string) => {
      setLocal((prev) => {
        const next = { ...prev, [field]: fieldValue };
        pushAll(next);
        return next;
      });
    },
    [pushAll],
  );

  const handleAutocomplete = useCallback(
    (addr: any) => {
      const next = {
        street: addr.street,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        lat: addr.lat,
        lng: addr.lng,
      };
      setLocal(next);
      pushAll(next);
    },
    [pushAll],
  );

  // Build display string from current local state
  const addressDisplay = [local.street, local.city, local.state, local.postalCode, local.country]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-2 border border-gray-300 rounded-lg p-3">
      {!disabled && (
        <AddressAutocomplete
          disabled={disabled}
          placeholder="Search for an address..."
          value={addressDisplay}
          onAddressSelected={handleAutocomplete}
        />
      )}
      <Input
        placeholder="Street"
        value={local.street || ''}
        onChange={(e) => handleSubField('street', e.target.value)}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={local.city || ''}
          onChange={(e) => handleSubField('city', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="State/Province"
          value={local.state || ''}
          onChange={(e) => handleSubField('state', e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Postal Code"
          value={local.postalCode || ''}
          onChange={(e) => handleSubField('postalCode', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Country"
          value={local.country || ''}
          onChange={(e) => handleSubField('country', e.target.value)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

// ── Geolocation field input ─────────────────────────────────────────

export function GeolocationInput({
  fieldDef,
  value,
  onChange,
  disabled,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
}) {
  const geoValue = value || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <Input
        placeholder="Latitude"
        type="number"
        step="any"
        value={geoValue.latitude || ''}
        onChange={(e) =>
          onChange({ ...geoValue, latitude: e.target.value })
        }
        disabled={disabled}
      />
      <Input
        placeholder="Longitude"
        type="number"
        step="any"
        value={geoValue.longitude || ''}
        onChange={(e) =>
          onChange({ ...geoValue, longitude: e.target.value })
        }
        disabled={disabled}
      />
    </div>
  );
}
