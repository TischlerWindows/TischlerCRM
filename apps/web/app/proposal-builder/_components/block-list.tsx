'use client';

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  EyeOff,
  FileText,
  GitBranch,
  GripVertical,
  Plus,
  ScrollText,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpecPresetData } from '@crm/proposal-assembly';
import { BLOCK_TYPE_META, type BlockType } from '@crm/types';

const SECTION_ORDER: Array<SpecPresetData['section']> = [
  'CONSTANT',
  'SPECIFICATION',
  'OPTION',
  'EXCLUSION',
  'INSTALLATION',
];

const SECTION_LABEL: Record<SpecPresetData['section'], string> = {
  CONSTANT: 'Constants',
  SPECIFICATION: 'Specifications',
  OPTION: 'Options',
  EXCLUSION: 'Exclusions',
  INSTALLATION: 'Installation',
};

const SECTION_COLORS: Record<string, string> = {
  CONSTANT: 'bg-slate-100 text-slate-700',
  SPECIFICATION: 'bg-blue-100 text-blue-700',
  OPTION: 'bg-amber-100 text-amber-700',
  EXCLUSION: 'bg-red-100 text-red-700',
  INSTALLATION: 'bg-green-100 text-green-700',
};

const COLLAPSED_STORAGE_KEY = 'proposalBuilder.blockGroups.collapsed';

interface Props {
  presets: SpecPresetData[];
  selectedPresetId: string | null;
  onSelect: (preset: SpecPresetData) => void;
  /** Create a new preset. blockType picks from the palette; null = legacy blank text. */
  onNew: (blockType: BlockType | null) => void;
  onDuplicate?: (preset: SpecPresetData) => void;
  onReorder: (presets: SpecPresetData[]) => void;
  onReorderEnd: (reordered?: SpecPresetData[]) => void;
  /** Seed the template with the standard layout (letterhead, pricing, etc.). */
  onSeedDefaults?: () => void;
  dragIdx: number | null;
  onDragStart: (idx: number) => void;
}

const PALETTE_GROUPS: Array<{ group: 'Layout' | 'Content' | 'Data'; types: BlockType[] }> = [
  {
    group: 'Layout',
    types: ['LETTERHEAD', 'EXCLUSIONS_HEADER', 'CLOSING_SIGNATURE', 'PAGE_BREAK', 'INSTALLATION_HEADER', 'FOOTER'],
  },
  {
    group: 'Content',
    types: ['FREE_TEXT', 'TITLE_BLOCK', 'SPECIFICATION_ITEM', 'OPTION_ITEM', 'EXCLUSION_ITEM', 'INSTALLATION_ITEM'],
  },
  { group: 'Data', types: ['PRICING_TABLE', 'BASE_BID_LINE', 'ADDITIONS_TABLE'] },
];

function reorderAt(list: SpecPresetData[], from: number, to: number): SpecPresetData[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map((p, i) => ({ ...p, order: i }));
}

