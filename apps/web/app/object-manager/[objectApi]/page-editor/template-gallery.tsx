'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { LayoutTemplate, X } from 'lucide-react';
import type { CustomLayoutTemplate, TemplateRegionDef, TemplateTabDef } from '@/lib/schema';
import {
  BUILT_IN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type BuiltInTemplate,
  type TemplateCategory,
} from './templates';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (tabs: TemplateTabDef[], templateName: string) => void;
  savedTemplates?: CustomLayoutTemplate[];
}

// ── SVG block-diagram preview ─────────────────────────────────────────────────

function TemplatePreviewSvg({ regions }: { regions: TemplateRegionDef[] }) {
  const ROW_H = 14;
  const ROW_GAP = 3;
  const PAD = 4;
  const INNER_W = 100;

  if (regions.length === 0) {
    return (
      <svg viewBox="0 0 108 36" preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <rect
          x="2" y="2" width="104" height="32"
          rx="3" fill="none" stroke="#d1d5db" strokeWidth="1" strokeDasharray="4 2"
        />
        <text
          x="54" y="21"
          textAnchor="middle" fill="#9ca3af" fontSize="7"
          fontFamily="system-ui, sans-serif"
        >
          Empty canvas
        </text>
      </svg>
    );
  }

  const maxRow = regions.reduce(
    (m, r) => Math.max(m, r.gridRow + r.gridRowSpan - 1),
    1,
  );
  const vbW = PAD * 2 + INNER_W;
  const vbH = PAD * 2 + maxRow * ROW_H + Math.max(0, maxRow - 1) * ROW_GAP;

  return (
    <svg
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
    >
      {regions.map((r) => {
        const x = PAD + ((r.gridColumn - 1) / 12) * INNER_W;
        const w = Math.max(2, (r.gridColumnSpan / 12) * INNER_W - 1);
        const y = PAD + (r.gridRow - 1) * (ROW_H + ROW_GAP);
        return (
          <rect
            key={r.id}
            x={x} y={y} width={w} height={ROW_H}
            rx="2"
            fill="#ede9fe"
            stroke="#8b5cf6"
            strokeWidth="0.75"
          />
        );
      })}
    </svg>
  );
}

// ── Card components ───────────────────────────────────────────────────────────

