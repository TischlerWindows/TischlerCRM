'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { BodyEditor, type BodyEditorHandle } from './body-editor';
import { getOptionsForType } from '@/lib/product-type-options';

export interface DraftVariant {
  _key: string;
  matchValue: string;
  matchLabel: string;
  body: string;
  order: number;
  isActive: boolean;
}

let _variantKey = 0;
export function nextVariantKey(): string {
  return `vk_${++_variantKey}`;
}

export function emptyDraftVariant(order: number): DraftVariant {
  return { _key: nextVariantKey(), matchValue: '', matchLabel: '', body: '', order, isActive: true };
}

export function variantToDraft(v: { matchValue: string; matchLabel: string | null; body: string; order: number; isActive: boolean }): DraftVariant {
  return { _key: nextVariantKey(), matchValue: v.matchValue, matchLabel: v.matchLabel || '', body: v.body, order: v.order, isActive: v.isActive };
}

export function variantsPayload(variants: DraftVariant[]) {
  return variants.map((v, i) => ({
    matchValue: v.matchValue,
    matchLabel: v.matchLabel || null,
    body: v.body,
    order: i,
    isActive: v.isActive,
  }));
}

interface Props {
  variants: DraftVariant[];
  onChange: (variants: DraftVariant[]) => void;
  driverField: string;
  /** If provided, Match Value renders as a multi-select dropdown instead of free text. */
  matchOptions?: string[];
  /**
   * When driverField === 'productTypes', the available options per product type
   * from the current summary (Record<productTypeName, optionName[]>).
   * Used to populate the "Product Type Options" sub-dropdown.
   */
  productTypeOptionsMap?: Record<string, string[]>;
  /** Called when any variant body editor receives focus. */
  onFocus?: () => void;
}

// ── matchValue encoding helpers ────────────────────────────────────
// matchValue may encode an optional product-type-option filter after '||':
//   "Inswing GD,Inswing French GD||KFV RH,72mm Thick Sash"
// Parts before || → product type match values (comma-separated)
// Parts after  || → option filter (comma-separated); absent = no filter
function parseMatchValueParts(mv: string): { typePart: string; optionPart: string } {
  const idx = mv.indexOf('||');
  if (idx === -1) return { typePart: mv, optionPart: '' };
  return { typePart: mv.slice(0, idx), optionPart: mv.slice(idx + 2) };
}
function buildMatchValue(typePart: string, optionPart: string): string {
  if (!optionPart) return typePart;
  return `${typePart}||${optionPart}`;
}

