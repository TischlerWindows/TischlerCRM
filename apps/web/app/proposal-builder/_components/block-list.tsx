'use client';

import { GripVertical, Plus, ScrollText, EyeOff, GitBranch, ChevronUp, ChevronDown } from 'lucide-react';
import type { SpecPresetData } from '@crm/proposal-assembly';

const SECTION_COLORS: Record<string, string> = {
  CONSTANT: 'bg-slate-100 text-slate-700',
  SPECIFICATION: 'bg-blue-100 text-blue-700',
  OPTION: 'bg-amber-100 text-amber-700',
  EXCLUSION: 'bg-red-100 text-red-700',
  INSTALLATION: 'bg-green-100 text-green-700',
};

interface Props {
  presets: SpecPresetData[];
  selectedPresetId: string | null;
  onSelect: (preset: SpecPresetData) => void;
  onNew: () => void;
  onReorder: (presets: SpecPresetData[]) => void;
  onReorderEnd: () => void;
  dragIdx: number | null;
  onDragStart: (idx: number) => void;
}

function reorderAt(list: SpecPresetData[], from: number, to: number): SpecPresetData[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((p, i) => ({ ...p, order: i }));
}

export function BlockList({ presets, selectedPresetId, onSelect, onNew, onReorder, onReorderEnd, dragIdx, onDragStart }: Props) {
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    onReorder(reorderAt(presets, dragIdx, idx));
    onDragStart(idx);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= presets.length) return;
    onReorder(reorderAt(presets, idx, target));
    onReorderEnd();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Blocks</span>
        <button
          type="button"
          onClick={onNew}
          aria-label="Create new block"
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <ScrollText className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500">No blocks yet</p>
            <button
              type="button"
              onClick={onNew}
              className="mt-2 px-3 py-1.5 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            >
              + Create first block
            </button>
          </div>
        ) : (
          <ul role="list" className="contents">
            {presets.map((preset, idx) => {
              const isSelected = preset.id === selectedPresetId;
              const isFirst = idx === 0;
              const isLast = idx === presets.length - 1;
              return (
                <li
                  key={preset.id}
                  draggable
                  tabIndex={0}
                  aria-current={isSelected ? 'true' : undefined}
                  onDragStart={() => onDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={onReorderEnd}
                  onClick={() => onSelect(preset)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (e.target === e.currentTarget) {
                        e.preventDefault();
                        onSelect(preset);
                      }
                    }
                  }}
                  className={`group flex items-center gap-1.5 px-2 py-2 border-b border-gray-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-navy/30 transition-colors ${
                    isSelected ? 'bg-[#ede9f5] border-l-[3px] border-l-[#da291c]' : 'hover:bg-gray-50'
                  } ${!preset.isActive ? 'opacity-50' : ''}`}
                >
                  <GripVertical
                    aria-hidden="true"
                    className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 cursor-grab"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 tabular-nums w-4 text-right">{idx + 1}</span>
                      <span className="text-xs font-medium text-gray-900 truncate">{preset.title}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 ml-5.5 flex-wrap">
                      <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${SECTION_COLORS[preset.section] || ''}`}>
                        {preset.section}
                      </span>
                      {preset.isAlwaysIncluded && (
                        <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-100 text-purple-700">Always</span>
                      )}
                      {preset.driverField && (
                        <GitBranch className="w-3 h-3 text-indigo-500" aria-label={`Driver field: ${preset.driverField}`} />
                      )}
                    </div>
                  </div>
                  {!preset.isActive && (
                    <EyeOff aria-label="Inactive block" className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, -1);
                      }}
                      disabled={isFirst}
                      aria-label={`Move ${preset.title} up`}
                      className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, 1);
                      }}
                      disabled={isLast}
                      aria-label={`Move ${preset.title} down`}
                      className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
