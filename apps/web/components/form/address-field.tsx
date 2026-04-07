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
  // Build display value from saved target fields if the field's own value is empty
  let locationValue = value as string | undefined;
  if (!locationValue && fieldDef.targetFields) {
    const tf = fieldDef.targetFields;
    const parts = [
      formData[tf.street ?? ''],
      formData[tf.city ?? ''],
      formData[tf.state ?? ''],
      formData[tf.postalCode ?? ''],
      formData[tf.country ?? ''],
    ].filter(Boolean);
    if (parts.length > 0) locationValue = parts.join(', ');
  }

  return (
    <AddressAutocomplete
      disabled={disabled}
      value={locationValue || ''}
      onAddressSelected={(addr) => {
        const targets = fieldDef.targetFields || {};
        if (targets.street) onFieldChange(targets.street, addr.street);
        if (targets.city) onFieldChange(targets.city, addr.city);
        if (targets.state) onFieldChange(targets.state, addr.state);
        if (targets.postalCode)
          onFieldChange(targets.postalCode, addr.postalCode);
        if (targets.country) onFieldChange(targets.country, addr.country);
        if (targets.lat) onFieldChange(targets.lat, String(addr.lat));
        if (targets.lng) onFieldChange(targets.lng, String(addr.lng));
        // Persist the formatted address in the field's own value
        onChange(addr.formattedAddress);
      }}
    />
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
