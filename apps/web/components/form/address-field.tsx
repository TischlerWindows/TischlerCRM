'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { FieldDef } from '@/lib/schema';
import AddressAutocomplete from '@/components/address-autocomplete';

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
  const addressValue = value || {};

  return (
    <div className="space-y-2 border border-gray-300 rounded-lg p-3">
      {!disabled && (
        <AddressAutocomplete
          disabled={disabled}
          placeholder="Search for an address..."
          onAddressSelected={(addr) => {
            onChange({
              ...addressValue,
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
        value={addressValue.street || ''}
        onChange={(e) => onChange({ ...addressValue, street: e.target.value })}
        disabled={disabled}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="City"
          value={addressValue.city || ''}
          onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
          disabled={disabled}
        />
        <Input
          placeholder="State/Province"
          value={addressValue.state || ''}
          onChange={(e) => onChange({ ...addressValue, state: e.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="Postal Code"
          value={addressValue.postalCode || ''}
          onChange={(e) =>
            onChange({ ...addressValue, postalCode: e.target.value })
          }
          disabled={disabled}
        />
        <Input
          placeholder="Country"
          value={addressValue.country || ''}
          onChange={(e) =>
            onChange({ ...addressValue, country: e.target.value })
          }
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