function useCollapsedSections(): {
  collapsed: Set<string>;
  toggle: (section: string) => void;
} {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (raw) setCollapsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      // ignore — older browsers / disabled storage
    }
  }, []);
  const toggle = useCallback((section: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

export function BlockList({
  presets,
  selectedPresetId,
  onSelect,
  onNew,
  onDuplicate,
  onReorder,
  onReorderEnd,
  onSeedDefaults,
  dragIdx,
  onDragStart,
}: Props) {
  const { collapsed, toggle } = useCollapsedSections();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedPreset = presets.find((p) => p.id === selectedPresetId) || null;

  // Close the new-block menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    // Cross-section drag is allowed — the renderer iterates by `order`,
    // not section, so the block list mirrors document order directly.
    onReorder(reorderAt(presets, dragIdx, idx));
    onDragStart(idx);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= presets.length) return;
    const reordered = reorderAt(presets, idx, target);
    onReorder(reordered);
    onReorderEnd(reordered);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Blocks</span>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Create new block"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
            <ChevronDown className="w-3 h-3 -ml-0.5 opacity-70" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1 z-20 w-72 rounded-lg border border-gray-200 bg-white shadow-xl overflow-hidden max-h-[80vh] overflow-y-auto"
            >
              {PALETTE_GROUPS.map((group) => (
                <div key={group.group}>
                  <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 bg-gray-50 border-y border-gray-100">
                    {group.group}
                  </div>
                  {group.types.map((type) => {
                    const meta = BLOCK_TYPE_META[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onNew(type);
                        }}
                        className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                      >
                        <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-navy flex-shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900">{meta.label}</div>
                          <div className="text-[10.5px] text-gray-500 leading-snug">{meta.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="border-t-2 border-gray-200">
                <button
                  type="button"
                  role="menuitem"
                  disabled={!selectedPreset || !onDuplicate}
                  onClick={() => {
                    if (!selectedPreset || !onDuplicate) return;
                    setMenuOpen(false);
                    onDuplicate(selectedPreset);
                  }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 focus:bg-gray-50 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Copy className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" aria-hidden="true" />
                  <div>
                    <div className="font-medium text-gray-900">Duplicate selected</div>
                    <div className="text-[10.5px] text-gray-500">
                      {selectedPreset
                        ? `Copy "${selectedPreset.title}".`
                        : 'Select a block first.'}
                    </div>
                  </div>
                </button>
                {onSeedDefaults && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSeedDefaults();
                    }}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-amber-50 focus:bg-amber-50 focus:outline-none border-t border-gray-100"
                  >
                    <ScrollText className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <div className="font-medium text-gray-900">Add standard layout</div>
                      <div className="text-[10.5px] text-gray-500">
                        Append Letterhead + Pricing + Closing + Footer blocks.
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {presets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <ScrollText className="w-8 h-8 text-gray-300 mb-2" />
            <p className="text-xs text-gray-500">No blocks yet</p>
            <p className="text-[10px] text-gray-400 mt-1 max-w-[180px]">
              Click + New to add a block from the palette, or seed the standard layout below.
            </p>
            <button
              type="button"
              onClick={() => onNew('FREE_TEXT')}
              className="mt-3 px-3 py-1.5 text-xs text-brand-navy font-semibold rounded hover:bg-brand-navy/10 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            >
              + Add free text block
            </button>
            {onSeedDefaults && (
              <button
                type="button"
                onClick={onSeedDefaults}
                className="mt-1 px-3 py-1.5 text-xs text-amber-700 font-semibold rounded hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                Seed standard layout
              </button>
            )}
          </div>
        ) : (
          SECTION_ORDER.map((section) => {
            const inGroup = presets.filter((p) => p.section === section);
            if (inGroup.length === 0) return null;
            const isCollapsed = collapsed.has(section);
            return (
              <section key={section} aria-label={SECTION_LABEL[section]}>
                <button
                  type="button"
                  onClick={() => toggle(section)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`block-group-${section}`}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-50/80 border-b border-gray-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-navy/30 transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight aria-hidden="true" className="w-3 h-3 text-gray-400" />
                  ) : (
                    <ChevronDown aria-hidden="true" className="w-3 h-3 text-gray-400" />
                  )}
                  <span className="flex-1 text-left">{SECTION_LABEL[section]}</span>
                  <span className="font-normal lowercase tracking-normal text-gray-400">
                    {inGroup.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <ul role="list" id={`block-group-${section}`} className="contents">
                    {inGroup.map((preset) => {
                      const idx = presets.indexOf(preset);
                      const inGroupIdx = inGroup.indexOf(preset);
                      const isSelected = preset.id === selectedPresetId;
                      const isFirstInGroup = inGroupIdx === 0;
                      const isLastInGroup = inGroupIdx === inGroup.length - 1;
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
                              {/* Per-group position. Resets per section so users
                                  don't see a confusing global index like
                                  "1, 2, 28, 3" when blocks are grouped. */}
                              <span className="text-[10px] font-bold text-gray-400 tabular-nums w-4 text-right">
                                {inGroupIdx + 1}
                              </span>
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
                              disabled={isFirstInGroup}
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
                              disabled={isLastInGroup}
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
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
