'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getSetting } from '@/lib/preferences';
import { assembleProposal } from '@/lib/proposal-assembly';
import type { SpecPresetData } from '@/lib/quote-conditions';
import { generateTemplatePreviewPDF } from '@/lib/quote-pdf-renderer';

import { TopBar } from './_components/top-bar';
import { BlockList } from './_components/block-list';
import { VariableChips } from './_components/variable-chips';
import { LetterPreview } from './_components/letter-preview';
import { BlockEditor } from './_components/block-editor';
import { NewTokenModal } from './_components/new-token-modal';
import {
  conditionToDraft,
  conditionsPayload,
  validateConditions,
  type DraftCondition,
} from './_components/condition-builder';
import {
  variantToDraft,
  variantsPayload,
  emptyDraftVariant,
  type DraftVariant,
} from './_components/variant-editor';

interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
}

interface TokenMappingData {
  id: string;
  tokenName: string;
  label: string;
  category: string;
  sourceObject: string;
  sourcePath: string;
  format: string;
}

export default function QuoteBuilderPage() {
  // Template state
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [presets, setPresets] = useState<SpecPresetData[]>([]);

  // Token mappings
  const [tokenMappings, setTokenMappings] = useState<TokenMappingData[]>([]);
  const [tokenGrouped, setTokenGrouped] = useState<Record<string, TokenMappingData[]>>({});
  const [showNewTokenModal, setShowNewTokenModal] = useState(false);

  // Editor state
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editSection, setEditSection] = useState<SpecPresetData['section']>('SPECIFICATION');
  const [editAlwaysIncluded, setEditAlwaysIncluded] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editDriverField, setEditDriverField] = useState('');
  const [editConditions, setEditConditions] = useState<DraftCondition[]>([]);
  const [editVariants, setEditVariants] = useState<DraftVariant[]>([]);
  const [isNewPreset, setIsNewPreset] = useState(false);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState('');
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);

  const bodyTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
      const data = await apiClient.get<SpecPresetData[]>(`/spec-presets?templateId=${templateId}`);
      setPresets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load proposal blocks');
    }
  }, []);

  const loadTokenMappings = useCallback(async (templateId: string) => {
    try {
      const data = await apiClient.get<{ mappings: TokenMappingData[]; grouped: Record<string, TokenMappingData[]> }>(
        `/token-mappings?templateId=${templateId}`
      );
      setTokenMappings(data.mappings);
      setTokenGrouped(data.grouped);
    } catch {
      // Token mappings are optional — no error shown
      setTokenMappings([]);
      setTokenGrouped({});
    }
  }, []);

  useEffect(() => {
    (async () => {
      const data = await loadTemplates();
      const def = data.find((t) => t.isDefault) || data[0];
      if (def) {
        setSelectedTemplateId(def.id);
        await Promise.all([loadPresets(def.id), loadTokenMappings(def.id)]);
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const stored = (await getSetting<any[]>('summaries', [])) ?? [];
      setSummaries(stored);
      if (stored.length > 0) setSelectedSummaryId((c) => c || stored[0].id || '');
    })();
  }, []);

  // ── Editor helpers ────────────────────────────────────────────

  const clearEditor = () => {
    setSelectedPresetId(null);
    setIsNewPreset(false);
    setEditTitle('');
    setEditBody('');
    setEditSection('SPECIFICATION');
    setEditAlwaysIncluded(false);
    setEditActive(true);
    setEditDriverField('');
    setEditConditions([]);
    setEditVariants([]);
  };

  const loadPresetIntoEditor = (preset: SpecPresetData) => {
    setSelectedPresetId(preset.id);
    setIsNewPreset(false);
    setEditTitle(preset.title);
    setEditBody(preset.body ?? '');
    setEditSection(preset.section);
    setEditAlwaysIncluded(preset.isAlwaysIncluded);
    setEditActive(preset.isActive);
    setEditDriverField(preset.driverField || '');
    setEditConditions(preset.conditions.map(conditionToDraft));
    setEditVariants((preset.variants || []).map(variantToDraft));
  };

  const handleNewPreset = () => {
    setSelectedPresetId(null);
    setIsNewPreset(true);
    setEditTitle('');
    setEditBody('');
    setEditSection('SPECIFICATION');
    setEditAlwaysIncluded(false);
    setEditActive(true);
    setEditDriverField('');
    setEditConditions([]);
    setEditVariants([]);
  };

  const handleSelectTemplate = async (id: string) => {
    setSelectedTemplateId(id);
    clearEditor();
    await Promise.all([loadPresets(id), loadTokenMappings(id)]);
  };

  const handleSelectBlock = (id: string) => {
    const preset = presets.find((p) => p.id === id);
    if (preset) loadPresetIntoEditor(preset);
  };

  const handleInsertToken = (tokenName: string) => {
    const textarea = bodyTextareaRef.current;
    if (!textarea || editDriverField) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = `{{${tokenName}}}`;
    const newBody = editBody.slice(0, start) + text + editBody.slice(end);
    setEditBody(newBody);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
  };

  // ── Save / Delete ─────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedTemplateId || !editTitle.trim()) return;
    setSaving(true);
    setError(null);

    const conds = conditionsPayload(editConditions);
    const condError = validateConditions(conds);
    if (condError) {
      setSaving(false);
      setError(condError);
      return;
    }

    const isVariantMode = !!editDriverField;
    const vars = isVariantMode ? variantsPayload(editVariants) : [];

    const payload: Record<string, unknown> = {
      title: editTitle.trim(),
      body: isVariantMode ? null : editBody,
      section: editSection,
      isAlwaysIncluded: editAlwaysIncluded,
      isActive: editActive,
      driverField: editDriverField || null,
      conditions: conds,
      variants: vars,
    };

    try {
      if (isNewPreset) {
        const created = await apiClient.post<SpecPresetData>('/spec-presets', {
          ...payload,
          templateId: selectedTemplateId,
          order: presets.length,
        });
        setIsNewPreset(false);
        setSelectedPresetId(created.id);
        await loadPresets(selectedTemplateId);
        flash('Block created');
      } else if (selectedPresetId) {
        await apiClient.patch<SpecPresetData>(`/spec-presets/${selectedPresetId}`, payload);
        await loadPresets(selectedTemplateId);
        flash('Block saved');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPresetId || !selectedTemplateId) return;
    if (!confirm('Delete this block? This cannot be undone.')) return;
    try {
      await apiClient.delete(`/spec-presets/${selectedPresetId}`);
      clearEditor();
      await loadPresets(selectedTemplateId);
      flash('Block deleted');
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const flash = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // ── Drag reorder ──────────────────────────────────────────────

  const handleReorder = (reordered: SpecPresetData[]) => {
    setPresets(reordered);
    setDragIdx(reordered.findIndex((p) => p.id === presets[dragIdx!]?.id));
  };

  const handleReorderEnd = async () => {
    setDragIdx(null);
    if (!selectedTemplateId) return;
    try {
      await apiClient.patch('/spec-presets/reorder', presets.map((p) => ({ id: p.id, order: p.order })));
    } catch (err: any) {
      setError(err.message || 'Failed to reorder');
      await loadPresets(selectedTemplateId);
    }
  };

  // ── Template PDF preview ──────────────────────────────────────

  const handlePreviewPDF = async () => {
    if (presets.length === 0) { setError('No blocks to preview.'); return; }
    setIsPreviewingPDF(true);
    setError(null);
    const win = window.open('', '_blank');
    try {
      await generateTemplatePreviewPDF(
        presets.map((p) => ({ ...p, body: p.body ?? '', conditions: p.conditions.map((c) => ({ ...c })) })),
        win
      );
    } catch (err: any) {
      win?.close();
      setError(err.message || 'Failed to generate preview');
    } finally {
      setIsPreviewingPDF(false);
    }
  };

  // ── Token creation ────────────────────────────────────────────

  const handleCreateToken = async (data: {
    tokenName: string;
    sourceObject: string;
    sourcePath: string;
    format: string;
    label: string;
    category: string;
  }) => {
    if (!selectedTemplateId) throw new Error('No template selected');
    await apiClient.post('/token-mappings', { ...data, templateId: selectedTemplateId });
    await loadTokenMappings(selectedTemplateId);
  };

  // ── Driver field change handler ───────────────────────────────

  const handleDriverFieldChange = (value: string) => {
    if (value && !editDriverField && editBody && editVariants.length === 0) {
      setEditVariants([{ ...emptyDraftVariant(0), body: editBody }]);
    }
    if (!value && editDriverField && editVariants.length > 0 && !editBody) {
      setEditBody(editVariants[0]?.body || '');
    }
    setEditDriverField(value);
  };

  // ── Preview assembly ──────────────────────────────────────────

  const selectedSummary = summaries.find((s) => s.id === selectedSummaryId);
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const previewState = useMemo(() => {
    if (!selectedTemplateId || !selectedSummary) return { result: null, error: null };
    try {
      return {
        result: assembleProposal({
          summary: selectedSummary as any,
          template: {
            id: selectedTemplateId,
            name: selectedTemplate?.name ?? '',
            presets: presets as any,
          },
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Preview failed.' };
    }
  }, [selectedSummary, selectedTemplate?.name, selectedTemplateId, presets]);

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  const canSave = !!(editTitle.trim() && (selectedPresetId || isNewPreset));

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <TopBar
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={handleSelectTemplate}
        summaries={summaries}
        selectedSummaryId={selectedSummaryId}
        onSelectSummary={setSelectedSummaryId}
        onPreviewPDF={handlePreviewPDF}
        isPreviewingPDF={isPreviewingPDF}
        onSave={handleSave}
        saving={saving}
        canSave={canSave}
      />

      {/* Banners */}
      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {successMsg && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs border border-green-200">
          {successMsg}
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex flex-1 min-h-0 gap-2 p-2">
        {/* Left panel: block list + variable chips */}
        <div className="w-[220px] flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <BlockList
              presets={presets}
              selectedPresetId={selectedPresetId}
              onSelect={loadPresetIntoEditor}
              onNew={handleNewPreset}
              onReorder={handleReorder}
              onReorderEnd={handleReorderEnd}
              dragIdx={dragIdx}
              onDragStart={setDragIdx}
            />
          </div>
          <div className="h-[200px] flex-shrink-0 overflow-hidden">
            <VariableChips
              mappings={tokenMappings}
              grouped={tokenGrouped}
              onInsert={handleInsertToken}
              onNewToken={() => setShowNewTokenModal(true)}
            />
          </div>
        </div>

        {/* Center panel: letter preview */}
        <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex flex-col">
          <LetterPreview
            result={previewState.result}
            error={previewState.error}
            selectedPresetId={selectedPresetId}
            onSelectBlock={handleSelectBlock}
          />
        </div>

        {/* Right panel: block editor */}
        <div className="w-[320px] flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
          {!selectedPresetId && !isNewPreset ? (
            <div className="h-full flex items-center justify-center text-gray-400 text-xs px-6 text-center">
              Select a block to edit, or click + New to create one.
            </div>
          ) : (
            <BlockEditor
              isNew={isNewPreset}
              title={editTitle}
              onTitleChange={setEditTitle}
              body={editBody}
              onBodyChange={setEditBody}
              section={editSection}
              onSectionChange={setEditSection}
              alwaysIncluded={editAlwaysIncluded}
              onAlwaysIncludedChange={setEditAlwaysIncluded}
              active={editActive}
              onActiveChange={setEditActive}
              driverField={editDriverField}
              onDriverFieldChange={handleDriverFieldChange}
              conditions={editConditions}
              onConditionsChange={setEditConditions}
              variants={editVariants}
              onVariantsChange={setEditVariants}
              onDelete={handleDelete}
              bodyTextareaRef={bodyTextareaRef}
            />
          )}
        </div>
      </div>

      <NewTokenModal
        open={showNewTokenModal}
        onClose={() => setShowNewTokenModal(false)}
        onSubmit={handleCreateToken}
      />
    </div>
  );
}