function BuiltinCard({
  template,
  selected,
  onSelect,
  onDoubleClick,
}: {
  template: BuiltInTemplate;
  selected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const regions = template.getTabs()[0]?.regions ?? [];
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
        if (e.key === 'Enter') {
          onDoubleClick();
        }
      }}
      className={`cursor-pointer rounded-xl border bg-white p-3 transition-all hover:shadow-md ${
        selected
          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-400'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="h-20 flex items-center justify-center bg-gray-50 rounded-lg mb-3 overflow-hidden p-2">
        <TemplatePreviewSvg regions={regions} />
      </div>
      <p className="font-semibold text-sm text-gray-900 leading-tight">{template.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{template.description}</p>
    </div>
  );
}

function SavedCard({
  template,
  selected,
  onSelect,
  onDoubleClick,
}: {
  template: CustomLayoutTemplate;
  selected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}) {
  const regions = template.tabs[0]?.regions ?? [];
  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
        if (e.key === 'Enter') {
          onDoubleClick();
        }
      }}
      className={`cursor-pointer rounded-xl border bg-white p-3 transition-all hover:shadow-md ${
        selected
          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-400'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="h-20 flex items-center justify-center bg-gray-50 rounded-lg mb-3 overflow-hidden p-2">
        <TemplatePreviewSvg regions={regions} />
      </div>
      <p className="font-semibold text-sm text-gray-900 leading-tight">{template.name}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-snug">Saved custom template</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TemplateGallery({
  open,
  onClose,
  onSelect,
  savedTemplates = [],
}: TemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');
  const [selectedBuiltin, setSelectedBuiltin] = useState<string | null>(null);
  const [selectedSaved, setSelectedSaved] = useState<string | null>(null);

  const hasSaved = savedTemplates.length > 0;

  useEffect(() => {
    if (!open) {
      setSelectedBuiltin(null);
      setSelectedSaved(null);
      setActiveCategory('all');
    }
  }, [open]);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, handleEscape]);

  const visibleBuiltins = BUILT_IN_TEMPLATES.filter(
    (t) => activeCategory === 'all' || t.category.includes(activeCategory),
  );

  const visibleSaved =
    hasSaved && (activeCategory === 'all' || activeCategory === 'saved-custom')
      ? savedTemplates
      : [];

  const hasSelection = selectedBuiltin !== null || selectedSaved !== null;

  const selectedName = selectedBuiltin
    ? (BUILT_IN_TEMPLATES.find((t) => t.id === selectedBuiltin)?.name ?? '')
    : selectedSaved
      ? (savedTemplates.find((t) => t.id === selectedSaved)?.name ?? '')
      : '';

  const categories = hasSaved
    ? TEMPLATE_CATEGORIES
    : TEMPLATE_CATEGORIES.filter((c) => c.id !== 'saved-custom');

  const applyBuiltin = useCallback(
    (id: string) => {
      const tmpl = BUILT_IN_TEMPLATES.find((t) => t.id === id);
      if (tmpl) {
        onSelect(tmpl.getTabs(), tmpl.name);
        onClose();
      }
    },
    [onSelect, onClose],
  );

  const applySaved = useCallback(
    (id: string) => {
      const tmpl = savedTemplates.find((t) => t.id === id);
      if (tmpl) {
        onSelect(tmpl.tabs, tmpl.name);
        onClose();
      }
    },
    [savedTemplates, onSelect, onClose],
  );

  const handleUseTemplate = useCallback(() => {
    if (selectedBuiltin) applyBuiltin(selectedBuiltin);
    else if (selectedSaved) applySaved(selectedSaved);
  }, [selectedBuiltin, selectedSaved, applyBuiltin, applySaved]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: '90vw', height: '90vh', maxWidth: '1200px', maxHeight: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600 shrink-0">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="template-gallery-title"
                className="text-lg font-semibold text-gray-900 leading-tight"
              >
                Choose a layout template
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Select a starting structure — you can customize everything afterward
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template gallery"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left sidebar — category filter */}
          <aside
            className="shrink-0 border-r border-gray-200 overflow-y-auto py-3 px-2"
            style={{ width: 220 }}
          >
            <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Categories
            </p>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSelectedBuiltin(null);
                  setSelectedSaved(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </aside>

          {/* Main card grid */}
          <main className="flex-1 overflow-y-auto p-6">
            {visibleBuiltins.length === 0 && visibleSaved.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-16">
                No templates in this category.
              </p>
            )}

            {visibleBuiltins.length > 0 && (
              <div
                className="grid grid-cols-3 gap-4"
                role="listbox"
                aria-label="Layout templates"
              >
                {visibleBuiltins.map((tmpl) => (
                  <BuiltinCard
                    key={tmpl.id}
                    template={tmpl}
                    selected={selectedBuiltin === tmpl.id}
                    onSelect={() => {
                      setSelectedBuiltin(tmpl.id);
                      setSelectedSaved(null);
                    }}
                    onDoubleClick={() => applyBuiltin(tmpl.id)}
                  />
                ))}
              </div>
            )}

            {visibleSaved.length > 0 && (
              <>
                {visibleBuiltins.length > 0 && (
                  <div className="mt-8 mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Saved Custom Templates
                    </p>
                  </div>
                )}
                <div
                  className="grid grid-cols-3 gap-4"
                  role="listbox"
                  aria-label="Saved custom templates"
                >
                  {visibleSaved.map((tmpl) => (
                    <SavedCard
                      key={tmpl.id}
                      template={tmpl}
                      selected={selectedSaved === tmpl.id}
                      onSelect={() => {
                        setSelectedSaved(tmpl.id);
                        setSelectedBuiltin(null);
                      }}
                      onDoubleClick={() => applySaved(tmpl.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </main>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
          <p className="text-sm text-gray-500 truncate mr-4">
            {hasSelection ? (
              <>
                Selected:{' '}
                <span className="font-medium text-gray-700">{selectedName}</span>
              </>
            ) : (
              'No template selected'
            )}
          </p>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUseTemplate}
              disabled={!hasSelection}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Use Template →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
