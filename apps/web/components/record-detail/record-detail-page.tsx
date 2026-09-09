'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, Database } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';
import { usePermissions } from '@/lib/permissions-context';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { isLegacyLayout, migrateLegacyLayout } from '@/lib/layout-migration';
import { resolveLayoutForUser } from '@/lib/layout-resolver';
import { useAuth } from '@/lib/auth-context';
import { PageLayout, type ObjectDef } from '@/lib/schema';
import { evaluateVisibility } from '@/lib/field-visibility';
import { getFormattingEffectsForField, getFormattingEffectsForTab } from '@/lib/layout-formatting';
import { recordsService, RecordData } from '@/lib/records-service';
import { useFormulaFields } from '@/lib/use-formula-fields';
import { useRecordSetupContext } from '@/lib/record-setup-context';
import { collectDefaultCollapsedWidgetIds } from '@/lib/widget-collapse-defaults';
import { getFieldDef, getRecordValue, MemoizedFieldValue } from './field-value-renderer';
import { RecordTabRenderer } from './record-tab-renderer';
import { InlineEditProvider, InlineEditToolbar, InlineEditBottomSpacer } from './inline-edit-context';
import { RecordActions } from './record-actions';

// ── Types ──────────────────────────────────────────────────────────────

interface RecordDetailPageProps {
  /** The schema apiName of the object, e.g. "Contact", "Property" */
  objectApiName: string;
  /** Route to navigate back to, e.g. "/contacts" */
  backRoute: string;
  /** Label shown in the back link, e.g. "Contacts" */
  backLabel: string;
  /** Optional icon component shown in the header */
  icon?: React.ComponentType<{ className?: string }>;
}

