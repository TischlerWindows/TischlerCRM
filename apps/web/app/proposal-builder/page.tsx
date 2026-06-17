'use client';

import { useEffect, useState, useCallback, useMemo, useRef, type KeyboardEvent } from 'react';
import { Loader2, AlertCircle, X, ChevronLeft, ChevronRight, PanelLeftClose, PanelRightClose } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getSetting } from '@/lib/preferences';
import { assembleProposal } from '@crm/proposal-assembly';
import type { SpecPresetData } from '@crm/proposal-assembly';
import { useResizableSidePanels } from '@/lib/use-resizable-side-panels';
import { useResizableVerticalPanel } from '@/lib/use-resizable-vertical-panel';

import { TopBar, type BuilderMode, type PreviewMode } from './_components/top-bar';
import { BlockList } from './_components/block-list';
import { VariableChips } from './_components/variable-chips';
import { LetterPreview, type BrandFontMap, emptyBrandFonts } from './_components/letter-preview';
import { LintPanel } from './_components/lint-panel';
import { BlockEditor } from './_components/block-editor';
import { type BodyEditorHandle } from './_components/body-editor';
import { NewTokenModal } from './_components/new-token-modal';
import { BrandingTab } from './_components/branding-tab';
import { PdfPreviewPane } from './_components/pdf-preview-pane';
import { pageLogosSchema, BLOCK_TYPE_META, type PageLogoRule, type BlockType } from '@crm/types';
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
  blockType: BlockType | null;
  config: Record<string, unknown>;
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
  const [editBlockType, setEditBlockType] = useState<BlockType | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [editAlwaysIncluded, setEditAlwaysIncluded] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [editDriverField, setEditDriverField] = useState('');
  const [editConditions, setEditConditions] = useState<DraftCondition[]>([]);
  const [editVariants, setEditVariants] = useState<DraftVariant[]>([]);
  const [isNewPreset, setIsNewPreset] = useState(false);
  const [editorBaseline, setEditorBaseline] = useState<EditorSnapshot | null>(null);

  // Pending edits: changes made to blocks that haven't been saved to the API yet.
  // Keyed by preset ID. Populated when switching away from a dirty block.
  // Flushed when the Save button is clicked.
  const [pendingEdits, setPendingEdits] = useState<Record<string, EditorSnapshot>>({});

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<any[]>([]);
  const [selectedSummaryId, setSelectedSummaryId] = useState('');
  const [isPreviewingPDF, setIsPreviewingPDF] = useState(false);

  // Builder mode + per-template page-logo rules. Loaded from the template
  // GET response (pageLogos JSON column). The BrandingTab patches these
  // via PATCH /quote-templates/:id/page-logos.
  const [mode, setMode] = useState<BuilderMode>('blocks');
  const [pageLogos, setPageLogos] = useState<PageLogoRule[]>([]);
  // Brand-font role ids for the live HTML preview's @font-face injection.
  // Each value is { id, fileFormat, updatedAt } or null. The renderer
  // already registers these for the PDF — this brings the preview in sync
  // so the on-screen render matches what the PDF will look like.
  const [brandFonts, setBrandFonts] = useState<BrandFontMap>(emptyBrandFonts());

  // ── Hybrid preview state ───────────────────────────────────────
  // The HTML preview is fast but approximate. The True PDF preview asks
  // the API to render the actual PDF, streams it as a blob, and shows it
  // in an iframe. Toggled per-user via the top-bar segmented control.
  const [previewMode, setPreviewMode] = useState<PreviewMode>('html');
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [lastPdfRenderedAt, setLastPdfRenderedAt] = useState<number | null>(null);
  const [pdfRefreshKey, setPdfRefreshKey] = useState(0);

  // ── Dirty tracking ────────────────────────────────────────────
  // Defined early (before callbacks) so that useCallback dependency arrays
  // that reference currentSnapshot/isDirty don't hit a TDZ at runtime.
  const currentSnapshot: EditorSnapshot = {
    title: editTitle,
    body: editBody,
    section: editSection,
    blockType: editBlockType,
    config: editConfig,
    alwaysIncluded: editAlwaysIncluded,
    active: editActive,
    driverField: editDriverField,
    conditions: editConditions,
    variants: editVariants,
  };
  const isDirty = editorBaseline !== null && !snapshotsEqual(editorBaseline, currentSnapshot);
  // Any unsaved changes — either current block or stashed blocks.
  const hasAnyUnsavedChanges = isDirty || Object.keys(pendingEdits).length > 0;

  const bodyEditorRef = useRef<BodyEditorHandle | null>(null);
  const variantEditorRef = useRef<BodyEditorHandle | null>(null);

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

  const loadTemplateMeta = useCallback(async (templateId: string) => {
    try {
      const tpl = await apiClient.get<{
        pageLogos?: unknown;
        titleFontId?: string | null;
        subtitleFontId?: string | null;
        headingFontId?: string | null;
        bodyFontId?: string | null;
        signatureFontId?: string | null;
      }>(`/quote-templates/${templateId}`);

      const parsed = pageLogosSchema.safeParse(tpl?.pageLogos ?? []);
      setPageLogos(parsed.success ? parsed.data : []);

      // Resolve each role's font metadata (id + fileFormat + updatedAt) so
      // the preview can build @font-face URLs. Skip roles with no id set.
      const fontIds = [
        tpl?.titleFontId,
        tpl?.subtitleFontId,
        tpl?.headingFontId,
        tpl?.bodyFontId,
        tpl?.signatureFontId,
      ].filter((id): id is string => !!id);

      if (fontIds.length === 0) {
        setBrandFonts(emptyBrandFonts());
      } else {
        try {
          const allFonts = await apiClient.get<
            Array<{ id: string; fileFormat: string; updatedAt: string }>
          >('/company-resources/fonts');
          const byId = new Map(allFonts.map((f) => [f.id, f]));
          const pickRole = (id: string | null | undefined) => {
            if (!id) return null;
            const f = byId.get(id);
            return f
              ? { id: f.id, fileFormat: f.fileFormat, updatedAt: f.updatedAt }
              : null;
          };
          setBrandFonts({
            title: pickRole(tpl?.titleFontId),
            subtitle: pickRole(tpl?.subtitleFontId),
            heading: pickRole(tpl?.headingFontId),
            body: pickRole(tpl?.bodyFontId),
            signature: pickRole(tpl?.signatureFontId),
          });
        } catch {
          setBrandFonts(emptyBrandFonts());
        }
      }
    } catch {
      setPageLogos([]);
      setBrandFonts(emptyBrandFonts());
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
        await Promise.all([
          loadPresets(def.id),
          loadTokenMappings(def.id),
          loadTemplateMeta(def.id),
        ]);
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
        blockType: editBlockType,
        config: editConfig,
        alwaysIncluded: editAlwaysIncluded,
        active: editActive,
        driverField: editDriverField,
        conditions: editConditions,
        variants: editVariants,
      };
      if (snapshotsEqual(baseline, current) && Object.keys(pendingEdits).length === 0) return;
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
    editBlockType,
    editConfig,
    editAlwaysIncluded,
    editActive,
    editDriverField,
    editConditions,
    editVariants,
    pendingEdits,
  ]);

  // ── Editor helpers ────────────────────────────────────────────

  const clearEditor = () => {
    setSelectedPresetId(null);
    setIsNewPreset(false);
    setEditTitle('');
    setEditBody('');
    setEditSection('SPECIFICATION');
    setEditBlockType(null);
    setEditConfig({});
    setEditAlwaysIncluded(false);
    setEditActive(true);
    setEditDriverField('');
    setEditConditions([]);
    setEditVariants([]);
    setEditorBaseline(null);
    setPendingEdits({});
  };

  const loadPresetIntoEditor = (preset: SpecPresetData) => {
    // If we have stashed local edits for this preset, restore them instead of
    // loading from the DB — the user's unsaved work should come back.
    const pending = pendingEdits[preset.id];
    if (pending) {
      setSelectedPresetId(preset.id);
      setIsNewPreset(false);
      setEditTitle(pending.title);
      setEditBody(pending.body);
      setEditSection(pending.section);
      setEditBlockType(pending.blockType);
      setEditConfig(pending.config);
      setEditAlwaysIncluded(pending.alwaysIncluded);
      setEditActive(pending.active);
      setEditDriverField(pending.driverField);
      setEditConditions(pending.conditions);
      setEditVariants(pending.variants);
      // Baseline = DB state so isDirty stays true (pending differs from DB)
      const blockType = (preset.blockType as BlockType | null) ?? null;
      const config = (preset.config && typeof preset.config === 'object'
        ? (preset.config as Record<string, unknown>)
        : {}) as Record<string, unknown>;
      setEditorBaseline({
        title: preset.title,
        body: preset.body ?? '',
        section: preset.section,
        blockType,
        config,
        alwaysIncluded: preset.isAlwaysIncluded,
        active: preset.isActive,
        driverField: preset.driverField || '',
        conditions: preset.conditions.map(conditionToDraft),
        variants: (preset.variants || []).map(variantToDraft),
      });
      return;
    }
    const conditions = preset.conditions.map(conditionToDraft);
    const variants = (preset.variants || []).map(variantToDraft);
    const blockType = (preset.blockType as BlockType | null) ?? null;
    const config = (preset.config && typeof preset.config === 'object'
      ? (preset.config as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    setSelectedPresetId(preset.id);
    setIsNewPreset(false);
    setEditTitle(preset.title);
    setEditBody(preset.body ?? '');
    setEditSection(preset.section);
    setEditBlockType(blockType);
    setEditConfig(config);
    setEditAlwaysIncluded(preset.isAlwaysIncluded);
    setEditActive(preset.isActive);
    setEditDriverField(preset.driverField || '');
    setEditConditions(conditions);
    setEditVariants(variants);
    setEditorBaseline({
      title: preset.title,
      body: preset.body ?? '',
      section: preset.section,
      blockType,
      config,
      alwaysIncluded: preset.isAlwaysIncluded,
      active: preset.isActive,
      driverField: preset.driverField || '',
      conditions,
      variants,
    });
  };

  const handleNewPreset = (blockType: BlockType | null) => {
    // Map block type → default section. Section is a legacy classifier
    // used for stylistic grouping; new layout blocks all go into CONSTANT.
    const sectionForBlockType: SpecPresetData['section'] = (() => {
      switch (blockType) {
        case 'SPECIFICATION_ITEM':
          return 'SPECIFICATION';
        case 'OPTION_ITEM':
          return 'OPTION';
        case 'EXCLUSION_ITEM':
          return 'EXCLUSION';
        case 'INSTALLATION_ITEM':
          return 'INSTALLATION';
        default:
          return 'CONSTANT';
      }
    })();
    const defaultTitle = blockType ? BLOCK_TYPE_META[blockType].label : '';
    setSelectedPresetId(null);
    setIsNewPreset(true);
    setEditTitle(defaultTitle);
    setEditBody('');
    setEditSection(sectionForBlockType);
    setEditBlockType(blockType);
    setEditConfig({});
    setEditAlwaysIncluded(blockType !== null); // layout blocks default to always-included
    setEditActive(true);
    setEditDriverField('');
    setEditConditions([]);
    setEditVariants([]);
    setEditorBaseline({
      title: defaultTitle,
      body: '',
      section: sectionForBlockType,
      blockType,
      config: {},
      alwaysIncluded: blockType !== null,
      active: true,
      driverField: '',
      conditions: [],
      variants: [],
    });
  };

  const handleSeedDefaults = async () => {
    if (!selectedTemplateId) return;
    if (!confirm('Add the standard layout (Letterhead, Pricing, Closing, Footer, etc.) to this template?')) return;
    try {
      await apiClient.post('/spec-presets/seed-defaults', { templateId: selectedTemplateId });
      await loadPresets(selectedTemplateId);
      flash('Standard layout added');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to seed defaults');
    }
  };

  const handleDuplicatePreset = (source: SpecPresetData) => {
    const conditions = (source.conditions ?? []).map(conditionToDraft);
    const variants = (source.variants ?? []).map(variantToDraft);
    const blockType = (source.blockType as BlockType | null) ?? null;
    const config = (source.config && typeof source.config === 'object'
      ? (source.config as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    setSelectedPresetId(null);
    setIsNewPreset(true);
    const title = `${source.title} (copy)`;
    setEditTitle(title);
    setEditBody(source.body ?? '');
    setEditSection(source.section);
    setEditBlockType(blockType);
    setEditConfig(config);
    setEditAlwaysIncluded(source.isAlwaysIncluded);
    setEditActive(source.isActive);
    setEditDriverField(source.driverField || '');
    setEditConditions(conditions);
    setEditVariants(variants);
    setEditorBaseline({
      title,
      body: source.body ?? '',
      section: source.section,
      blockType,
      config,
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
    await Promise.all([
      loadPresets(id),
      loadTokenMappings(id),
      loadTemplateMeta(id),
    ]);
  };

  const handleSelectBlock = (id: string) => {
    // Stash dirty changes locally instead of saving to the API.
    // New presets have no ID yet — they still need a real save before we can stash.
    if (isDirty && selectedPresetId && !isNewPreset) {
      setPendingEdits((prev) => ({ ...prev, [selectedPresetId]: currentSnapshot }));
    }
    // New unsaved blocks: save them so they get an ID before we navigate away.
    if (isDirty && isNewPreset) {
      void handleSave({ silent: true, switchAway: true });
    }
    const preset = presets.find((p) => p.id === id);
    if (preset) loadPresetIntoEditor(preset);
  };

  const handleInsertToken = (tokenName: string) => {
    if (editDriverField) {
      variantEditorRef.current?.insertText(`{{${tokenName}}}`);
    } else {
      bodyEditorRef.current?.insertText(`{{${tokenName}}}`);
    }
    flash(`Inserted {{${tokenName}}}`);
  };

  // ── Save / Delete ─────────────────────────────────────────────

  const handleSave = useCallback(
    async (opts: { silent?: boolean; switchAway?: boolean } = {}) => {
      if (!selectedTemplateId) return;
      const silent = opts.silent === true;
      if (!silent) setSaving(true);
      setError(null);

      // Helper: build the API payload from an editor snapshot.
      const buildPayload = (snap: EditorSnapshot): Record<string, unknown> => {
        const isVariantMode = !!snap.driverField;
        const conds = conditionsPayload(snap.conditions);
        const vars = isVariantMode ? variantsPayload(snap.variants) : [];
        return {
          title: snap.title.trim(),
          body: isVariantMode ? null : snap.body,
          section: snap.section,
          blockType: snap.blockType,
          config: snap.config,
          isAlwaysIncluded: snap.alwaysIncluded,
          isActive: snap.active,
          driverField: snap.driverField || null,
          conditions: conds,
          variants: vars,
        };
      };

      try {
        // ── Save the currently-active block ──────────────────────
        if (isNewPreset && editTitle.trim()) {
          const conds = conditionsPayload(editConditions);
          const condError = validateConditions(conds);
          if (condError) {
            if (!silent) { setSaving(false); setError(condError); }
            return;
          }
          const sectionPresets = presets.filter((p) => p.section === editSection);
          const insertOrder = sectionPresets.length > 0
            ? Math.max(...sectionPresets.map((p) => p.order)) + 1
            : presets.length;
          const isVariantMode = !!editDriverField;
          const created = await apiClient.post<SpecPresetData>('/spec-presets', {
            title: editTitle.trim(),
            body: isVariantMode ? null : editBody,
            section: editSection,
            blockType: editBlockType,
            config: editConfig,
            isAlwaysIncluded: editAlwaysIncluded,
            isActive: editActive,
            driverField: editDriverField || null,
            conditions: conds,
            variants: isVariantMode ? variantsPayload(editVariants) : [],
            templateId: selectedTemplateId,
            order: insertOrder,
          });
          const reordered = [
            ...presets.filter((p) => p.order < insertOrder),
            { ...created, order: insertOrder },
            ...presets.filter((p) => p.order >= insertOrder).map((p) => ({ ...p, order: p.order + 1 })),
          ].map((p, i) => ({ id: p.id, order: i }));
          await apiClient.patch('/spec-presets/reorder', reordered);
          setIsNewPreset(false);
          setSelectedPresetId(created.id);
        } else if (selectedPresetId && isDirty) {
          const conds = conditionsPayload(editConditions);
          const condError = validateConditions(conds);
          if (condError) {
            if (!silent) { setSaving(false); setError(condError); }
            return;
          }
          await apiClient.patch<SpecPresetData>(`/spec-presets/${selectedPresetId}`, buildPayload(currentSnapshot));
        }

        // ── Flush all pending (stashed) edits ────────────────────
        const pendingEntries = Object.entries(pendingEdits);
        for (const [presetId, snap] of pendingEntries) {
          const condError = validateConditions(conditionsPayload(snap.conditions));
          if (condError) continue; // skip invalid; leave in pending
          await apiClient.patch<SpecPresetData>(`/spec-presets/${presetId}`, buildPayload(snap));
        }
        // Clear pending edits that were successfully flushed
        if (pendingEntries.length > 0) setPendingEdits({});

        await loadPresets(selectedTemplateId);

        // Update baseline for the active block
        setEditorBaseline({
          title: editTitle.trim(),
          body: !!editDriverField ? '' : editBody,
          section: editSection,
          blockType: editBlockType,
          config: editConfig,
          alwaysIncluded: editAlwaysIncluded,
          active: editActive,
          driverField: editDriverField || '',
          conditions: editConditions,
          variants: editVariants,
        });

        if (!silent) flash('Saved');
      } catch (err: any) {
        if (!silent) setError(err.message || 'Failed to save');
      } finally {
        if (!silent) setSaving(false);
      }
    },
    [
      selectedTemplateId,
      editTitle,
      editBody,
      editSection,
      editAlwaysIncluded,
      editActive,
      editBlockType,
      editConfig,
      editDriverField,
      editConditions,
      editVariants,
      isNewPreset,
      selectedPresetId,
      isDirty,
      pendingEdits,
      currentSnapshot,
      presets,
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

  // ── Drag reorder ──────────────────────────────────────────────

  const handleReorder = (reordered: SpecPresetData[]) => {
    setPresets(reordered);
    setDragIdx(reordered.findIndex((p) => p.id === presets[dragIdx!]?.id));
  };

  const handleReorderEnd = async (reorderedPresets?: SpecPresetData[]) => {
    setDragIdx(null);
    if (!selectedTemplateId) return;
    const list = reorderedPresets ?? presets;
    try {
      await apiClient.patch('/spec-presets/reorder', list.map((p) => ({ id: p.id, order: p.order })));
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

  // ── True PDF inline preview ───────────────────────────────────
  // When previewMode === 'pdf' is selected and a template + summary are
  // picked, ask the API to render the PDF and pipe it into an iframe. The
  // effect debounces 700ms so rapid edits don't fire one render per
  // keystroke. The blob URL is created here and revoked in cleanup to
  // avoid memory leaks across re-renders.
  useEffect(() => {
    if (previewMode !== 'pdf' || mode !== 'blocks') return;
    if (!selectedTemplateId || !selectedSummaryId) return;

    let cancelled = false;
    let previousUrl: string | null = null;

    const timer = window.setTimeout(async () => {
      setIsRenderingPdf(true);
      setPdfError(null);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const token = apiClient.getToken();
        const response = await fetch(`${apiBase}/proposal-pdf/render`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            summaryId: selectedSummaryId,
          }),
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({
            error: response.statusText,
          }));
          throw new Error(
            detail.error || `Failed to render PDF (${response.status})`,
          );
        }
        const blob = await response.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        // Hold a reference so the cleanup function below can revoke the
        // PREVIOUS url (we replace state with the new one immediately).
        setPdfBlobUrl((prev) => {
          previousUrl = prev;
          return url;
        });
        setLastPdfRenderedAt(Date.now());
      } catch (err: unknown) {
        if (cancelled) return;
        setPdfError(
          err instanceof Error ? err.message : 'Failed to render the PDF',
        );
      } finally {
        if (!cancelled) setIsRenderingPdf(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    };
    // pdfRefreshKey covers manual refresh button triggers.
  }, [
    previewMode,
    mode,
    selectedTemplateId,
    selectedSummaryId,
    pdfRefreshKey,
  ]);

  // Revoke the blob URL when leaving PDF mode entirely so it doesn't
  // dangle in memory.
  useEffect(() => {
    if (previewMode === 'html' && pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
      setLastPdfRenderedAt(null);
      setPdfError(null);
    }
  }, [previewMode, pdfBlobUrl]);

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

  const handleDeleteToken = async (id: string, tokenName: string) => {
    if (!confirm(`Delete variable {{${tokenName}}}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/token-mappings/${id}`);
      if (selectedTemplateId) await loadTokenMappings(selectedTemplateId);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete token');
    }
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

    const snapToPreset = (p: SpecPresetData, snap: EditorSnapshot): SpecPresetData => ({
      ...p,
      title: snap.title,
      body: snap.driverField ? null : snap.body,
      section: snap.section,
      blockType: snap.blockType,
      config: snap.config,
      isAlwaysIncluded: snap.alwaysIncluded,
      driverField: snap.driverField || null,
      isActive: snap.active,
      conditions: snap.conditions.map((c, i) => ({
        id: `__draft_cond_${p.id}_${i}`,
        field: c.field,
        operator: c.operator,
        value: c.value || null,
        logic: c.logic,
      })),
      variants: snap.driverField
        ? snap.variants.map((v, i) => ({
            id: `__draft_variant_${p.id}_${i}`,
            presetId: p.id,
            matchValue: v.matchValue,
            matchLabel: v.matchLabel || null,
            body: v.body,
            order: i,
            isActive: v.isActive,
          }))
        : [],
    });

    // Apply pending edits + active editor state on top of the DB presets
    let result = presets.map((p) => {
      if (p.id === selectedPresetId) {
        return snapToPreset(p, currentSnapshot);
      }
      const pending = pendingEdits[p.id];
      if (pending) return snapToPreset(p, pending);
      return p;
    });

    if (isNewPreset && editTitle.trim()) {
      result = [...result, snapToPreset(
        {
          id: '__draft__',
          templateId: selectedTemplateId,
          order: presets.length,
          title: '',
          body: null,
          section: editSection,
          blockType: editBlockType,
          config: editConfig,
          isAlwaysIncluded: editAlwaysIncluded,
          driverField: editDriverField || null,
          isActive: editActive,
          conditions: [],
          variants: [],
        },
        currentSnapshot,
      )];
    }
    return result;
  }, [
    presets,
    selectedPresetId,
    isNewPreset,
    selectedTemplateId,
    pendingEdits,
    currentSnapshot,
    editTitle,
    editSection,
    editAlwaysIncluded,
    editActive,
    editBlockType,
    editConfig,
    editDriverField,
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

  const canSave = !!(hasAnyUnsavedChanges || isNewPreset);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-100">
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
        isDirty={hasAnyUnsavedChanges}
        mode={mode}
        onChangeMode={setMode}
        previewMode={previewMode}
        onChangePreviewMode={setPreviewMode}
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
          className="relative flex shrink-0 flex-col min-h-0 border-r border-gray-200 bg-white transition-[width] duration-150"
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
              <div className="flex flex-col flex-1 min-h-0">
                <BlockList
                  presets={presets}
                  selectedPresetId={selectedPresetId}
                  onSelect={(preset) => {
                    // Flush any unsaved changes before switching to another block.
                    if (isDirty && selectedPresetId) void handleSave({ silent: true, switchAway: true });
                    loadPresetIntoEditor(preset);
                  }}
                  onNew={handleNewPreset}
                  onDuplicate={handleDuplicatePreset}
                  onReorder={handleReorder}
                  onReorderEnd={handleReorderEnd}
                  onSeedDefaults={handleSeedDefaults}
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
                  onDeleteToken={handleDeleteToken}
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

        {/* Center panel — swaps between letter preview and Branding tab */}
        <div className="flex-1 min-w-0 bg-gray-100 overflow-hidden flex flex-col">
          {mode === 'branding' ? (
            <BrandingTab
              templateId={selectedTemplateId}
              initialRules={pageLogos}
              onSaved={setPageLogos}
            />
          ) : previewMode === 'pdf' ? (
            <PdfPreviewPane
              blobUrl={pdfBlobUrl}
              isRendering={isRenderingPdf}
              error={pdfError}
              lastRenderedAt={lastPdfRenderedAt}
              onRefresh={() => setPdfRefreshKey((k) => k + 1)}
              hasTemplate={!!selectedTemplateId}
              hasSummary={!!selectedSummaryId}
            />
          ) : (
            <>
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
                brandFonts={brandFonts}
                pageLogos={pageLogos}
              />
            </>
          )}
        </div>

        {mode === 'blocks' && !rightPanel.collapsed && (
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

        {/* Right panel: block editor — hidden in Branding mode */}
        {mode === 'blocks' && (
        <div
          className="relative flex shrink-0 flex-col min-h-0 bg-white border-l border-gray-200 overflow-hidden transition-[width] duration-150"
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
            <div className="flex flex-col flex-1 min-h-0">
              {!selectedPresetId && !isNewPreset ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-xs px-6 text-center">
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
                  blockType={editBlockType}
                  config={editConfig}
                  onConfigChange={setEditConfig}
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
                  variantEditorRef={variantEditorRef}
                  decision={currentDecision}
                />
              )}
            </div>
          )}
        </div>
        )}
      </div>

      <NewTokenModal
        open={showNewTokenModal}
        onClose={() => setShowNewTokenModal(false)}
        onSubmit={handleCreateToken}
      />
    </div>
  );
}
