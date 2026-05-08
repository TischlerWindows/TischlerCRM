'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ScrollText,
  Plus,
  GripVertical,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  X,
  Eye,
  EyeOff,
  FileText,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { getSetting } from '@/lib/preferences';
import { assembleProposal } from '@/lib/proposal-assembly';
import { CONDITION_FIELD_DEFINITIONS } from '@/lib/quote-conditions';
import { generateTemplatePreviewPDF } from '@/lib/quote-pdf-renderer';

// ── Types ──────────────────────────────────────────────────────────

interface SpecCondition {
  id: string;
  field: string;
  operator: 'CONTAINS' | 'EQUALS' | 'NOT_EMPTY' | 'IS_TRUE' | 'IS_FALSE';
  value: string | null;
  logic: 'AND' | 'OR';
}

interface SpecPreset {
  id: string;
  templateId: string;
  order: number;
  title: string;
  body: string;
  section: 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'BOILERPLATE';
  isAlwaysIncluded: boolean;
  isActive: boolean;
  conditions: SpecCondition[];
}

interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  presets?: SpecPreset[];
  _count?: { presets: number };
}

// Draft condition for the editor (may not have a real ID yet)
interface DraftCondition {
  _key: string; // local key for React list
  field: string;
  operator: 'CONTAINS' | 'EQUALS' | 'NOT_EMPTY' | 'IS_TRUE' | 'IS_FALSE';
  value: string | null;
  logic: 'AND' | 'OR';
}

// ── Constants ──────────────────────────────────────────────────────

const SECTIONS = ['BOILERPLATE', 'SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION'] as const;

const SECTION_COLORS: Record<string, string> = {
  BOILERPLATE: 'bg-slate-100 text-slate-700',
  SPECIFICATION: 'bg-blue-100 text-blue-700',
  OPTION: 'bg-amber-100 text-amber-700',
  EXCLUSION: 'bg-red-100 text-red-700',
  INSTALLATION: 'bg-green-100 text-green-700',
};

const CONDITION_FIELDS = CONDITION_FIELD_DEFINITIONS;

const OPERATORS = [
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EMPTY', label: 'Not Empty' },
  { value: 'IS_TRUE', label: 'Is True' },
  { value: 'IS_FALSE', label: 'Is False' },
];

// Operators that don't need a value input
const NO_VALUE_OPERATORS = ['NOT_EMPTY', 'IS_TRUE', 'IS_FALSE'];

// ── Helpers ────────────────────────────────────────────────────────

let _keyCounter = 0;
function nextKey(): string {
  return `dk_${++_keyCounter}`;
}

function conditionToDraft(c: SpecCondition): DraftCondition {
  return { _key: nextKey(), field: c.field, operator: c.operator, value: c.value, logic: c.logic };
}

function emptyDraftCondition(): DraftCondition {
  return { _key: nextKey(), field: 'hasWindows', operator: 'IS_TRUE', value: null, logic: 'AND' };
}

// ── Component ──────────────────────────────────────────────────────

