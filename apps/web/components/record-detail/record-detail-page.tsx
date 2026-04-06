'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Database } from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { usePermissions } from '@/lib/permissions-context';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { isLegacyLayout, migrateLegacyLayout } from '@/lib/layout-migration';
import { PageLayout, type ObjectDef } from '@/lib/schema';
import { evaluateVisibility } from '@/lib/field-visibility';
import { getFormattingEffectsForField } from '@/lib/layout-formatting';
import { recordsService, RecordData } from '@/lib/records-service';
import { useFormulaFields } from '@/lib/use-formula-fields';
import { useRecordSetupContext } from '@/lib/record-setup-context';
import { getFieldDef, getRecordValue, MemoizedFieldValue } from './field-value-renderer';
import { RecordTabRenderer } from './record-tab-renderer';
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

// ── Component ──────────────────────────────────────────────────────────

/**
 * Universal record detail page.
 *
 * Renders a record using the EXACT page layout that was used to create it
 * (stored as `pageLayoutId` on the record). Falls back to the record-type
 * layout or the first available layout only if the record has no stored
 * layout reference.
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
  const togglePanelCollapse = useCallback((panelId: string) => {
    setCollapsedPanelIds((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  }, []);
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
          setRecord(recordsService.flattenRecord(raw));
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
  const pageLayout = useMemo(() => {
    if (!record || !objectDef) return null;
    const findLayout = (id: string) => objectDef.pageLayouts?.find((l) => l.id === id) ?? null;
    let raw: PageLayout | null = null;
    if (record.pageLayoutId) raw = findLayout(record.pageLayoutId);
    if (!raw) {
      const rt = record.recordTypeId
        ? objectDef.recordTypes?.find((r) => r.id === record.recordTypeId)
        : objectDef.recordTypes?.[0];
      if (rt?.pageLayoutId) raw = findLayout(rt.pageLayoutId);
    }
    if (!raw) raw = objectDef.pageLayouts?.[0] ?? null;
    if (!raw) return null;
    // Migrate legacy layouts (sections → regions/panels/fields)
    if (isLegacyLayout(raw)) {
      raw = migrateLegacyLayout(raw as any);
    }
    const editorTabs = (raw.extensions as any)?.editorTabs;
    if (Array.isArray(editorTabs) && editorTabs.length > 0) {
      return { ...raw, tabs: editorTabs as any } as PageLayout;
    }
    return raw;
  }, [record, objectDef]);

  useEffect(() => {
    setActiveTabIdx(0);
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
  const getRecordTitle = (): string => {
    if (!record) return '';
    const numberKey = Object.keys(record).find(
      (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k],
    );
    if (numberKey) return record[numberKey];
    if (record.name && typeof record.name === 'string') return record.name;
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
  let visibleActions: Array<'edit' | 'delete' | 'clone' | 'print'> = ['edit', 'delete'];
  let hasHighlightsWidget = false;
  let isNewStyleLayout = false;
  if (pageLayout?.tabs) {
    outer: for (const tab of pageLayout.tabs) {
      const regions = (tab as any).regions ?? [];
      if (regions.length > 0) isNewStyleLayout = true;
      for (const region of regions) {
        const hw = region.widgets?.find((w: any) => w.widgetType === 'HeaderHighlights');
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
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {effectiveBackLabel}
          </Link>

          {showHeaderCard && (
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {/* Identity + Actions row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 bg-brand-navy/10 rounded-lg flex items-center justify-center">
                    <IconComponent className="w-5 h-5 text-brand-navy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                      {objectDef?.label ?? 'Record'}
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">{title}</h1>
                    {subtitle && subtitle !== title && (
                      <p className="text-sm text-gray-500 truncate">{subtitle}</p>
                    )}
                  </div>
                </div>
                <RecordActions
                  objectApiName={objectApiName}
                  backRoute={effectiveBackRoute}
                  record={record}
                  rawRecord={rawRecord}
                  pageLayout={pageLayout}
                  objectDef={objectDef}
                  title={title}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canCustomize={canCustomize}
                  visibleActions={visibleActions}
                  onRecordUpdated={handleRecordUpdated}
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
                            <MemoizedFieldValue apiName={apiName} rawValue={raw} fieldDef={fd} record={record} isLookupLoaded={isLookupLoaded} />
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
          <div className="space-y-4">
            {/* Tab navigation */}
            {pageLayout.tabs.length > 1 && (() => {
              const sortedTabsForNav = [...pageLayout.tabs].sort((a: any, b: any) =>
                (a.order ?? 0) - (b.order ?? 0),
              );
              return (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
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
            {pageLayout.tabs.length > 1
              ? (() => {
                  const sortedTabsForRender = [...pageLayout.tabs].sort((a: any, b: any) =>
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
                    />
                  );
                })()
              : pageLayout.tabs.map((tab, ti) => (
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
                  />
                ))
            }
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            No page layout configured for this record.
          </div>
        )}
      </div>
    </div>
  );
}