// ── Requote Version Selector ───────────────────────────────────────────
/** Dropdown that lets users switch between an opportunity and its requotes */
function RequoteVersionSelector({ objectApiName, recordId }: { objectApiName: string; recordId: string }) {
  const router = useRouter();
  const [versions, setVersions] = useState<Array<{ id: string; label: string; isCurrent: boolean }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (objectApiName !== 'Opportunity' || !recordId) return;
    let cancelled = false;
    apiClient.getRequoteVersions(objectApiName, recordId).then((res) => {
      if (!cancelled && res.versions.length > 1) {
        setVersions(res.versions);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [objectApiName, recordId]);

  if (versions.length < 2) return null;

  const current = versions.find((v) => v.isCurrent);

  return (
    <div className="print:hidden relative mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        {current?.label || 'Version'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-overlay" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-modal">
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  setOpen(false);
                  if (!v.isCurrent) {
                    const slug = objectApiName.toLowerCase().endsWith('y')
                      ? objectApiName.toLowerCase().slice(0, -1) + 'ies'
                      : objectApiName.toLowerCase() + 's';
                    router.push(`/${slug}/${v.id}`);
                  }
                }}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  v.isCurrent
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {v.label}
                {v.isCurrent && <span className="ml-2 text-xs text-blue-400">(current)</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────

/**
 * Universal record detail page.
 *
 * Renders every record with the object's currently-active page layout,
 * resolved via `resolveLayoutForUser` (role match → default → single-active).
 * Records are not pinned to the layout they were created with — changing
 * which layout is active takes effect on the next view/edit.
 *
 * Edit also uses the same layout so the form matches the view 1-to-1.
 */
export default function RecordDetailPage({
  objectApiName,
  backRoute,
  backLabel,
  icon: IconComponent = Database,
}: RecordDetailPageProps) {
  const params = useParams();
  const searchParams = useSearchParams();
  const { schema } = useSchemaStore();
  const { user: authUser } = useAuth();

  // If navigated from a related list, use the `from` param for back navigation
  const fromPath = searchParams.get('from');
  const effectiveBackRoute = fromPath || backRoute;
  const effectiveBackLabel = fromPath ? 'Back' : backLabel;
  const { canAccess } = usePermissions();

  const canEdit = canAccess(objectApiName, 'edit');
  const canDelete = canAccess(objectApiName, 'delete');
  const { hasAppPermission } = usePermissions();
  const canCustomize = hasAppPermission('customizeApplication');
  const { setRecordSetupContext } = useRecordSetupContext();

  const [rawRecord, setRawRecord] = useState<RecordData | null>(null);
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({});
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [collapsedPanelIds, setCollapsedPanelIds] = useState<Set<string>>(new Set());
  const [manualPanelIds, setManualPanelIds] = useState<Set<string>>(new Set());
  const togglePanelCollapse = useCallback((panelId: string, currentlyCollapsed?: boolean) => {
    setManualPanelIds((prev) => (prev.has(panelId) ? prev : new Set(prev).add(panelId)));
    setCollapsedPanelIds((prev) => {
      const next = new Set(prev);
      const isCollapsed = currentlyCollapsed !== undefined ? currentlyCollapsed : prev.has(panelId);
      if (isCollapsed) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }, []);
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<Set<string>>(new Set());
  const toggleWidgetCollapse = useCallback((widgetId: string) => {
    setCollapsedWidgetIds((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  }, []);

  // ── Print mode ────────────────────────────────────────────────────────
  // window.print() (and Ctrl/Cmd+P) triggers the 'print' media query without
  // any callback we control, so we listen for it directly: while printing,
  // every tab renders at once (stacked, with headings) instead of just the
  // active one, and every panel/widget renders expanded regardless of its
  // interactive collapsed state — a print/PDF should show the whole record.
  const [isPrintMode, setIsPrintMode] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('print');
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => setIsPrintMode(e.matches);
    handleChange(mql);
    mql.addEventListener?.('change', handleChange);
    // flushSync: React 18 batches state updates from native event listeners,
    // which could otherwise leave the DOM in its pre-print state by the time
    // the browser captures the page for the print/PDF preview.
    const handleBeforePrint = () => flushSync(() => setIsPrintMode(true));
    const handleAfterPrint = () => flushSync(() => setIsPrintMode(false));
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    // The "Print View"/"Print Page" PDF actions (record-actions.tsx) generate
    // a PDF from raw data rather than calling window.print(), but still need
    // every tab's widgets fully rendered (and expanded) so they can be
    // rasterized into the PDF — dispatched instead of a prop since RecordActions
    // and RecordDetailPage don't otherwise share this piece of state.
    const handlePdfModeChange = (e: Event) => {
      const active = !!(e as CustomEvent<{ active: boolean }>).detail?.active;
      flushSync(() => setIsPrintMode(active));
    };
    window.addEventListener('crm:record-pdf-mode', handlePdfModeChange);
    return () => {
      mql.removeEventListener?.('change', handleChange);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      window.removeEventListener('crm:record-pdf-mode', handlePdfModeChange);
    };
  }, []);
  const noopToggle = useCallback(() => {}, []);
  const noopSetSectionToggles = useCallback(() => {}, []);
  const emptySet = useMemo(() => new Set<string>(), []);
  const emptyObject = useMemo(() => ({}), []);
  const objectDef: ObjectDef | undefined = schema?.objects.find(
    (o) => o.apiName.toLowerCase() === objectApiName.toLowerCase(),
  );

  // Evaluate formula fields (including cross-object references)
  const { values: formulaValues } = useFormulaFields(objectDef, record);

  // ── Load record ──────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await recordsService.getRecord(objectApiName, params?.id as string);
        if (raw) {
          setRawRecord(raw);
          const flat = recordsService.flattenRecord(raw);
          console.log(`[RecordDetail] raw.data keys:`, Object.keys((raw as any).data ?? {}));
          console.log(`[RecordDetail] raw.data:`, (raw as any).data);
          console.log(`[RecordDetail] flattened keys:`, Object.keys(flat));
          console.log(`[RecordDetail] flattened record:`, flat);
          setRecord(flat);
        } else {
          setRecord(null);
        }
      } catch (err) {
        console.error(`Failed to load ${objectApiName} record:`, err);
        setRecord(null);
      } finally {
        setLoading(false);
      }
    };
    if (params?.id) load();
    else setLoading(false);
  }, [params?.id, objectApiName]);

  // ── Resolve layout ───────────────────────────────────────────────────
  const [pageLayout, layoutError] = useMemo((): [PageLayout | null, string | null] => {
    if (!record || !objectDef) return [null, null];
    const result = resolveLayoutForUser(
      objectDef,
      { profileId: authUser?.profileId ?? null },
      { layoutType: 'edit' },
    );
    if (result.kind !== 'resolved') return [null, result.message];
    let raw: PageLayout = result.layout;
    // Migrate legacy layouts (sections → regions/panels/fields)
    if (isLegacyLayout(raw)) {
      raw = migrateLegacyLayout(raw as any);
    }
    const editorTabs = (raw.extensions as any)?.editorTabs;
    if (Array.isArray(editorTabs) && editorTabs.length > 0) {
      return [{ ...raw, tabs: editorTabs as any } as PageLayout, null];
    }
    return [raw, null];
  }, [record, objectDef, authUser?.profileId]);

  useEffect(() => {
    setActiveTabIdx(0);
  }, [pageLayout?.id]);

  useEffect(() => {
    if (!pageLayout) return;
    setCollapsedWidgetIds(collectDefaultCollapsedWidgetIds(pageLayout));
  }, [pageLayout?.id]);

  useEffect(() => {
    if (!record || !objectDef) {
      setRecordSetupContext(null);
      return;
    }
    setRecordSetupContext({
      objectApiName,
      pageLayoutId: pageLayout?.id ?? null,
    });
  }, [objectApiName, record, objectDef, pageLayout?.id, setRecordSetupContext]);

  useEffect(() => {
    return () => setRecordSetupContext(null);
  }, [setRecordSetupContext]);

  // ── Preload lookup target records so IDs resolve to labels ──────────
  const isLookupLoaded = useLookupPreloader(objectDef);

  // ── Build a display title from the record ────────────────────────────
  // Every object mirrors the Opportunity format: "NUM (Descriptive Name)",
  // except Work Order, which just reads "NUM".
  const getRecordTitle = (): string => {
    if (!record) return '';

    const numberKey = Object.keys(record).find(
      (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k],
    );
    let numberValue: string = numberKey ? record[numberKey] : '';
    // Opportunity: strip "- Requote N" suffix — the name already carries that info
    if (objectApiName === 'Opportunity' && numberValue) {
      numberValue = numberValue.replace(/\s*-\s*Requote\s+\d+$/i, '');
    }

    if (objectApiName === 'WorkOrder') {
      return numberValue || `Untitled ${objectDef?.label ?? 'Record'}`;
    }

    // Descriptive name candidates, in priority order:
    // 1. <object>Name field (opportunityName, projectName, accountName, serviceName, quoteName, installationName, ...)
    // 2. 'title'
    // 3. 'name' (Account's generic name field)
    // 4. The subtitle resolver (composite name, first/last name, email — covers Contact/Lead)
    const lowerFirst = objectApiName.charAt(0).toLowerCase() + objectApiName.slice(1);
    const nameCandidateKeys = [
      `${objectApiName}__${lowerFirst}Name`,
      `${lowerFirst}Name`,
      'title',
      'name',
    ];
    let descriptiveName = '';
    for (const key of nameCandidateKeys) {
      const val = record[key];
      if (typeof val === 'string' && val.trim()) {
        descriptiveName = val.trim();
        break;
      }
    }
    if (!descriptiveName) descriptiveName = getRecordSubtitle();

    if (numberValue && descriptiveName && descriptiveName !== numberValue) {
      return `${numberValue} (${descriptiveName})`;
    }
    if (numberValue) return numberValue;
    if (descriptiveName) return descriptiveName;
    return `Untitled ${objectDef?.label ?? 'Record'}`;
  };

  const getRecordSubtitle = (): string => {
    if (!record) return '';
    const nameObj = record[`${objectApiName}__name`] || record.name;
    if (nameObj && typeof nameObj === 'object') {
      const keys = Object.keys(nameObj);
      const findVal = (pattern: string) => {
        const k = keys.find((k) => k.toLowerCase().includes(pattern));
        return k ? nameObj[k] : undefined;
      };
      const salutation = nameObj.salutation || findVal('salutation');
      const firstName = nameObj.firstName || findVal('firstname');
      const lastName = nameObj.lastName || findVal('lastname');
      const named = [salutation, firstName, lastName].filter(Boolean);
      if (named.length > 0) return named.join(' ');
      const parts = Object.values(nameObj).filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }
    const first = record.firstName || record[`${objectApiName}__firstName`];
    const last = record.lastName || record[`${objectApiName}__lastName`];
    if (first || last) return [first, last].filter(Boolean).join(' ');
    if (typeof record.name === 'string') return record.name;
    if (record.email || record.primaryEmail) return record.email || record.primaryEmail;
    return '';
  };

  // ── Callback for record updates from RecordActions ──────────────────
  const handleRecordUpdated = useCallback((raw: RecordData, flat: Record<string, any>) => {
    setRawRecord(raw);
    setRecord(flat);
  }, []);

  // ── Callback for a batched inline-edit save (every changed field at once) ─
  const handleInlineFieldsSaved = useCallback((changed: Record<string, unknown>) => {
    setRecord((prev) => (prev ? { ...prev, ...changed } : prev));
  }, []);

  // ── Loading state ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 sm:px-6 py-6 animate-pulse">
          <div className="mb-8">
            <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-7 w-48 bg-gray-200 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-20 bg-gray-200 rounded-lg" />
                <div className="h-9 w-20 bg-gray-200 rounded-lg" />
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="h-10 bg-gray-100 border-b border-gray-200 px-4 flex items-center">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-1.5">
                      <div className="h-3 w-20 bg-gray-200 rounded" />
                      <div className="h-4 w-36 bg-gray-200 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────
  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <IconComponent className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {objectDef?.label ?? 'Record'} Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The {objectDef?.label?.toLowerCase() ?? 'record'} you&#39;re looking for doesn&#39;t exist.
          </p>
          <Link
            href={effectiveBackRoute}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {effectiveBackLabel}
          </Link>
        </div>
      </div>
    );
  }

  const title = getRecordTitle();
  const subtitle = getRecordSubtitle();

  const layoutVisibilityData = { ...record, ...formulaValues } as Record<string, unknown>;

  // ── Resolve HeaderHighlights widget config ───────────────────────────
  let highlightApiNames: string[] = [];
  let visibleActions: Array<'edit' | 'delete' | 'clone' | 'print' | 'requote' | 'proposal'> = ['edit', 'delete', 'clone'];
  let hasHighlightsWidget = false;
  let isNewStyleLayout = false;
  if (pageLayout?.tabs) {
    outer: for (const tab of pageLayout.tabs) {
      const regions = (tab as any).regions ?? [];
      if (regions.length > 0) isNewStyleLayout = true;
      for (const region of regions) {
        const hw = region.widgets?.find((w: any) => w.widgetType === 'HeaderHighlights')
          ?? region.panels?.flatMap((p: any) => p.widgets ?? []).find((w: any) => w.widgetType === 'HeaderHighlights');
        if (hw && hw.config.type === 'HeaderHighlights') {
          hasHighlightsWidget = true;
          highlightApiNames = hw.config.fieldApiNames ?? [];
          if (Array.isArray(hw.config.visibleActions)) {
            visibleActions = hw.config.visibleActions;
          }
          break outer;
        }
      }
    }
  }
  if (highlightApiNames.length === 0 && pageLayout?.highlightFields?.length) {
    highlightApiNames = pageLayout.highlightFields;
  }

  const showHeaderCard = hasHighlightsWidget || !isNewStyleLayout;

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={effectiveBackRoute}
            className="print:hidden inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {effectiveBackLabel}
          </Link>

          {showHeaderCard && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-visible">
              {/* Identity + Actions row */}
              <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 bg-brand-navy/10 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-brand-navy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      {objectDef?.label ?? 'Record'}
                    </div>
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
                    {subtitle && subtitle !== title && !title.includes(subtitle) && (
                      <p className="text-sm text-gray-500 truncate">{subtitle}</p>
                    )}
                    {objectApiName === 'Opportunity' && params?.id && (
                      <RequoteVersionSelector objectApiName={objectApiName} recordId={params.id as string} />
                    )}
                  </div>
                </div>
                <RecordActions
                  objectApiName={objectApiName}
                  backRoute={effectiveBackRoute}
                  record={record}
                  rawRecord={rawRecord}
                  pdfRecord={{ ...record, ...formulaValues }}
                  pageLayout={pageLayout}
                  objectDef={objectDef}
                  title={title}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canCustomize={canCustomize}
                  visibleActions={visibleActions}
                  onRecordUpdated={handleRecordUpdated}
                  className="print:hidden"
                />
              </div>

              {/* Highlight fields row */}
              {highlightApiNames.length > 0 && (
                <>
                  <div className="border-t border-gray-100" />
                  <div className="flex flex-wrap gap-x-8 gap-y-3 px-5 py-3 bg-gray-50/60">
                    {highlightApiNames.map((apiName) => {
                      const fd = getFieldDef(apiName, objectDef);
                      if (!fd) return null;
                      if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return null;
                      const fFx = getFormattingEffectsForField(pageLayout!, apiName, layoutVisibilityData);
                      if (fFx?.hidden) return null;
                      const raw = getRecordValue(apiName, record, fd, formulaValues);
                      return (
                        <div key={apiName} className="min-w-[100px] max-w-[220px]">
                          <div className="text-xs text-gray-500">{fd.label}</div>
                          <div className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                            <MemoizedFieldValue apiName={apiName} rawValue={raw} fieldDef={fd} record={record} isLookupLoaded={isLookupLoaded} objectApiName={objectApiName} compact />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Layout-driven field rendering */}
        {pageLayout ? (
          <InlineEditProvider
            objectApiName={objectDef?.apiName ?? ''}
            recordId={record?.id as string | undefined}
            onSaved={handleInlineFieldsSaved}
          >
            <div className="space-y-4">
              <InlineEditToolbar />
            {/* Tab navigation */}
            {pageLayout.tabs.length > 1 && (() => {
              const sortedTabsForNav = [...pageLayout.tabs]
                .filter((tab: any) => {
                  // Detail page is "view" mode — check hideOnView (with legacy hideOnExisting fallback)
                  if (tab.hideOnView || tab.hideOnExisting) return false;
                  // Hide tabs via formatting rules
                  const tabFx = getFormattingEffectsForTab(pageLayout, tab.id, record as any);
                  if (tabFx?.hidden) return false;
                  return true;
                })
                .sort((a: any, b: any) =>
                  (a.order ?? 0) - (b.order ?? 0),
                );
              return (
                <div className="print:hidden flex items-center gap-2 overflow-x-auto pb-1">
                  {sortedTabsForNav.map((tab: any, idx: number) => (
                    <button
                      key={tab.id ?? idx}
                      type="button"
                      onClick={() => setActiveTabIdx(idx)}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                        activeTabIdx === idx
                          ? 'border-brand-navy bg-brand-navy text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {tab.label || `Tab ${idx + 1}`}
                    </button>
                  ))}
                </div>
              );
            })()}
            {/* Render tabs */}
            {isPrintMode
              ? [...pageLayout.tabs]
                  .filter((tab: any) => {
                    if (tab.hideOnView || tab.hideOnExisting) return false;
                    const tabFx = getFormattingEffectsForTab(pageLayout, tab.id, record as any);
                    if (tabFx?.hidden) return false;
                    return true;
                  })
                  .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
                  .map((tab: any, idx: number) => (
                    <div key={tab.id ?? idx} className="break-inside-avoid">
                      {pageLayout.tabs.length > 1 && (
                        <h2 className="mb-2 border-b border-gray-300 pb-1 text-base font-bold text-gray-900">
                          {tab.label || `Tab ${idx + 1}`}
                        </h2>
                      )}
                      <RecordTabRenderer
                        tab={tab}
                        tabIndex={idx}
                        pageLayout={pageLayout}
                        record={record}
                        objectDef={objectDef}
                        formulaValues={formulaValues}
                        isLookupLoaded={isLookupLoaded}
                        sectionToggles={emptyObject}
                        setSectionToggles={noopSetSectionToggles}
                        collapsedPanelIds={emptySet}
                        togglePanelCollapse={noopToggle}
                        manualPanelIds={emptySet}
                        collapsedWidgetIds={emptySet}
                        toggleWidgetCollapse={noopToggle}
                      />
                    </div>
                  ))
              : pageLayout.tabs.length > 1
              ? (() => {
                  const sortedTabsForRender = [...pageLayout.tabs]
                    .filter((tab: any) => {
                      if (tab.hideOnView || tab.hideOnExisting) return false;
                      const tabFx = getFormattingEffectsForTab(pageLayout, tab.id, record as any);
                      if (tabFx?.hidden) return false;
                      return true;
                    })
                    .sort((a: any, b: any) =>
                      (a.order ?? 0) - (b.order ?? 0),
                    );
                  const tab = sortedTabsForRender[activeTabIdx] ?? sortedTabsForRender[0];
                  return (
                    <RecordTabRenderer
                      tab={tab}
                      tabIndex={activeTabIdx}
                      pageLayout={pageLayout}
                      record={record}
                      objectDef={objectDef}
                      formulaValues={formulaValues}
                      isLookupLoaded={isLookupLoaded}
                      sectionToggles={sectionToggles}
                      setSectionToggles={setSectionToggles}
                      collapsedPanelIds={collapsedPanelIds}
                      togglePanelCollapse={togglePanelCollapse}
                      manualPanelIds={manualPanelIds}
                      collapsedWidgetIds={collapsedWidgetIds}
                      toggleWidgetCollapse={toggleWidgetCollapse}
                    />
                  );
                })()
              : pageLayout.tabs
                  .filter((tab: any) => {
                    if (tab.hideOnView || tab.hideOnExisting) return false;
                    const tabFx = getFormattingEffectsForTab(pageLayout, tab.id, record as any);
                    if (tabFx?.hidden) return false;
                    return true;
                  })
                  .map((tab, ti) => (
                  <RecordTabRenderer
                    key={(tab as any).id ?? ti}
                    tab={tab}
                    tabIndex={ti}
                    pageLayout={pageLayout}
                    record={record}
                    objectDef={objectDef}
                    formulaValues={formulaValues}
                    isLookupLoaded={isLookupLoaded}
                    sectionToggles={sectionToggles}
                    setSectionToggles={setSectionToggles}
                    collapsedPanelIds={collapsedPanelIds}
                    togglePanelCollapse={togglePanelCollapse}
                    manualPanelIds={manualPanelIds}
                    collapsedWidgetIds={collapsedWidgetIds}
                    toggleWidgetCollapse={toggleWidgetCollapse}
                  />
                ))
            }
            <InlineEditBottomSpacer />
            </div>
          </InlineEditProvider>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            {layoutError || 'No page layout configured for this record.'}
          </div>
        )}
      </div>
    </div>
  );
}
