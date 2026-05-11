'use client';

import { GripVertical, Plus, ScrollText, EyeOff, GitBranch } from 'lucide-react';
import type { SpecPresetData } from '@/lib/quote-conditions';

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

export function BlockList({ presets, selectedPresetId, onSelect, onNew, onReorder, onReorderEnd, dragIdx, onDragStart }: Props) {
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const reordered = [...presets];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    onReorder(reordered.map((p, i) => ({ ...p, order: i })));
    onDragStart(idx);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Blocks</span>
        <button onClick={onNew} className="text-xs text-brand-navy font-semibold hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <ScrollText className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500">No blocks yet</p>
            <button onClick={onNew} className="mt-2 text-xs text-brand-navy font-semibold hover:underline">
              + Create first block
            </button>
          </div>
        ) : (
          presets.map((preset, idx) => {
            const isSelected = preset.id === selectedPresetId;
            return (
              <div
                key={preset.id}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={onReorderEnd}
                onClick={() => onSelect(preset)}
                className={`flex items-center gap-2 px-2.5 py-2 border-b border-gray-100 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#ede9f5] border-l-[3px] border-l-[#da291c]' : 'hover:bg-gray-50'
                } ${!preset.isActive ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 cursor-grab" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 tabular-nums w-4 text-right">{idx + 1}</span>
                    <span className="text-xs font-medium text-gray-900 truncate">{preset.title}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 ml-5.5">
                    <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${SECTION_COLORS[preset.section] || ''}`}>
                      {preset.section}
                    </span>
                    {preset.isAlwaysIncluded && (
                      <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-purple-100 text-purple-700">Always</span>
                    )}
                    {preset.driverField && (
                      <GitBranch className="w-3 h-3 text-indigo-500" title={`Driver: ${preset.driverField}`} />
                    )}
                  </div>
                </div>
                {!preset.isActive && <EyeOff className="w-3 h-3 text-gray-400 flex-shrink-0" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
