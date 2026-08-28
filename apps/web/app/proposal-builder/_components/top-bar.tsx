'use client';

import { useState } from 'react';
import { ArrowLeft, FileText, FileImage, Save, Loader2, ChevronDown, Layers, Image as ImageIcon, PenLine, Plus, X, Pencil } from 'lucide-react';
import Link from 'next/link';

interface QuoteTemplate {
  id: string;
  name: string;
  isDefault: boolean;
  summaryType?: string | null;
}

export type BuilderMode = 'blocks' | 'branding';
export type PreviewMode = 'html' | 'pdf';

const SUMMARY_TYPE_OPTIONS = [
  { value: '', label: 'Universal — works with all summaries' },
  { value: 'tischler', label: 'Tischler Fensterwerk Summary' },
  { value: 'arcadia', label: 'Arcadia Summary' },
];

interface Props {
  templates: QuoteTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (id: string) => void;
  onCreateTemplate: (name: string, summaryType: string | null) => Promise<void>;
  onUpdateTemplate: (id: string, name: string, summaryType: string | null) => Promise<void>;
  summaries: { id?: string; name?: string; summaryType?: string }[];
  selectedSummaryId: string;
  onSelectSummary: (id: string) => void;
  onPreviewPDF: () => void;
  isPreviewingPDF: boolean;
  onHardEdit: () => void;
  canHardEdit: boolean;
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
  onCreateTemplate,
  onUpdateTemplate,
  summaries,
  selectedSummaryId,
  onSelectSummary,
  onPreviewPDF,
  isPreviewingPDF,
  onHardEdit,
  canHardEdit,
  onSave,
  saving,
  canSave,
  isDirty = false,
  mode,
  onChangeMode,
  previewMode,
  onChangePreviewMode,
}: Props) {
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSummaryType, setNewSummaryType] = useState<string>('');
  const [editName, setEditName] = useState('');
  const [editSummaryType, setEditSummaryType] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Filter summaries to match the selected template's summaryType.
  // Universal templates (null/empty) show all summaries.
  const filteredSummaries = selectedTemplate?.summaryType
    ? summaries.filter((s) => !s.summaryType || s.summaryType === selectedTemplate.summaryType)
    : summaries;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await onCreateTemplate(newName.trim(), newSummaryType || null);
      setShowNewModal(false);
      setNewName('');
      setNewSummaryType('');
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = () => {
    if (!selectedTemplate) return;
    setEditName(selectedTemplate.name);
    setEditSummaryType(selectedTemplate.summaryType || '');
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!selectedTemplateId || !editName.trim()) return;
    setUpdating(true);
    try {
      await onUpdateTemplate(selectedTemplateId, editName.trim(), editSummaryType || null);
      setShowEditModal(false);
    } finally {
      setUpdating(false);
    }
  };

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

      {/* Template selector + New + Edit buttons */}
      <div className="flex items-center gap-1.5">
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
        <button
          onClick={() => setShowNewModal(true)}
          title="Create new template"
          className="flex items-center justify-center w-6 h-6 rounded bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        {selectedTemplateId && (
          <button
            onClick={openEditModal}
            title="Edit template name / summary type"
            className="flex items-center justify-center w-6 h-6 rounded bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* New Template modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">New Template</h2>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewModal(false); }}
                  placeholder="e.g. Arcadia Quote Letter"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type (optional)</label>
                <select
                  value={newSummaryType}
                  onChange={(e) => setNewSummaryType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/30 focus:outline-none bg-white"
                >
                  <option value="">Universal — works with all summaries</option>
                  <option value="tischler">Tischler Fensterwerk Summary</option>
                  <option value="arcadia">Arcadia Summary</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || creating}
                  className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowEditModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-80 text-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Edit Template</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setShowEditModal(false); }}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Summary Type</label>
                <select
                  value={editSummaryType}
                  onChange={(e) => setEditSummaryType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/30 focus:outline-none bg-white"
                >
                  {SUMMARY_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                <button
                  onClick={handleUpdate}
                  disabled={!editName.trim() || updating}
                  className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  {updating ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary selector — filtered to match the selected template's summaryType */}
      <div className="relative">
        <select
          value={selectedSummaryId}
          onChange={(e) => onSelectSummary(e.target.value)}
          className="appearance-none pl-3 pr-7 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/30"
        >
          {filteredSummaries.length === 0 ? (
            <option value="" className="text-gray-900">No matching summaries</option>
          ) : (
            filteredSummaries.map((s) => (
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
        onClick={onHardEdit}
        disabled={!canHardEdit}
        title={canHardEdit ? 'Open an editable copy of this proposal' : 'Select a summary first'}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-white/30 rounded-lg text-white hover:bg-white/10 transition-colors disabled:opacity-40"
      >
        <PenLine className="w-3.5 h-3.5" />
        Hard Edit
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
