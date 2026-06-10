'use client';

import { ArrowLeft, FileText, FileImage, Save, Loader2, ChevronDown, Layers, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

interface QuoteTemplate {
  id: string;
  name: string;
  isDefault: boolean;
}

export type BuilderMode = 'blocks' | 'branding';
export type PreviewMode = 'html' | 'pdf';

interface Props {
  templates: QuoteTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  summaries: { id?: string; name?: string }[];
  selectedSummaryId: string;
  onSelectSummary: (id: string) => void;
  onPreviewPDF: () => void;
  isPreviewingPDF: boolean;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
  isDirty?: boolean;
  mode: BuilderMode;
  onChangeMode: (m: BuilderMode) => void;
  previewMode: PreviewMode;
  onChangePreviewMode: (m: PreviewMode) => void;
}

export function TopBar({
  templates,
  selectedTemplateId,
  onSelectTemplate,
  summaries,
  selectedSummaryId,
  onSelectSummary,
  onPreviewPDF,
  isPreviewingPDF,
  onSave,
  saving,
  canSave,
  isDirty = false,
  mode,
  onChangeMode,
  previewMode,
  onChangePreviewMode,
}: Props) {

  return (
    <div className="flex items-center gap-4 px-5 py-2.5 bg-[#1e3a5f] text-white">
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Settings
      </Link>

      <div className="h-5 w-px bg-white/20" />

      <span className="text-sm font-semibold">Proposal Builder</span>

      <div className="h-5 w-px bg-white/20" />

      {/* Template selector */}
      <div className="relative">
        <select
          value={selectedTemplateId || ''}
          onChange={(e) => onSelectTemplate(e.target.value)}
          className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id} className="text-gray-900">
              {t.name} {t.isDefault ? '(Default)' : ''}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
      </div>

      {/* Summary selector */}
      <div className="relative">
        <select
          value={selectedSummaryId}
          onChange={(e) => onSelectSummary(e.target.value)}
          className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          {summaries.length === 0 ? (
            <option value="" className="text-gray-900">No summaries</option>
          ) : (
            summaries.map((s) => (
              <option key={s.id || s.name} value={s.id || ''} className="text-gray-900">
                {s.name || 'Untitled'}
              </option>
            ))
          )}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/60 pointer-events-none" />
      </div>

      <div role="tablist" aria-label="Builder mode" className="inline-flex items-center rounded-lg border border-white/20 bg-white/5 p-0.5 text-xs">
        <button
          role="tab"
          aria-selected={mode === 'blocks'}
          onClick={() => onChangeMode('blocks')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
            mode === 'blocks' ? 'bg-white text-[#1e3a5f] font-semibold' : 'text-white/80 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" aria-hidden="true" />
          Blocks
        </button>
        <button
          role="tab"
          aria-selected={mode === 'branding'}
          onClick={() => onChangeMode('branding')}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
            mode === 'branding' ? 'bg-white text-[#1e3a5f] font-semibold' : 'text-white/80 hover:text-white'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
          Branding
        </button>
      </div>

      {mode === 'blocks' && (
        <div
          role="tablist"
          aria-label="Preview type"
          className="inline-flex items-center rounded-lg border border-white/20 bg-white/5 p-0.5 text-xs"
        >
          <button
            role="tab"
            aria-selected={previewMode === 'html'}
            onClick={() => onChangePreviewMode('html')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              previewMode === 'html'
                ? 'bg-white text-[#1e3a5f] font-semibold'
                : 'text-white/80 hover:text-white'
            }`}
            title="Fast HTML preview"
          >
            <FileImage className="w-3.5 h-3.5" aria-hidden="true" />
            HTML
          </button>
          <button
            role="tab"
            aria-selected={previewMode === 'pdf'}
            onClick={() => onChangePreviewMode('pdf')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors ${
              previewMode === 'pdf'
                ? 'bg-white text-[#1e3a5f] font-semibold'
                : 'text-white/80 hover:text-white'
            }`}
            title="True PDF — exact what the customer will see (slower)"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            True PDF
          </button>
        </div>
      )}

      <div className="flex-1" />

      {isDirty ? (
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-amber-200 bg-amber-500/20 border border-amber-300/40 rounded"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Unsaved changes
        </span>
      ) : null}

      <button
        onClick={onPreviewPDF}
        disabled={isPreviewingPDF}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        <FileText className="w-3.5 h-3.5" />
        {isPreviewingPDF ? 'Generating...' : 'Preview PDF'}
      </button>

      <button
        onClick={onSave}
        disabled={saving || !canSave}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-white text-[#1e3a5f] rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save
      </button>
    </div>
  );
}
