'use client';

import { Plus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TokenMapping {
  id: string;
  tokenName: string;
  label: string;
  category: string;
  sourceObject: string;
  sourcePath?: string;
  format: string;
}

// Sub-headers inside each category group. Users think in domain terms ("this
// is a price from the Quote", "this is a line item") but everything still
// resolves through the Summary blob under the hood — we just label the path.
function sourceSubgroup(m: TokenMapping): string {
  const path = (m.sourcePath || '').toLowerCase();
  const obj = m.sourceObject.toUpperCase();
  if (obj === 'OPPORTUNITY') return 'From Opportunity';
  if (obj === 'PROJECT') return 'From Project';
  if (obj === 'CONTACT') return 'From Contact';
  if (obj === 'ACCOUNT') return 'From Account';
  if (obj === 'SYSTEM') return 'System';
  if (path.startsWith('quotetotals')) return 'From Quote Totals';
  if (path.startsWith('addons')) return 'From Add-ons';
  if (path.startsWith('rows') || path.startsWith('doorrows')) return 'From Line Items';
  if (path.startsWith('productytypeoptions') || path.startsWith('producttypeoptions'))
    return 'From Product Options';
  return 'From Summary';
}

interface Props {
  mappings: TokenMapping[];
  grouped: Record<string, TokenMapping[]>;
  onInsert: (tokenName: string) => void;
  onNewToken: () => void;
  onDeleteToken?: (id: string, tokenName: string) => void;
}

function matchesQuery(m: TokenMapping, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    m.tokenName.toLowerCase().includes(lower) ||
    m.label.toLowerCase().includes(lower) ||
    m.category.toLowerCase().includes(lower)
  );
}

export function VariableChips({ mappings, grouped, onInsert, onNewToken, onDeleteToken }: Props) {
  const [query, setQuery] = useState('');

  const filteredGrouped = useMemo(() => {
    if (!query.trim()) return grouped;
    const out: Record<string, TokenMapping[]> = {};
    for (const [cat, items] of Object.entries(grouped)) {
      const filtered = items.filter((m) => matchesQuery(m, query));
      if (filtered.length > 0) out[cat] = filtered;
    }
    return out;
  }, [grouped, query]);

  const categories = Object.keys(filteredGrouped).sort();
  const totalMatches = useMemo(
    () => Object.values(filteredGrouped).reduce((sum, list) => sum + list.length, 0),
    [filteredGrouped],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
          Variables
          {query && (
            <span className="ml-1 font-normal text-gray-400 lowercase tracking-normal">
              ({totalMatches} of {mappings.length})
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onNewToken}
          aria-label="Create new variable token"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {mappings.length > 0 && (
        <div className="px-2.5 pt-2 pb-1">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search variables"
              aria-label="Search variables"
              className="w-full text-[11px] pl-7 pr-2 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-1 px-0.5">
            Click a chip to insert <span className="font-mono">{'{{name}}'}</span> at the cursor in Body Text.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2.5 pt-1 pb-2">
        {mappings.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-1">No token mappings loaded.</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-1 mt-2">No variables match &quot;{query}&quot;.</p>
        ) : (
          categories.map((cat) => {
            // Group items inside each category by where their value comes from.
            const bySubgroup = new Map<string, TokenMapping[]>();
            for (const m of filteredGrouped[cat]) {
              const sg = sourceSubgroup(m);
              const list = bySubgroup.get(sg);
              if (list) list.push(m);
              else bySubgroup.set(sg, [m]);
            }
            const subgroupNames = Array.from(bySubgroup.keys()).sort();
            return (
              <div key={cat} className="mb-3">
                <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1 px-0.5">{cat}</div>
                {subgroupNames.map((sg) => (
                  <div key={sg} className="mb-1.5">
                    {(subgroupNames.length > 1 || sg !== 'From Summary') && (
                      <div className="text-[8.5px] font-medium uppercase tracking-wider text-gray-400/80 mb-0.5 px-0.5">
                        {sg}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {bySubgroup.get(sg)!.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center text-[10px] font-mono leading-tight min-h-[24px] rounded bg-indigo-50 text-indigo-700 border border-indigo-200"
                        >
                          <button
                            type="button"
                            onClick={() => onInsert(m.tokenName)}
                            title={`{{${m.tokenName}}} — ${m.sourceObject}.${m.label}`}
                            aria-label={`Insert ${m.tokenName} token`}
                            className="px-1.5 py-1 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors cursor-pointer rounded-l"
                          >
                            {m.tokenName}
                          </button>
                          {!m.isBuiltIn && onDeleteToken && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onDeleteToken(m.id, m.tokenName); }}
                              title={`Delete {{${m.tokenName}}}`}
                              aria-label={`Delete ${m.tokenName} token`}
                              className="px-1 py-1 text-indigo-400 hover:text-red-500 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors cursor-pointer rounded-r border-l border-indigo-200"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