// ── Multi-select dropdown ──────────────────────────────────────────
function MultiSelectDropdown({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Use capture:false so inner button onClick fires before this closes the dropdown
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (opt: string) => {
    // Read selected directly — no stale closure since this is called inline from onClick
    onChange(
      selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt],
    );
    // Keep dropdown open after selection (multi-select UX)
  };

  const displayLabel =
    selected.length === 0
      ? 'Select values…'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} values selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 text-left"
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-900 truncate pr-1'}>
          {displayLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 text-left"
              >
                <div className={`w-3.5 h-3.5 flex-shrink-0 border rounded flex items-center justify-center ${checked ? 'bg-brand-navy border-brand-navy' : 'border-gray-300'}`}>
                  {checked && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="truncate text-gray-800">{opt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const VariantEditor = forwardRef<BodyEditorHandle, Props>(function VariantEditor(
  { variants, onChange, driverField, matchOptions, productTypeOptionsMap, onFocus },
  ref,
) {
  const [expandedKey, setExpandedKey] = useState<string | null>(variants[0]?._key || null);
  // Stable ref objects per variant key — avoids re-triggering useImperativeHandle
  // on every render (which callback refs would do).
  const editorRefsMap = useRef<Map<string, { current: BodyEditorHandle | null }>>(new Map());
  const getEditorRef = (key: string) => {
    if (!editorRefsMap.current.has(key)) {
      editorRefsMap.current.set(key, { current: null });
    }
    return editorRefsMap.current.get(key)!;
  };

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (expandedKey) editorRefsMap.current.get(expandedKey)?.current?.insertText(text);
    },
    focus: () => {
      if (expandedKey) editorRefsMap.current.get(expandedKey)?.current?.focus();
    },
  }), [expandedKey]);

  const add = () => {
    const v = emptyDraftVariant(variants.length);
    onChange([...variants, v]);
    setExpandedKey(v._key);
  };

  const remove = (key: string) => {
    onChange(variants.filter((v) => v._key !== key));
    if (expandedKey === key) setExpandedKey(null);
  };

  const update = (key: string, patch: Partial<DraftVariant>) =>
    onChange(variants.map((v) => (v._key === key ? { ...v, ...patch } : v)));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">Variants</label>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Driver: <span className="font-mono text-brand-navy">{driverField}</span> — each variant matches a value
          </p>
        </div>
        <button onClick={add} className="text-xs text-brand-navy font-semibold hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Variant
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="text-xs text-gray-400 italic leading-relaxed">
          No variants yet. Add one for each value of <span className="font-mono text-gray-500">{driverField}</span> you want to handle —
          e.g., Match Value <span className="font-mono text-gray-500">28</span> with the spec text that applies when the summary&apos;s{' '}
          <span className="font-mono text-gray-500">{driverField}</span> is <span className="font-mono text-gray-500">28</span>.
        </p>
      ) : (
        <div className="space-y-2">
          {variants.map((variant) => {
            const isOpen = expandedKey === variant._key;
            return (
              <div key={variant._key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedKey(isOpen ? null : variant._key)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="text-xs font-medium text-gray-900 flex-1 truncate min-w-0">
                    {(() => {
                      const { typePart, optionPart } = parseMatchValueParts(variant.matchValue);
                      const typeLabel = typePart
                        ? typePart.split(',').map(v => v.trim()).filter(Boolean).join(', ')
                        : null;
                      const optLabel = optionPart
                        ? optionPart.split(',').map(v => v.trim()).filter(Boolean).join(', ')
                        : null;
                      return (
                        <span className="flex flex-col min-w-0">
                          <span className="truncate">
                            {typeLabel ?? <span className="text-gray-400 italic">untitled</span>}
                          </span>
                          {optLabel && (
                            <span className="text-[10px] text-indigo-600 truncate">{optLabel}</span>
                          )}
                        </span>
                      );
                    })()}
                  </span>
                  {variant.matchLabel && (
                    <span className="text-[10px] text-gray-500 flex-shrink-0">{variant.matchLabel}</span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(variant._key); }}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>

                {isOpen && (
                  <div className="px-3 py-3 space-y-3 border-t border-gray-200">
                    {/* Match Value + optional Product Type Options sub-row */}
                    {(() => {
                      const { typePart, optionPart } = parseMatchValueParts(variant.matchValue);
                      const selectedTypes = typePart.split(',').map(t => t.trim()).filter(Boolean);
                      // Available options = union of ALL possible options for selected product types
                      // (from the static definition, not just what's checked in the summary)
                      const availableOptions = driverField === 'productTypes'
                        ? [...new Set(selectedTypes.flatMap(t => getOptionsForType(t)))]
                        : [];
                      const selectedOptions = optionPart.split(',').map(o => o.trim()).filter(Boolean);
                      return (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Match Value</label>
                              {matchOptions ? (
                                <MultiSelectDropdown
                                  options={matchOptions}
                                  selected={selectedTypes}
                                  onChange={(vals) =>
                                    update(variant._key, { matchValue: buildMatchValue(vals.join(','), optionPart) })
                                  }
                                />
                              ) : (
                                <input
                                  value={typePart}
                                  onChange={(e) =>
                                    update(variant._key, { matchValue: buildMatchValue(e.target.value, optionPart) })
                                  }
                                  placeholder="e.g., #28"
                                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Label (optional)</label>
                              <input
                                value={variant.matchLabel}
                                onChange={(e) => update(variant._key, { matchLabel: e.target.value })}
                                placeholder="Glass #28"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                              />
                            </div>
                          </div>
                          {/* Product Type Options sub-filter — only for productTypes driver */}
                          {driverField === 'productTypes' && productTypeOptionsMap !== undefined && (
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <label className="text-[10px] font-semibold text-gray-500">Product Type Options</label>
                                <span className="text-[9px] text-gray-400">(optional — further filter by specific options)</span>
                              </div>
                              {availableOptions.length > 0 ? (
                                <MultiSelectDropdown
                                  options={availableOptions}
                                  selected={selectedOptions}
                                  onChange={(vals) =>
                                    update(variant._key, { matchValue: buildMatchValue(typePart, vals.join(',')) })
                                  }
                                />
                              ) : (
                                <p className="text-[10px] text-gray-400 italic px-1">
                                  Select product types above to see available options.
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {/* end match value section */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Body Text</label>
                      <BodyEditor
                        ref={getEditorRef(variant._key) as React.RefObject<BodyEditorHandle | null>}
                        value={variant.body}
                        onChange={(html) => update(variant._key, { body: html })}
                        onFocus={onFocus}
                        placeholder="Bold, italic, lists supported"
                        minHeight={120}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
