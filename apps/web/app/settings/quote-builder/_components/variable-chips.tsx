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
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Variables</span>
        <button onClick={onNewToken} className="text-xs text-brand-navy font-semibold hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> New
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
                    onClick={() => onInsert(m.tokenName)}
                    title={`{{${m.tokenName}}} — ${m.sourceObject}.${m.label}`}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
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
