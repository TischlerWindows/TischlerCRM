'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { FieldDef } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { evaluateVisibility, VisibilityContext } from '@/lib/field-visibility';

// ── Default alternating row colors ──────────────────────────────────
const ALT_COLOR_A = '#ffffff';   // white
const ALT_COLOR_B = '#dbeafe';   // light blue (tailwind blue-100)

function getOptionColor(
  option: string,
  index: number,
  customColors?: Record<string, string>,
): string {
  if (customColors?.[option]) return customColors[option];
  return index % 2 === 0 ? ALT_COLOR_A : ALT_COLOR_B;
}

/** Return black or white depending on perceived luminance of a hex color. */
function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Perceived luminance (ITU-R BT.709)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

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
        <span className="break-words whitespace-normal flex-1 text-sm">
          {value || <span className="text-gray-500">-- Select --</span>}
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
          {options.map((option, idx) => {
            const c = getOptionColor(option, idx, colors);
            const isWhite = c === ALT_COLOR_A;
            return (
              <div
                key={option}
                className={cn(
                  'px-3 py-2 cursor-pointer break-words whitespace-normal text-sm',
                  value === option && 'font-medium',
                  isWhite && 'hover:bg-gray-100',
                )}
                style={isWhite ? undefined : { backgroundColor: c, color: contrastText(c) }}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </div>
            );
          })}
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
        <span className="flex-1 min-w-0 text-sm truncate">
          {value || <span className="text-gray-500 truncate">-- Select --</span>}
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
          {options.map((option, idx) => {
            const c = getOptionColor(option, idx, colors);
            const isWhite = c === ALT_COLOR_A;
            return (
              <div
                key={option}
                className={cn(
                  'px-3 py-2 cursor-pointer text-sm',
                  value === option && 'font-medium',
                  isWhite && 'hover:bg-gray-100',
                )}
                style={isWhite ? undefined : { backgroundColor: c, color: contrastText(c) }}
                onClick={() => { onChange(option); setOpen(false); }}
              >
                {option}
              </div>
            );
          })}
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
      {options.map((option, idx) => {
        const c = getOptionColor(option, idx, colors);
        const isWhite = c === ALT_COLOR_A;
        return (
          <div
            key={option}
            className="flex items-center space-x-2 py-1 px-2 rounded"
            style={isWhite ? undefined : { backgroundColor: c, color: contrastText(c) }}
          >
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
            <label
              htmlFor={`${fieldDef.apiName}-${option}`}
              className="text-sm cursor-pointer"
            >
              {option}
            </label>
          </div>
        );
      })}
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

// ── DropdownWithCustomInput ─────────────────────────────────────────
// A dropdown with a built-in "Custom..." option. When "Custom..." is
// chosen, a free-text input appears beneath the dropdown so the user
// can type any value. The stored value is the typed text itself so
// data round-trips cleanly (no sentinel strings persisted).

export function DropdownWithCustomInput({
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

  // showCustom: true when the user is in free-text mode.
  // If the current value is not one of the predefined options (and isn't empty),
  // start in custom mode so existing custom values render correctly.
  const [showCustom, setShowCustom] = useState<boolean>(() =>
    !!value && !options.includes(value as string)
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep showCustom in sync if options change or value is reset externally
  useEffect(() => {
    if (!value) {
      setShowCustom(false);
    } else if (!options.includes(value as string)) {
      setShowCustom(true);
    }
  }, [value, options.join(',')]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectLabel = showCustom
    ? 'Custom...'
    : value || '';

  return (
    <div className="space-y-2">
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
          <span className={cn('flex-1 min-w-0 text-sm truncate', !selectLabel && 'text-gray-500')}>
            {selectLabel || <span className="text-gray-500">-- Select --</span>}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div
              className={cn('px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-500', !value && !showCustom && 'bg-blue-50')}
              onClick={() => { onChange(''); setShowCustom(false); setOpen(false); }}
            >
              -- Select --
            </div>
            {options.map((option, idx) => {
              const c = getOptionColor(option, idx, colors);
              const isWhite = c === ALT_COLOR_A;
              return (
                <div
                  key={option}
                  className={cn(
                    'px-3 py-2 cursor-pointer text-sm',
                    !showCustom && value === option && 'font-medium',
                    isWhite && 'hover:bg-gray-100',
                  )}
                  style={isWhite ? undefined : { backgroundColor: c, color: contrastText(c) }}
                  onClick={() => { onChange(option); setShowCustom(false); setOpen(false); }}
                >
                  {option}
                </div>
              );
            })}
            {/* Custom option always at the bottom */}
            <div
              className={cn(
                'px-3 py-2 cursor-pointer text-sm italic text-blue-600 hover:bg-blue-50 border-t border-gray-100',
                showCustom && 'font-medium bg-blue-50',
              )}
              onClick={() => {
                setShowCustom(true);
                setOpen(false);
                // Clear any previously-selected standard option so the text input starts empty
                if (!showCustom) onChange('');
                // Focus the text input on next tick
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
            >
              Custom...
            </div>
          </div>
        )}
      </div>
      {/* Free-text input — only shown when in custom mode */}
      {showCustom && (
        <input
          ref={inputRef}
          type="text"
          placeholder="Type custom value..."
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm',
            'focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent focus:outline-none',
            disabled && 'bg-gray-100 cursor-not-allowed opacity-70',
          )}
        />
      )}
    </div>
  );
}
