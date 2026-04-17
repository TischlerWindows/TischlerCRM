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
  /** Called for each target field when an address is selected */
  onFieldChange: (fieldApiName: string, val: any) => void;
  formData: Record<string, any>;
  disabled?: boolean;
}) {
  const tf = fieldDef.targetFields || {};

  // Build a merged address object from every available data source so
  // we always show the most complete data regardless of storage format.
  //
  // Sources (checked in priority order):
  //  1. The field's own JSON blob  (address_search = {street, city, …})
  //  2. Dotted flat keys            (address_search.city = "Stone Ridge")
  //  3. Compound address object     (address = {lat, lng, street, …})
  //  4. Individual target-field cols (city, state, zipCode – BUT NOT the
  //     'address' col because it often stores a full formatted string)
  const blob = toAddressObject(value);
  const fieldBase = fieldDef.apiName.replace(/^[A-Za-z]+__/, '');

  // Merge dotted keys (e.g. address_search.city → city)
  for (const key of Object.keys(formData)) {
    if (key.startsWith(fieldBase + '.')) {
      const sub = key.slice(fieldBase.length + 1);
      if (sub && !blob[sub] && formData[key] != null && formData[key] !== '') {
        blob[sub] = formData[key];
      }
    }
  }

  // Check if the street target field holds a compound address object
  const streetTargetRaw = tf.street
    ? (formData[tf.street] ?? formData[tf.street.replace(/^[A-Za-z]+__/, '')])
    : undefined;
  const compoundAddr = (typeof streetTargetRaw === 'object' && streetTargetRaw) ? streetTargetRaw as Record<string, any> : {};
  for (const [k, v] of Object.entries(compoundAddr)) {
    if (!blob[k] && v != null && v !== '') blob[k] = v;
  }

  // Fill remaining gaps from individual target-field columns (skip the
  // street target — "address" — because it collides with the formatted string)
  const safeKeys: Array<[string, string]> = [
    ['city', tf.city ?? ''],
    ['state', tf.state ?? ''],
    ['postalCode', tf.postalCode ?? ''],
    ['country', tf.country ?? ''],
    ['lat', tf.lat ?? ''],
    ['lng', tf.lng ?? ''],
  ];
  for (const [jsonKey, tfKey] of safeKeys) {
    if (!blob[jsonKey] && tfKey) {
      const v = formData[tfKey] ?? formData[tfKey.replace(/^[A-Za-z]+__/, '')];
      if (v != null && v !== '' && typeof v !== 'object') blob[jsonKey] = v;
    }
  }

  const street = blob.street ? String(blob.street) : '';
  const city = blob.city ? String(blob.city) : '';
  const state = blob.state ? String(blob.state) : '';
  const postalCode = blob.postalCode ? String(blob.postalCode) : '';
  const country = blob.country ? String(blob.country) : '';

  // Always build the search-bar display from current sub-field values so
  // editing or clearing a sub-field immediately updates the search bar.
  const locationValue = [street, city, state, postalCode].filter(Boolean).join(', ');

  // When a sub-field is edited, update the target field AND the field's
  // own JSON value so the search bar and saved data stay in sync.
  const handleSubField = (targetKey: string | undefined, jsonKey: string, val: string) => {
    if (targetKey) onFieldChange(targetKey, val);
    const updated = { ...blob, [jsonKey]: val };
    onChange(updated);
  };

  return (
    <div className="space-y-2 border border-gray-300 rounded-lg p-3">
      {!disabled && (
        <AddressAutocomplete
          disabled={disabled}
          placeholder="Search for an address..."
          value={locationValue}
          onAddressSelected={(addr) => {
            if (tf.street) onFieldChange(tf.street, addr.street);
            if (tf.city) onFieldChange(tf.city, addr.city);
            if (tf.state) onFieldChange(tf.state, addr.state);
            if (tf.postalCode) onFieldChange(tf.postalCode, addr.postalCode);
            if (tf.country) onFieldChange(tf.country, addr.country);
            if (tf.lat) onFieldChange(tf.lat, String(addr.lat));
            if (tf.lng) onFieldChange(tf.lng, String(addr.lng));
            // Keep the JSON blob in sync
            onChange({
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
      <Input
        placeholder="Street"
        value={street}
        onChange={(e) => handleSubField(tf.street, 'street', e.target.value)}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={city}
          onChange={(e) => handleSubField(tf.city, 'city', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="State/Province"
          value={state}
          onChange={(e) => handleSubField(tf.state, 'state', e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Postal Code"
          value={postalCode}
          onChange={(e) => handleSubField(tf.postalCode, 'postalCode', e.target.value)}
          disabled={disabled}
        />
        <Input
          placeholder="Country"
          value={country}
          onChange={(e) => handleSubField(tf.country, 'country', e.target.value)}
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
