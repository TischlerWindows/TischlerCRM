'use client';

import { ArrowLeft, FileText, Save, Loader2, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface QuoteTemplate {
  id: string;
  name: string;
  isDefault: boolean;
}

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

      <div className="flex-1" />

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
