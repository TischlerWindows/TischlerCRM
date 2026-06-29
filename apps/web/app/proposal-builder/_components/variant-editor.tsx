'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { BodyEditor, type BodyEditorHandle } from './body-editor';
import { getOptionsForType } from '@/lib/product-type-options';

export interface DraftVariant {
  _key: string;
  matchValue: string;
  matchLabel: string;
  title: string;
  body: string;
  order: number;
  isActive: boolean;
}

let _variantKey = 0;
export function nextVariantKey(): string {
  return `vk_${++_variantKey}`;
}

export function emptyDraftVariant(order: number): DraftVariant {
  return { _key: nextVariantKey(), matchValue: '', matchLabel: '', title: '', body: '', order, isActive: true };
}

export function variantToDraft(v: { matchValue: string; matchLabel: string | null; title?: string | null; body: string; order: number; isActive: boolean }): DraftVariant {
  return { _key: nextVariantKey(), matchValue: v.matchValue, matchLabel: v.matchLabel || '', title: v.title || '', body: v.body, order: v.order, isActive: v.isActive };
}

export function variantsPayload(variants: DraftVariant[]) {
  return variants.map((v, i) => ({
    matchValue: v.matchValue,
    matchLabel: v.matchLabel || null,
    title: v.title || null,
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
   * When driverField includes 'productTypes', the available options per product type
   * from the current summary (Record<productTypeName, optionName[]>).
   * Used to populate the "Product Type Options" sub-dropdown.
   */
  productTypeOptionsMap?: Record<string, string[]>;
  /** Called when any variant body editor receives focus. */
  onFocus?: () => void;
}

// ── matchValue encoding helpers ────────────────────────────────────
// matchValue encodes selected items as newline-separated. Newline is used
// instead of comma because many option names (e.g. glass types) contain
// commas themselves — comma-splitting would fragment them on re-render.
// The '||' sub-separator still divides type-part from option-part.
// New format: \n-separated. Legacy data (no \n) is recovered by greedy-matching
// against the known options list — required because some option names contain commas.
function splitValues(s: string, knownOptions?: string[]): string[] {
  if (!s) return [];
  // New format: newline-separated
  if (s.includes('\n')) return s.split('\n').map(v => v.trim()).filter(Boolean);
  // Legacy format: try greedy forward-match against known options first so that
  // options whose names contain commas are not split incorrectly.
  if (knownOptions?.length) {
    const result: string[] = [];
    let rem = s;
    while (rem.length > 0) {
      rem = rem.trimStart();
      if (!rem) break;
      // Pick the longest known option that matches the start of the remainder
      const match = knownOptions
        .filter(opt => rem.startsWith(opt))
        .sort((a, b) => b.length - a.length)[0];
      if (match) {
        result.push(match);
        rem = rem.slice(match.length);
        if (rem.startsWith(', ')) rem = rem.slice(2);
        else if (rem.startsWith(',')) rem = rem.slice(1);
      } else {
        // No known option at this position — consume up to the next comma
        const ci = rem.indexOf(',');
        if (ci === -1) { result.push(rem.trim()); break; }
        result.push(rem.slice(0, ci).trim());
        rem = rem.slice(ci + 1);
      }
    }
    return result.filter(Boolean);
  }
  // Fallback: naive comma split (safe when option names have no commas)
  return s.split(',').map(v => v.trim()).filter(Boolean);
}
function joinValues(vals: string[]): string {
  return vals.join('\n');
}
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
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setMenuStyle({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    setOpen((o) => !o);
  };

  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((v) => v !== opt)
        : [...selected, opt],
    );
  };

  const displayLabel =
    selected.length === 0
      ? 'Select values…'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} values selected`;

  const menu = open && menuStyle ? createPortal(
    <div
      ref={menuRef}
      style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, width: Math.max(320, menuStyle.width), zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto"
    >
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
    </div>,
    document.body,
  ) : null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="w-full flex items-center justify-between px-3 py-2 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 text-left"
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-900 truncate pr-1'}>
          {displayLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      </button>
      {menu}
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
            Drivers: <span className="font-mono text-brand-navy">
              {driverField.split(',').map(d => d.trim()).filter(Boolean).join(', ') || driverField}
            </span> — each variant matches a value from any driver
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
                        ? typePart.split('\n').map(v => v.trim()).filter(Boolean).join(', ')
                        : null;
                      const optLabel = optionPart
                        ? optionPart.split('\n').map(v => v.trim()).filter(Boolean).join(', ')
                        : null;
                      return (
                        <span className="flex flex-col min-w-0">
                          {/* Variant title is the primary identity — show it first if set */}
                          {variant.title ? (
                            <span className="truncate font-semibold text-[#1e3a5f]">{variant.title}</span>
                          ) : (
                            <span className="truncate text-gray-500 italic text-[10px]">No title set</span>
                          )}
                          <span className="truncate text-[10px] text-gray-400">
                            {typeLabel ?? <span className="italic">no match value</span>}
                            {optLabel && <span className="text-indigo-500 ml-1">· {optLabel}</span>}
                          </span>
                        </span>
                      );
                    })()}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); remove(variant._key); }}
                    className="p-0.5 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </button>

                {isOpen && (
                  <div className="px-3 py-3 space-y-3 border-t border-gray-200">
                    {/* Title — first field so it's clear this IS the PDF title for this variant */}
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                        Title <span className="text-gray-400 font-normal">(shown in PDF for this variant — leave blank to use block title)</span>
                      </label>
                      <input
                        value={variant.title}
                        onChange={(e) => update(variant._key, { title: e.target.value })}
                        placeholder="e.g., 28 DC Standard Insulated Glass"
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                      />
                    </div>
                    {/* Match Value + optional Label sub-row */}
                    {(() => {
                      const { typePart, optionPart } = parseMatchValueParts(variant.matchValue);
                      const selectedTypes = splitValues(typePart, matchOptions);
                      // Available options = union of ALL possible options for selected product types
                      // (from the static definition, not just what's checked in the summary)
                      const availableOptions = driverField.split(',').some(d => d.trim() === 'productTypes')
                        ? [...new Set(selectedTypes.flatMap(t => getOptionsForType(t)))]
                        : [];
                      const selectedOptions = splitValues(optionPart, availableOptions);
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
                                    update(variant._key, { matchValue: buildMatchValue(joinValues(vals), optionPart) })
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
                              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Label <span className="font-normal text-gray-400">(internal only)</span></label>
                              <input
                                value={variant.matchLabel}
                                onChange={(e) => update(variant._key, { matchLabel: e.target.value })}
                                placeholder="Glass #28"
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                              />
                            </div>
                          </div>
                          {/* Product Type Options sub-filter — only for productTypes driver */}
                          {driverField.split(',').some(d => d.trim() === 'productTypes') && productTypeOptionsMap !== undefined && (
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
                                    update(variant._key, { matchValue: buildMatchValue(typePart, joinValues(vals)) })
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

// ── Title-only variant editor ─────────────────────────────────────
// Same card-based UX as VariantEditor but only exposes Match Value + Title.
// Stored in the same DraftVariant array; body is left blank so the
// assembly falls through to the block's universal body.

interface TitleVariantProps {
  variants: DraftVariant[];
  onChange: (variants: DraftVariant[]) => void;
  driverField: string;
  matchOptions?: string[];
}

export function TitleVariantEditor({ variants, onChange, driverField, matchOptions }: TitleVariantProps) {
  const [open, setOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const add = () => {
    const v = emptyDraftVariant(variants.length);
    onChange([...variants, v]);
    setExpandedKey(v._key);
    setOpen(true);
  };

  const remove = (key: string) => {
    onChange(variants.filter((v) => v._key !== key));
    if (expandedKey === key) setExpandedKey(null);
  };

  const update = (key: string, patch: Partial<DraftVariant>) =>
    onChange(variants.map((v) => (v._key === key ? { ...v, ...patch } : v)));

  return (
    <div className="border border-dashed border-brand-navy/20 rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50/80 hover:bg-gray-100/80 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-3.5 h-3.5 text-brand-navy/60" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-brand-navy/60" />
          )}
          <span className="text-[10px] font-semibold text-brand-navy/80 uppercase tracking-wider">
            Title Variants
          </span>
          {variants.length > 0 && (
            <span className="text-[9px] bg-brand-navy/10 text-brand-navy px-1.5 py-0.5 rounded-full">
              {variants.length}
            </span>
          )}
        </div>
        <span className="text-[9px] text-gray-400">Blank body = uses block body</span>
      </button>

      {open && (
        <div className="px-3 py-2.5 space-y-2 border-t border-brand-navy/10">
          {variants.length === 0 ? (
            <p className="text-[10px] text-gray-400 italic">
              No title variants yet. Add one to give a specific variant a different title in the PDF.
            </p>
          ) : (
            variants.map((variant) => {
              const isCardOpen = expandedKey === variant._key;
              const { typePart, optionPart } = parseMatchValueParts(variant.matchValue);
              const selectedTypes = splitValues(typePart, matchOptions);
              const displayName =
                variant.matchLabel ||
                (selectedTypes.length > 0 ? selectedTypes.join(', ') : null) ||
                typePart ||
                '—';

              return (
                <div key={variant._key} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Card header */}
                  <button
                    type="button"
                    onClick={() => setExpandedKey(isCardOpen ? null : variant._key)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                  >
                    {isCardOpen ? (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                    <span className="flex-1 min-w-0 flex flex-col">
                      {variant.title ? (
                        <span className="text-xs font-semibold text-[#1e3a5f] truncate">{variant.title}</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 italic">No title set</span>
                      )}
                      <span className="text-[10px] text-gray-400 truncate">{displayName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); remove(variant._key); }}
                      className="p-0.5 text-gray-400 hover:text-red-500 flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>

                  {/* Expanded card body */}
                  {isCardOpen && (
                    <div className="px-3 py-3 space-y-3 border-t border-gray-200">
                      {/* Title input */}
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                          Title <span className="text-gray-400 font-normal">(shown in PDF for this variant)</span>
                        </label>
                        <input
                          value={variant.title}
                          onChange={(e) => update(variant._key, { title: e.target.value })}
                          placeholder="e.g., 28 DC Standard Insulated Glass"
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                      </div>
                      {/* Match Value */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Match Value</label>
                          {matchOptions ? (
                            <MultiSelectDropdown
                              options={matchOptions}
                              selected={selectedTypes}
                              onChange={(vals) =>
                                update(variant._key, {
                                  matchValue: buildMatchValue(joinValues(vals), optionPart),
                                })
                              }
                            />
                          ) : (
                            <input
                              value={typePart}
                              onChange={(e) =>
                                update(variant._key, {
                                  matchValue: buildMatchValue(e.target.value, optionPart),
                                })
                              }
                              placeholder="e.g., #28"
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                            />
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                            Label <span className="text-gray-400 font-normal">(internal only)</span>
                          </label>
                          <input
                            value={variant.matchLabel}
                            onChange={(e) => update(variant._key, { matchLabel: e.target.value })}
                            placeholder="e.g., Glass #28"
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={add}
            className="flex items-center gap-1 text-xs text-brand-navy font-semibold hover:underline mt-1"
          >
            <Plus className="w-3 h-3" /> Add Title Variant
          </button>
        </div>
      )}
    </div>
  );
}