export default function QuoteBuilderPage() {
  // Template state
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [presets, setPresets] = useState<SpecPreset[]>([]);

  // Editor state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSection, setEditSection] = useState<typeof SECTIONS[number]>('SPECIFICATION');
  const [editAlwaysIncluded, setEditAlwaysIncluded] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editConditions, setEditConditions] = useState<DraftCondition[]>([]);
  const [isNewPreset, setIsNewPreset] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showNewTemplateInput, setShowNewTemplateInput] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedPreviewSummaryId, setSelectedPreviewSummaryId] = useState<string>('');

  // ── Data fetching ──────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiClient.get<QuoteTemplate[]>('/quote-templates');
      setTemplates(data);
      return data;
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      return [];
    }
  }, []);

  const loadPresets = useCallback(async (templateId: string) => {
    try {
      const data = await apiClient.get<SpecPreset[]>(`/spec-presets?templateId=${templateId}`);
      setPresets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load proposal blocks');
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      const data = await loadTemplates();
      // Auto-select the default template (or first one)
      const def = data.find((t) => t.isDefault) || data[0];
      if (def) {
        setSelectedTemplateId(def.id);
        await loadPresets(def.id);
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const storedSummaries = (await getSetting<any[]>('summaries', [])) ?? [];
      setSummaries(storedSummaries);
      if (storedSummaries.length > 0) {
        setSelectedPreviewSummaryId((current) => current || storedSummaries[0].id || '');
      }
    })();
  }, []);

  // ── Template actions ───────────────────────────────────────────

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      const created = await apiClient.post<QuoteTemplate>('/quote-templates', {
        name: newTemplateName.trim(),
        isDefault: templates.length === 0,
      });
      setNewTemplateName('');
      setShowNewTemplateInput(false);
      const data = await loadTemplates();
      setSelectedTemplateId(created.id);
      await loadPresets(created.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create template');
    }
  };

  const handleSelectTemplate = async (id: string) => {
    setSelectedTemplateId(id);
    setSelectedPresetId(null);
    clearEditor();
    await loadPresets(id);
  };

  // ── Preset editor helpers ──────────────────────────────────────

  const clearEditor = () => {
    setSelectedPresetId(null);
    setIsNewPreset(false);
    setEditTitle('');
    setEditBody('');
    setEditSection('SPECIFICATION');
    setEditAlwaysIncluded(false);
    setEditActive(true);
    setEditConditions([]);
  };

  const loadPresetIntoEditor = (preset: SpecPreset) => {
    setSelectedPresetId(preset.id);
    setIsNewPreset(false);
    setEditTitle(preset.title);
    setEditBody(preset.body);
    setEditSection(preset.section);
    setEditAlwaysIncluded(preset.isAlwaysIncluded);
    setEditActive(preset.isActive);
    setEditConditions(preset.conditions.map(conditionToDraft));
  };

  const handleNewPreset = () => {
    setSelectedPresetId(null);
    setIsNewPreset(true);
    setEditTitle('');
    setEditBody('');
    setEditSection('SPECIFICATION');
    setEditAlwaysIncluded(false);
    setEditActive(true);
    setEditConditions([]);
  };

  // ── Save / Delete ──────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedTemplateId || !editTitle.trim()) return;
    setSaving(true);
    setError(null);

    const conditionsPayload = editConditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: NO_VALUE_OPERATORS.includes(c.operator) ? null : (c.value || null),
      logic: c.logic,
    }));

    const missingValueCondition = conditionsPayload.find(
      (condition) =>
        (condition.operator === 'CONTAINS' || condition.operator === 'EQUALS') &&
        !condition.value?.trim()
    );
    if (missingValueCondition) {
      setSaving(false);
      setError(`${missingValueCondition.operator} conditions require a value.`);
      return;
    }

    try {
      if (isNewPreset) {
        const newPreset = await apiClient.post<SpecPreset>('/spec-presets', {
          templateId: selectedTemplateId,
          order: presets.length,
          title: editTitle.trim(),
          body: editBody,
          section: editSection,
          isAlwaysIncluded: editAlwaysIncluded,
          isActive: editActive,
          conditions: conditionsPayload,
        });
        setIsNewPreset(false);
        setSelectedPresetId(newPreset.id);
        await loadPresets(selectedTemplateId);
        flash('Proposal block created');
      } else if (selectedPresetId) {
        await apiClient.patch<SpecPreset>(`/spec-presets/${selectedPresetId}`, {
          title: editTitle.trim(),
          body: editBody,
          section: editSection,
          isAlwaysIncluded: editAlwaysIncluded,
          isActive: editActive,
          conditions: conditionsPayload,
        });
        await loadPresets(selectedTemplateId);
        flash('Proposal block saved');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save proposal block');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPresetId || !selectedTemplateId) return;
    if (!confirm('Delete this proposal block? This cannot be undone.')) return;

    try {
      await apiClient.delete(`/spec-presets/${selectedPresetId}`);
      clearEditor();
      await loadPresets(selectedTemplateId);
      flash('Proposal block deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete proposal block');
    }
  };

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // ── Drag-to-reorder ────────────────────────────────────────────

  const handleDragStart = (idx: number) => setDragIdx(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;

    const reordered = [...presets];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(idx, 0, moved);
    // Renumber orders (immutable — create new objects to avoid mutating state)
    const updated = reordered.map((p, i) => ({ ...p, order: i }));
    setPresets(updated);
    setDragIdx(idx);
  };

  const handleDragEnd = async () => {
    setDragIdx(null);
    if (!selectedTemplateId) return;
    try {
      await apiClient.patch('/spec-presets/reorder', presets.map((p) => ({ id: p.id, order: p.order })));
    } catch (err: any) {
      setError(err.message || 'Failed to reorder proposal blocks');
      await loadPresets(selectedTemplateId);
    }
  };

  // ── Condition editor helpers ───────────────────────────────────

  const addCondition = () => setEditConditions((prev) => [...prev, emptyDraftCondition()]);

  const removeCondition = (key: string) =>
    setEditConditions((prev) => prev.filter((c) => c._key !== key));

  const updateCondition = (key: string, patch: Partial<DraftCondition>) =>
    setEditConditions((prev) =>
      prev.map((c) => (c._key === key ? { ...c, ...patch } : c))
    );

  // ── Template PDF preview ───────────────────────────────────────

  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);

  const handlePreviewTemplatePDF = async () => {
    if (presets.length === 0) {
      setError('No blocks to preview. Create some blocks first.');
      return;
    }
    setIsPreviewingPDF(true);
    setError(null);
    // Open window before async work to avoid popup blocker
    const previewWindow = window.open('', '_blank');
    try {
      await generateTemplatePreviewPDF(
        presets.map((p) => ({
          ...p,
          conditions: p.conditions.map((c) => ({ ...c })),
        })),
        previewWindow
      );
    } catch (err: any) {
      previewWindow?.close();
      setError(err.message || 'Failed to generate template preview');
    } finally {
      setIsPreviewingPDF(false);
    }
  };

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
  const selectedPreviewSummary = summaries.find((summary) => summary.id === selectedPreviewSummaryId);
  const previewState = useMemo(() => {
    if (!selectedTemplateId || !selectedPreviewSummary) return { result: null, error: null };
    try {
      return {
        result: assembleProposal({
          summary: selectedPreviewSummary as any,
          template: {
            id: selectedTemplateId,
            name: selectedTemplate?.name ?? 'Selected proposal template',
            presets: presets as any,
          },
        }),
        error: null,
      };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err.message : 'Unable to assemble preview.',
      };
    }
  }, [selectedPreviewSummary, selectedTemplate?.name, selectedTemplateId, presets]);
  const previewResult = previewState.result;

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SettingsPageHeader
        icon={ScrollText}
        title="Proposal Builder"
        subtitle="Manage proposal clauses, variables, and conditions"
        action={{ label: 'New Block', onClick: handleNewPreset }}
      />

      {/* Template preview + actions bar */}
      <div className="mx-8 mt-3 flex items-center gap-3">
        <button
          onClick={handlePreviewTemplatePDF}
          disabled={isPreviewingPDF || presets.length === 0}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-brand-navy/30 rounded-lg text-brand-navy bg-white hover:bg-brand-navy/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FileText className="w-4 h-4" />
          {isPreviewingPDF ? 'Generating...' : 'Preview Template PDF'}
        </button>
        <span className="text-xs text-gray-400">
          Shows the full quote layout with {'{{variable}}'} placeholders and all active blocks included
        </span>
      </div>

      {/* Error / success banners */}
      {error && (
        <div className="mx-8 mt-4 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mx-8 mt-4 px-4 py-2.5 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
          {successMsg}
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 min-h-0 mx-8 mt-4 mb-6 gap-5">
        {/* ── Left panel: template selector + preset list ── */}
        <div className="w-[340px] flex-shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {/* Template selector */}
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5 block">
              Template
            </label>
            {showNewTemplateInput ? (
              <div className="flex gap-2">
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
                  placeholder="Template name..."
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  autoFocus
                />
                <button
                  onClick={handleCreateTemplate}
                  className="px-3 py-1.5 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewTemplateInput(false); setNewTemplateName(''); }}
                  className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select
                    value={selectedTemplateId || ''}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    className="w-full appearance-none px-3 py-1.5 pr-8 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={() => setShowNewTemplateInput(true)}
                  className="px-2 py-1.5 text-gray-500 hover:text-brand-navy transition-colors"
                  title="New template"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Preset list */}
          <div className="flex-1 overflow-y-auto">
            {presets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <ScrollText className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No proposal blocks yet</p>
                <button
                  onClick={handleNewPreset}
                  className="mt-3 text-sm text-brand-navy font-semibold hover:underline"
                >
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
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => loadPresetIntoEditor(preset)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#ede9f5] border-l-[3px] border-l-brand-red'
                        : 'hover:bg-gray-50'
                    } ${!preset.isActive ? 'opacity-50' : ''}`}
                  >
                    <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0 cursor-grab" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-400 tabular-nums w-5 text-right">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {preset.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 ml-7">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SECTION_COLORS[preset.section] || ''}`}>
                          {preset.section}
                        </span>
                        {preset.isAlwaysIncluded && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                            Always
                          </span>
                        )}
                        {preset.conditions.length > 0 && (
                          <span className="text-[10px] text-gray-400">
                            {preset.conditions.length} condition{preset.conditions.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {!preset.isActive && (
                      <EyeOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right panel: preset editor ── */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {!selectedPresetId && !isNewPreset ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a proposal block to edit or create a new one
            </div>
          ) : (
            <>
              {/* Editor header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">
                  {isNewPreset ? 'New Proposal Block' : 'Edit Proposal Block'}
                </h3>
                <div className="flex items-center gap-2">
                  {!isNewPreset && (
                    <button
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !editTitle.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>

              {/* Editor body (scrollable) */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Title</label>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g., Glass Specification"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                </div>

                {/* Section type */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Section</label>
                  <div className="flex flex-wrap gap-2">
                    {SECTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setEditSection(s)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          editSection === s
                            ? 'border-brand-navy bg-brand-navy text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">
                    Body Text
                    <span className="font-normal text-gray-400 ml-1.5">
                      Use {'{{tokenName}}'} for placeholders
                    </span>
                  </label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={8}
                    placeholder="All windows and doors shall be glazed with {{glassType}} glass..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20 font-mono resize-y"
                  />
                </div>

                {/* Toggles row */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAlwaysIncluded}
                      onChange={(e) => setEditAlwaysIncluded(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy/20"
                    />
                    <span className="text-sm text-gray-700">Always included</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy/20"
                    />
                    <span className="text-sm text-gray-700 flex items-center gap-1">
                      {editActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Active
                    </span>
                  </label>
                </div>

                {/* Conditions */}
                {!editAlwaysIncluded && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-gray-600">Conditions</label>
                      <button
                        onClick={addCondition}
                        className="text-xs text-brand-navy font-semibold hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Add Condition
                      </button>
                    </div>

                    {editConditions.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">
                        No conditions — this block will be excluded unless &quot;Always included&quot; is turned on.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {editConditions.map((cond, idx) => (
                          <div
                            key={cond._key}
                            className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            {/* Logic selector (AND/OR) — hidden for first condition */}
                            {idx > 0 ? (
                              <select
                                value={cond.logic}
                                onChange={(e) => updateCondition(cond._key, { logic: e.target.value as 'AND' | 'OR' })}
                                className="w-16 text-xs font-semibold px-2 py-1 border border-gray-300 rounded bg-white"
                              >
                                <option value="AND">AND</option>
                                <option value="OR">OR</option>
                              </select>
                            ) : (
                              <span className="w-16 text-xs font-semibold text-gray-400 text-center">
                                Where
                              </span>
                            )}

                            {/* Field */}
                            <select
                              value={cond.field}
                              onChange={(e) => updateCondition(cond._key, { field: e.target.value })}
                              className="flex-1 min-w-0 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                            >
                              {CONDITION_FIELDS.map((f) => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>

                            {/* Operator */}
                            <select
                              value={cond.operator}
                              onChange={(e) => updateCondition(cond._key, { operator: e.target.value as any })}
                              className="w-28 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                            >
                              {OPERATORS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>

                            {/* Value (only for CONTAINS/EQUALS) */}
                            {!NO_VALUE_OPERATORS.includes(cond.operator) && (
                              <input
                                value={cond.value || ''}
                                onChange={(e) => updateCondition(cond._key, { value: e.target.value })}
                                placeholder="value"
                                className="w-32 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                              />
                            )}

                            {/* Remove */}
                            <button
                              onClick={() => removeCondition(cond._key)}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Preview panel ── */}
        <div className="w-[380px] flex-shrink-0 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Proposal Preview</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">See variables, included blocks, and warnings.</p>
              </div>
              <Eye className="w-4 h-4 text-gray-400" />
            </div>
            <select
              value={selectedPreviewSummaryId}
              onChange={(e) => setSelectedPreviewSummaryId(e.target.value)}
              className="mt-3 w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            >
              {summaries.length === 0 ? (
                <option value="">No saved summaries</option>
              ) : (
                summaries.map((summary) => (
                  <option key={summary.id || summary.name} value={summary.id || ''}>
                    {summary.name || 'Untitled summary'}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!previewResult ? (
              previewState.error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Preview could not be assembled: {previewState.error}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-500">
                  Select a saved summary to preview how this template assembles a proposal.
                </div>
              )
            ) : (
              <>
                {previewResult.warnings.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-800 mb-1">Warnings</div>
                    <ul className="space-y-1 text-xs text-amber-800">
                      {previewResult.warnings.map((warning, idx) => (
                        <li key={`${warning}-${idx}`}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">Resolved Variables</div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {Object.entries(previewResult.tokens).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-3 rounded-md bg-gray-50 px-2 py-1.5">
                        <span className="font-mono text-[11px] text-brand-navy">{`{{${key}}}`}</span>
                        <span className="text-[11px] text-gray-700 text-right break-words">{value || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    Included Blocks ({previewResult.includedBlocks.length})
                  </div>
                  <div className="space-y-1.5">
                    {previewResult.includedBlocks.map((block) => (
                      <div key={block.id} className="rounded-md border border-green-100 bg-green-50 px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SECTION_COLORS[block.section] || ''}`}>
                            {block.section}
                          </span>
                          <span className="text-xs font-medium text-gray-900 truncate">{block.title}</span>
                        </div>
                        <p className="text-[11px] text-green-700 mt-1">{block.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">
                    Excluded Blocks ({previewResult.excludedBlocks.length})
                  </div>
                  <div className="space-y-1.5">
                    {previewResult.excludedBlocks.map((block) => (
                      <div key={block.id} className="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2">
                        <div className="text-xs font-medium text-gray-700 truncate">{block.title}</div>
                        <p className="text-[11px] text-gray-500 mt-1">{block.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">Rendered Text</div>
                  <div className="space-y-3 rounded-lg border border-gray-200 p-3">
                    {SECTIONS.map((section) => (
                      previewResult.sections[section].length > 0 && (
                        <div key={section}>
                          <div className="text-[10px] font-bold tracking-wide text-gray-400 mb-1">{section}</div>
                          {previewResult.sections[section].map((block) => (
                            <div key={block.id} className="mb-2">
                              <div className="text-xs font-semibold text-gray-900">{block.title}</div>
                              <p className="text-[11px] text-gray-700 whitespace-pre-wrap leading-relaxed">{block.body}</p>
                            </div>
                          ))}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
