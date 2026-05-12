'use client';

import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

interface TokenMapping {
  id: string;
  tokenName: string;
  label: string;
  category: string;
  sourceObject: string;
  format: string;
}

interface Props {
  mappings: TokenMapping[];
  grouped: Record<string, TokenMapping[]>;
  onInsert: (tokenName: string) => void;
  onNewToken: () => void;
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

export function VariableChips({ mappings, grouped, onInsert, onNewToken }: Props) {
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
          categories.map((cat) => (
            <div key={cat} className="mb-3">
              <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1 px-0.5">{cat}</div>
              <div className="flex flex-wrap gap-1">
                {filteredGrouped[cat].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onInsert(m.tokenName)}
                    title={`{{${m.tokenName}}} — ${m.sourceObject}.${m.label}`}
                    aria-label={`Insert ${m.tokenName} token`}
                    className="text-[10px] font-mono leading-tight min-h-[24px] inline-flex items-center px-1.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-colors cursor-pointer"
                  >
                    {m.tokenName}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
