'use client';

import { useEffect, useState, useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { Loader2, AlertCircle, X, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getSetting } from '@/lib/preferences';
import { assembleProposal } from '@crm/proposal-assembly';
import type { SpecPresetData } from '@crm/proposal-assembly';
import { useResizableSidePanels } from '@/lib/use-resizable-side-panels';
import { useResizableVerticalPanel } from '@/lib/use-resizable-vertical-panel';

import { TopBar } from './_components/top-bar';
import { BlockList } from './_components/block-list';
import { VariableChips } from './_components/variable-chips';
import { LetterPreview } from './_components/letter-preview';
import { LintPanel } from './_components/lint-panel';
import { BlockEditor } from './_components/block-editor';
import { type BodyEditorHandle } from './_components/body-editor';
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

interface EditorSnapshot {
  title: string;
  body: string;
  section: SpecPresetData['section'];
  alwaysIncluded: boolean;
  active: boolean;
  driverField: string;
  conditions: DraftCondition[];
  variants: DraftVariant[];
}

function snapshotsEqual(a: EditorSnapshot | null, b: EditorSnapshot): boolean {
  if (!a) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

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
  sourceObject: 'SUMMARY' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'PROJECT' | 'SYSTEM';
  sourcePath: string;
  format: 'TEXT' | 'CURRENCY' | 'DATE' | 'PHONE' | 'PERCENTAGE';
  isBuiltIn?: boolean;
}

export default function QuoteBuilderPage() {
  // Template state
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [presets, setPresets] = useState<SpecPresetData[]>([]);

  // Token mappings
  const [tokenMappings, setTokenMappings] = useState<TokenMappingData[]>([]);
  const [tokenGrouped, setTokenGrouped] = useState<Record<string, TokenMappingData[]>>({});

  // Linked custom-object records fetched for custom token resolution (Phase 2).
  // Opportunity is looked up via summary.linkedOpportunityId; Project via the
  // most recently updated Project whose `opportunity` Lookup matches.
  const [opportunityRecord, setOpportunityRecord] = useState<Record<string, unknown> | null>(null);
  const [projectRecord, setProjectRecord] = useState<Record<string, unknown> | null>(null);
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
  const [editorBaseline, setEditorBaseline] = useState<EditorSnapshot | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState('');
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);

  // Autosave state
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const bodyEditorRef = useRef<BodyEditorHandle | null>(null);

  // Resizable side panels (shared with page-editor pattern)
  const panels = useResizableSidePanels({
    storageKey: 'proposalBuilder',
    left: { min: 220, max: 520, default: 280 },
    right: { min: 280, max: 600, default: 340 },
  });
  const leftPanel = panels.left!;
  const rightPanel = panels.right!;

  const variablesPanel = useResizableVerticalPanel({
    storageKey: 'proposalBuilder.variablesH',
    min: 140,
    max: 600,
    default: 280,
  });

  const handleVariablesResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        variablesPanel.adjustHeight(16);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        variablesPanel.adjustHeight(-16);
      }
    },
    [variablesPanel],
  );

  const handleLeftResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        leftPanel.adjustWidth(-16);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        leftPanel.adjustWidth(16);
      }
    },
    [leftPanel],
  );

  const handleRightResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        rightPanel.adjustWidth(16);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        rightPanel.adjustWidth(-16);
      }
    },
    [rightPanel],
  );

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

  // Warn before unload when there are unsaved editor changes.
  useEffect(() => {
    const baseline = editorBaseline;
    if (!baseline) return;
    const handler = (e: BeforeUnloadEvent) => {
      const current: EditorSnapshot = {
        title: editTitle,
        body: editBody,
        section: editSection,
        alwaysIncluded: editAlwaysIncluded,
        active: editActive,
        driverField: editDriverField,
        conditions: editConditions,
        variants: editVariants,
      };
      if (snapshotsEqual(baseline, current)) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [
    editorBaseline,
    editTitle,
    editBody,
    editSection,
    editAlwaysIncluded,
    editActive,
    editDriverField,
    editConditions,
    editVariants,
  ]);

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
    setEditorBaseline(null);
  };

  const loadPresetIntoEditor = (preset: SpecPresetData) => {
    const conditions = preset.conditions.map(conditionToDraft);
    const variants = (preset.variants || []).map(variantToDraft);
    setSelectedPresetId(preset.id);
    setIsNewPreset(false);
    setEditTitle(preset.title);
    setEditBody(preset.body ?? '');
    setEditSection(preset.section);
    setEditAlwaysIncluded(preset.isAlwaysIncluded);
    setEditActive(preset.isActive);
    setEditDriverField(preset.driverField || '');
    setEditConditions(conditions);
    setEditVariants(variants);
    setEditorBaseline({
      title: preset.title,
      body: preset.body ?? '',
      section: preset.section,
      alwaysIncluded: preset.isAlwaysIncluded,
      active: preset.isActive,
      driverField: preset.driverField || '',
      conditions,
      variants,
    });
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
    setEditorBaseline({
      title: '',
      body: '',
      section: 'SPECIFICATION',
      alwaysIncluded: false,
      active: true,
      driverField: '',
      conditions: [],
      variants: [],
    });
  };

  const handleDuplicatePreset = (source: SpecPresetData) => {
    const conditions = (source.conditions ?? []).map(conditionToDraft);
    const variants = (source.variants ?? []).map(variantToDraft);
    setSelectedPresetId(null);
    setIsNewPreset(true);
    const title = `${source.title} (copy)`;
    setEditTitle(title);
    setEditBody(source.body ?? '');
    setEditSection(source.section);
    setEditAlwaysIncluded(source.isAlwaysIncluded);
    setEditActive(source.isActive);
    setEditDriverField(source.driverField || '');
    setEditConditions(conditions);
    setEditVariants(variants);
    setEditorBaseline({
      title,
      body: source.body ?? '',
      section: source.section,
      alwaysIncluded: source.isAlwaysIncluded,
      active: source.isActive,
      driverField: source.driverField || '',
      conditions,
      variants,
    });
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
    if (editDriverField) return; // body is replaced by Variants in driver mode
    bodyEditorRef.current?.insertText(`{{${tokenName}}}`);
    flash(`Inserted {{${tokenName}}}`);
  };

  // ── Save / Delete ─────────────────────────────────────────────

  const handleSave = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!selectedTemplateId || !editTitle.trim()) return;
      const silent = opts.silent === true;
      if (silent) {
        setAutosaveStatus('saving');
      } else {
        setSaving(true);
      }
      setError(null);

      const conds = conditionsPayload(editConditions);
      const condError = validateConditions(conds);
      if (condError) {
        if (silent) {
          setAutosaveStatus('error');
        } else {
          setSaving(false);
          setError(condError);
        }
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
          if (!silent) flash('Block created');
        } else if (selectedPresetId) {
          await apiClient.patch<SpecPresetData>(`/spec-presets/${selectedPresetId}`, payload);
          await loadPresets(selectedTemplateId);
          if (!silent) flash('Block saved');
        }
        setEditorBaseline({
          title: editTitle.trim(),
          body: isVariantMode ? '' : editBody,
          section: editSection,
          alwaysIncluded: editAlwaysIncluded,
          active: editActive,
          driverField: editDriverField || '',
          conditions: editConditions,
          variants: editVariants,
        });
        setLastSavedAt(Date.now());
        setAutosaveStatus('saved');
      } catch (err: any) {
        if (silent) {
          setAutosaveStatus('error');
        } else {
          setError(err.message || 'Failed to save');
          setAutosaveStatus('error');
        }
      } finally {
        if (!silent) setSaving(false);
      }
    },
    // The function reads a lot of editor state; React's exhaustive-deps lint will
    // flag any miss. We intentionally re-create on each editor change so the
    // autosave effect always closes over fresh values.
    [
      selectedTemplateId,
      editTitle,
      editBody,
      editSection,
      editAlwaysIncluded,
      editActive,
      editDriverField,
      editConditions,
      editVariants,
      isNewPreset,
      selectedPresetId,
      presets.length,
      loadPresets,
    ],
  );

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

  // ── Autosave (3s debounced) ──────────────────────────────────
  //
  // Fires only for blocks that already exist on the server — new presets must
  // be saved manually once so they get an id. Switching blocks or templates
  // clears the timer and resets the indicator.
  useEffect(() => {
    if (isNewPreset || !selectedPresetId || !editorBaseline) return;
    const snapshot: EditorSnapshot = {
      title: editTitle,
      body: editBody,
      section: editSection,
      alwaysIncluded: editAlwaysIncluded,
      active: editActive,
      driverField: editDriverField,
      conditions: editConditions,
      variants: editVariants,
    };
    if (snapshotsEqual(editorBaseline, snapshot)) return;
    if (!editTitle.trim()) return;
    const handle = window.setTimeout(() => {
      void handleSave({ silent: true });
    }, 3000);
    return () => window.clearTimeout(handle);
  }, [
    editTitle,
    editBody,
    editSection,
    editAlwaysIncluded,
    editActive,
    editDriverField,
    editConditions,
    editVariants,
    editorBaseline,
    isNewPreset,
    selectedPresetId,
    handleSave,
  ]);

  // Reset autosave indicator when the active block / template changes.
  useEffect(() => {
    setAutosaveStatus('idle');
    setLastSavedAt(null);
  }, [selectedPresetId, selectedTemplateId, isNewPreset]);

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
    if (!selectedTemplateId) { setError('No template selected.'); return; }
    if (!selectedSummaryId) { setError('Pick a summary to preview against.'); return; }
    // Open the preview window synchronously inside the user-gesture handler.
    // Browsers (Safari, Firefox, strict Chrome) block window.open() called
    // after an `await` — even with target=_blank. We navigate the window once
    // the PDF blob is ready.
    const previewWindow = window.open('', '_blank');
    setIsPreviewingPDF(true);
    setError(null);
    try {
      // Server-side render via PDFKit. Returns a PDF blob we open in a new tab.
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/proposal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ templateId: selectedTemplateId, summaryId: selectedSummaryId }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(detail.error || `Failed to render PDF (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else {
        // Popup blocker killed the synchronous open — fall back to a download.
        const link = document.createElement('a');
        link.href = url;
        link.download = 'proposal.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      previewWindow?.close();
      const message = err instanceof Error ? err.message : 'Failed to generate proposal PDF';
      setError(message);
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

  // Fetch linked Opportunity + Project records for the active summary so that
  // custom tokens with `sourceObject=OPPORTUNITY`/`PROJECT` can resolve. Falls
  // through silently when no link is present — built-in tokens still work.
  const linkedOpportunityId = (selectedSummary as { linkedOpportunityId?: string } | undefined)?.linkedOpportunityId;
  useEffect(() => {
    let cancelled = false;
    if (!linkedOpportunityId) {
      setOpportunityRecord(null);
      setProjectRecord(null);
      return;
    }
    (async () => {
      try {
        const opp = await apiClient.get<{ data?: Record<string, unknown> }>(
          `/objects/Opportunity/records/${linkedOpportunityId}`,
        );
        if (cancelled) return;
        setOpportunityRecord(opp?.data ?? null);
      } catch {
        if (!cancelled) setOpportunityRecord(null);
      }
      try {
        const projectList = await apiClient.get<{ records?: { data?: Record<string, unknown> }[] }>(
          `/objects/Project/records?filter[opportunity]=${encodeURIComponent(linkedOpportunityId)}&limit=1&orderBy=updatedAt&orderDir=desc`,
        );
        if (cancelled) return;
        setProjectRecord(projectList?.records?.[0]?.data ?? null);
      } catch {
        if (!cancelled) setProjectRecord(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedOpportunityId]);

  // Build a preset from the current editor state. Used so the preview
  // reflects in-progress edits without requiring a Save.
  const previewPresets = useMemo<SpecPresetData[]>(() => {
    if (!selectedTemplateId) return presets;
    const draftFromEditor = (
      idForDraft: string,
      templateId: string,
      order: number,
    ): SpecPresetData => ({
      id: idForDraft,
      templateId,
      order,
      title: editTitle,
      body: editDriverField ? null : editBody,
      section: editSection,
      isAlwaysIncluded: editAlwaysIncluded,
      driverField: editDriverField || null,
      isActive: editActive,
      conditions: editConditions.map((c, i) => ({
        id: `__draft_cond_${i}`,
        field: c.field,
        operator: c.operator,
        value: c.value || null,
        logic: c.logic,
      })),
      variants: editDriverField
        ? editVariants.map((v, i) => ({
            id: `__draft_variant_${i}`,
            presetId: idForDraft,
            matchValue: v.matchValue,
            matchLabel: v.matchLabel || null,
            body: v.body,
            order: i,
            isActive: v.isActive,
          }))
        : [],
    });

    if (selectedPresetId) {
      return presets.map((p) =>
        p.id === selectedPresetId ? draftFromEditor(p.id, p.templateId, p.order) : p,
      );
    }
    if (isNewPreset && editTitle.trim()) {
      return [...presets, draftFromEditor('__draft__', selectedTemplateId, presets.length)];
    }
    return presets;
  }, [
    presets,
    selectedPresetId,
    isNewPreset,
    selectedTemplateId,
    editTitle,
    editBody,
    editSection,
    editAlwaysIncluded,
    editActive,
    editDriverField,
    editConditions,
    editVariants,
  ]);

  const previewState = useMemo(() => {
    if (!selectedTemplateId || !selectedSummary) return { result: null, error: null };
    try {
      return {
        result: assembleProposal({
          summary: selectedSummary as any,
          template: {
            id: selectedTemplateId,
            name: selectedTemplate?.name ?? '',
            presets: previewPresets as any,
          },
          tokenMappings: tokenMappings.map((m) => ({
            tokenName: m.tokenName,
            sourceObject: m.sourceObject,
            sourcePath: m.sourcePath,
            format: m.format,
            isBuiltIn: m.isBuiltIn ?? false,
          })),
          opportunity: opportunityRecord ?? undefined,
          project: projectRecord ?? undefined,
        }),
        error: null,
      };
    } catch (err) {
      return { result: null, error: err instanceof Error ? err.message : 'Preview failed.' };
    }
  }, [
    selectedSummary,
    selectedTemplate?.name,
    selectedTemplateId,
    previewPresets,
    tokenMappings,
    opportunityRecord,
    projectRecord,
  ]);

  // Decision (included/excluded + reason) for the block currently in the editor,
  // looked up from the assembled preview against the active summary.
  const currentDecision = useMemo(() => {
    if (!selectedPresetId || !previewState.result) return null;
    const result = previewState.result;
    const included = result.includedBlocks.find((b) => b.id === selectedPresetId);
    if (included) return { included: true, reason: included.reason };
    const excluded = result.excludedBlocks.find((b) => b.id === selectedPresetId);
    if (excluded) return { included: false, reason: excluded.reason };
    return null;
  }, [selectedPresetId, previewState.result]);

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#1e3a5f]" />
      </div>
    );
  }

  const canSave = !!(editTitle.trim() && (selectedPresetId || isNewPreset));

  const currentSnapshot: EditorSnapshot = {
    title: editTitle,
    body: editBody,
    section: editSection,
    alwaysIncluded: editAlwaysIncluded,
    active: editActive,
    driverField: editDriverField,
    conditions: editConditions,
    variants: editVariants,
  };
  const isDirty = editorBaseline !== null && !snapshotsEqual(editorBaseline, currentSnapshot);

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
        onSave={() => void handleSave()}
        saving={saving}
        canSave={canSave}
        isDirty={isDirty}
        autosaveStatus={autosaveStatus}
        lastSavedAt={lastSavedAt}
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

      {/* Three-panel resizable layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left panel: block list + variable chips */}
        <div
          className="relative flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-150"
          style={{
            width: leftPanel.collapsed ? 40 : leftPanel.width,
            minWidth: leftPanel.collapsed ? 40 : undefined,
          }}
        >
          <button
            type="button"
            title={leftPanel.collapsed ? 'Show blocks panel' : 'Hide blocks panel'}
            onClick={() => leftPanel.toggleCollapsed()}
            aria-label={leftPanel.collapsed ? 'Expand blocks panel' : 'Collapse blocks panel'}
            aria-expanded={!leftPanel.collapsed}
            className="absolute right-0 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-l-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          >
            {leftPanel.collapsed ? <ChevronRight className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {!leftPanel.collapsed && (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <BlockList
                  presets={presets}
                  selectedPresetId={selectedPresetId}
                  onSelect={loadPresetIntoEditor}
                  onNew={handleNewPreset}
                  onDuplicate={handleDuplicatePreset}
                  onReorder={handleReorder}
                  onReorderEnd={handleReorderEnd}
                  dragIdx={dragIdx}
                  onDragStart={setDragIdx}
                />
              </div>
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize variables panel"
                aria-valuemin={140}
                aria-valuemax={600}
                aria-valuenow={Math.round(variablesPanel.height)}
                tabIndex={0}
                onMouseDown={variablesPanel.startResize}
                onKeyDown={handleVariablesResizeKeyDown}
                className="relative h-1.5 shrink-0 cursor-row-resize bg-gray-200/80 hover:bg-brand-navy/20 focus:outline-none focus-visible:bg-brand-navy/40 before:absolute before:inset-x-0 before:-top-2 before:-bottom-2 before:content-['']"
              />
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{ height: variablesPanel.height }}
              >
                <VariableChips
                  mappings={tokenMappings}
                  grouped={tokenGrouped}
                  onInsert={handleInsertToken}
                  onNewToken={() => setShowNewTokenModal(true)}
                />
              </div>
            </>
          )}
        </div>
        {!leftPanel.collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize blocks panel"
            aria-valuemin={220}
            aria-valuemax={520}
            aria-valuenow={Math.round(leftPanel.width)}
            tabIndex={0}
            onMouseDown={leftPanel.startResize}
            onKeyDown={handleLeftResizeKeyDown}
            className="relative w-1.5 shrink-0 cursor-col-resize bg-gray-200/80 hover:bg-brand-navy/20 focus:outline-none focus-visible:bg-brand-navy/40 before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']"
          />
        )}

        {/* Center panel: lint strip + letter preview */}
        <div className="flex-1 min-w-0 bg-gray-100 overflow-hidden flex flex-col">
          <LintPanel
            presets={previewPresets}
            result={previewState.result}
            onSelectBlock={handleSelectBlock}
          />
          <LetterPreview
            result={previewState.result}
            error={previewState.error}
            selectedPresetId={selectedPresetId}
            onSelectBlock={handleSelectBlock}
          />
        </div>

        {!rightPanel.collapsed && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor panel"
            aria-valuemin={280}
            aria-valuemax={600}
            aria-valuenow={Math.round(rightPanel.width)}
            tabIndex={0}
            onMouseDown={rightPanel.startResize}
            onKeyDown={handleRightResizeKeyDown}
            className="relative w-1.5 shrink-0 cursor-col-resize bg-gray-200/80 hover:bg-brand-navy/20 focus:outline-none focus-visible:bg-brand-navy/40 before:absolute before:inset-y-0 before:-left-2 before:-right-2 before:content-['']"
          />
        )}

        {/* Right panel: block editor */}
        <div
          className="relative shrink-0 bg-white border-l border-gray-200 overflow-hidden transition-[width] duration-150"
          style={{
            width: rightPanel.collapsed ? 40 : rightPanel.width,
            minWidth: rightPanel.collapsed ? 40 : undefined,
          }}
        >
          <button
            type="button"
            title={rightPanel.collapsed ? 'Show editor panel' : 'Hide editor panel'}
            onClick={() => rightPanel.toggleCollapsed()}
            aria-label={rightPanel.collapsed ? 'Expand editor panel' : 'Collapse editor panel'}
            aria-expanded={!rightPanel.collapsed}
            className="absolute left-0 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-r-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
          >
            {rightPanel.collapsed ? <ChevronLeft className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
          </button>
          {!rightPanel.collapsed && (
            <>
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
                  bodyEditorRef={bodyEditorRef}
                  decision={currentDecision}
                />
              )}
            </>
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
