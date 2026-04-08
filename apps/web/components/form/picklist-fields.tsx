'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FieldDef } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { evaluateVisibility, VisibilityContext } from '@/lib/field-visibility';

// ── PicklistTextDropdown ─────────────────────────────────────────────
// Custom dropdown for PicklistText / PicklistLookup that allows the
// selected value to wrap (unlike a native <select>).

export function PicklistTextDropdown({
  options,
  value,
  onChange,
  disabled,
  colors,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  colors?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="w-1/2 min-w-0 relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'w-full min-h-[2.5rem] px-3 py-2 text-left border border-gray-300 rounded-lg bg-white',
          'focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent focus:outline-none',
          'flex items-start justify-between gap-1',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-70',
        )}
      >
        <span className="break-words whitespace-normal flex-1 flex items-center gap-2">
          {value ? (
            <span
              className="px-2 py-0.5 rounded text-sm"
              style={colors?.[value] ? { backgroundColor: colors[value] + '33', color: colors[value] } : undefined}
            >
              {value}
            </span>
          ) : (
            <span className="text-gray-500">-- Select --</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div
            className={cn(
              'px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-500',
              !value && 'bg-blue-50',
            )}
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
          >
            -- Select --
          </div>
          {options.map((option) => (
            <div
              key={option}
              className={cn(
                'px-3 py-2 cursor-pointer hover:bg-gray-100 break-words whitespace-normal flex items-center gap-2',
                value === option && 'bg-blue-50 font-medium',
              )}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {colors?.[option] ? (
                <span
                  className="px-2 py-0.5 rounded text-sm"
                  style={{ backgroundColor: colors[option] + '33', color: colors[option] }}
                >
                  {option}
                </span>
              ) : (
                <span>{option}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Filter picklist values using picklistDependencies rules.
 * Only values whose dependency conditions are met (or values not governed
 * by any rule) are returned.
 */
export function filterPicklistValues(
  values: string[],
  fieldDef: FieldDef,
  formData: Record<string, any>,
  visibilityCtx: VisibilityContext,
): string[] {
  const rules = fieldDef.picklistDependencies;
  if (!rules || rules.length === 0) return values;

  // Collect all values that are governed by at least one rule
  const governedValues = new Set<string>();
  rules.forEach((r) => r.values.forEach((v) => governedValues.add(v)));

  return values.filter((val) => {
    // If no rule mentions this value, always show it
    if (!governedValues.has(val)) return true;
    // Show if ANY rule containing this value has all its conditions met
    return rules.some(
      (r) =>
        r.values.includes(val) &&
        evaluateVisibility(r.conditions, formData, visibilityCtx),
    );
  });
}

// ── Picklist input ──────────────────────────────────────────────────

export function PicklistInput({
  fieldDef,
  value,
  onChange,
  disabled,
  error,
  formData,
  visibilityCtx,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  error?: string;
  formData: Record<string, any>;
  visibilityCtx: VisibilityContext;
}) {
  const options = filterPicklistValues(
    fieldDef.picklistValues || [],
    fieldDef,
    formData,
    visibilityCtx,
  );
  const colors = (fieldDef as any).picklistColors as Record<string, string> | undefined;
  const hasColors = colors && Object.keys(colors).length > 0;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // If no colors are configured, use a native select for simplicity
  if (!hasColors) {
    return (
      <select
        id={fieldDef.apiName}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent',
          error && 'border-red-500',
        )}
      >
        <option value="">-- Select --</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'w-full min-h-[2.5rem] px-3 py-2 text-left border rounded-lg bg-white',
          'focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent focus:outline-none',
          'flex items-center justify-between gap-2',
          error ? 'border-red-500' : 'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-70',
        )}
      >
        <span className="flex items-center gap-2 flex-1 min-w-0">
          {value ? (
            <span
              className="px-2 py-0.5 rounded text-sm truncate"
              style={colors[value] ? { backgroundColor: colors[value] + '33', color: colors[value] } : undefined}
            >
              {value}
            </span>
          ) : (
            <span className="text-gray-500 truncate">-- Select --</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div
            className={cn(
              'px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-500',
              !value && 'bg-blue-50',
            )}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            -- Select --
          </div>
          {options.map((option) => (
            <div
              key={option}
              className={cn(
                'px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2',
                value === option && 'bg-blue-50 font-medium',
              )}
              onClick={() => { onChange(option); setOpen(false); }}
            >
              <span
                className="px-2 py-0.5 rounded text-sm"
                style={colors[option] ? { backgroundColor: colors[option] + '33', color: colors[option] } : undefined}
              >
                {option}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MultiPicklist input ─────────────────────────────────────────────

export function MultiPicklistInput({
  fieldDef,
  value,
  onChange,
  disabled,
  formData,
  visibilityCtx,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: string) => void;
  disabled?: boolean;
  formData: Record<string, any>;
  visibilityCtx: VisibilityContext;
}) {
  const options = filterPicklistValues(
    fieldDef.picklistValues || [],
    fieldDef,
    formData,
    visibilityCtx,
  );
  const colors = (fieldDef as any).picklistColors as Record<string, string> | undefined;
  const selectedValues: string[] = value
    ? value.split(';').map((v: string) => v.trim()).filter(Boolean)
    : [];

  return (
    <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto">
      {options.map((option) => (
        <div key={option} className="flex items-center space-x-2 py-1">
          <input
            type="checkbox"
            id={`${fieldDef.apiName}-${option}`}
            checked={selectedValues.includes(option)}
            onChange={(e) => {
              let newValues = [...selectedValues];
              if (e.target.checked) {
                newValues.push(option);
              } else {
                newValues = newValues.filter((v) => v !== option);
              }
              onChange(newValues.join(';'));
            }}
            disabled={disabled}
            className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
          />
          {colors?.[option] ? (
            <label
              htmlFor={`${fieldDef.apiName}-${option}`}
              className="text-sm px-2 py-0.5 rounded cursor-pointer"
              style={{ backgroundColor: colors[option] + '33', color: colors[option] }}
            >
              {option}
            </label>
          ) : (
            <label htmlFor={`${fieldDef.apiName}-${option}`} className="text-sm">
              {option}
            </label>
          )}
        </div>
      ))}
    </div>
  );
}

// ── PicklistText input ──────────────────────────────────────────────

export function PicklistTextInput({
  fieldDef,
  value,
  onChange,
  disabled,
  formData,
  visibilityCtx,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
  disabled?: boolean;
  formData: Record<string, any>;
  visibilityCtx: VisibilityContext;
}) {
  const options = filterPicklistValues(
    fieldDef.picklistValues || [],
    fieldDef,
    formData,
    visibilityCtx,
  );
  const ptValue =
    typeof value === 'object' && value !== null
      ? value
      : { picklist: '', text: '' };
  const ptPosition = (fieldDef as any).picklistPosition || 'left';

  const colors = (fieldDef as any).picklistColors as Record<string, string> | undefined;

  const picklistSelect = (
    <PicklistTextDropdown
      options={options}
      value={ptValue.picklist || ''}
      onChange={(val) => onChange({ ...ptValue, picklist: val })}
      disabled={disabled}
      colors={colors}
    />
  );
  const textInput = (
    <Input
      value={ptValue.text || ''}
      onChange={(e) => onChange({ ...ptValue, text: e.target.value })}
      disabled={disabled}
      placeholder="Enter text"
      className="w-1/2 min-w-0"
    />
  );

  return (
    <div className="flex gap-2 items-start">
      {ptPosition === 'left' ? (
        <>
          {picklistSelect}
          {textInput}
        </>
      ) : (
        <>
          {textInput}
          {picklistSelect}
        </>
      )}
    </div>
  );
}
