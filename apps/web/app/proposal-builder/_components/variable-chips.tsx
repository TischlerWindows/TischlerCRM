'use client';

import { Plus } from 'lucide-react';

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

export function VariableChips({ mappings, grouped, onInsert, onNewToken }: Props) {
  const categories = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col h-full border-t border-gray-200">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Variables</span>
        <button
          type="button"
          onClick={onNewToken}
          aria-label="Create new variable token"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {mappings.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-1">No token mappings loaded.</p>
        ) : (
          categories.map((cat) => (
            <div key={cat} className="mb-3">
              <div className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-1 px-0.5">{cat}</div>
              <div className="flex flex-wrap gap-1">
                {grouped[cat].map((m) => (
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
