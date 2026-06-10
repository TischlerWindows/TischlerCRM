'use client';

import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { BodyEditor } from './body-editor';

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
  /** If provided, Match Value renders as a dropdown instead of free text. */
  matchOptions?: string[];
}

export function VariantEditor({ variants, onChange, driverField, matchOptions }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(variants[0]?._key || null);

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
                  <span className="text-xs font-medium text-gray-900 flex-1">
                    {variant.matchValue || <span className="text-gray-400 italic">untitled</span>}
                  </span>
                  {variant.matchLabel && (
                    <span className="text-[10px] text-gray-500">{variant.matchLabel}</span>
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
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Match Value</label>
                        {matchOptions ? (
                          <select
                            value={variant.matchValue}
                            onChange={(e) => update(variant._key, { matchValue: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/20 bg-white"
                          >
                            <option value="">Select a value…</option>
                            {matchOptions.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={variant.matchValue}
                            onChange={(e) => update(variant._key, { matchValue: e.target.value })}
                            placeholder={`e.g., #28`}
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
                    <div>
                      <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Body Text</label>
                      <BodyEditor
                        value={variant.body}
                        onChange={(html) => update(variant._key, { body: html })}
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
}
