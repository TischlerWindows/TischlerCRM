'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Database, ChevronDown, ChevronRight, Settings, ExternalLink, Copy, Printer } from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/toast';
import { useSchemaStore } from '@/lib/schema-store';
import { usePermissions } from '@/lib/permissions-context';
import { formatFieldValue, resolveLookupDisplayName, preloadLookupRecords } from '@/lib/utils';
import { PageLayout, PageField, FieldDef, ObjectDef, normalizeFieldType, type LayoutSection, type LayoutPanel, type PanelField } from '@/lib/schema';
import { evaluateVisibility } from '@/lib/field-visibility';
import {
  getFormattingEffectsForField,
  getFormattingEffectsForPanel,
  getFormattingEffectsForRegion,
  getFormattingEffectsForSection,
} from '@/lib/layout-formatting';
import {
  badgePillClass,
  fieldHighlightWrapperClass,
  labelPresentationClassName,
} from '@/lib/layout-presentation';
import {
  resolveTabCanvasItems,
  gridItemStyle,
  TAB_GRID_COLUMNS,
} from '@/lib/tab-canvas-grid';
import { LayoutWidgetsInline } from '@/components/layout-widgets-inline';
import { recordsService, RecordData } from '@/lib/records-service';
import { useFormulaFields } from '@/lib/use-formula-fields';
import LocationMapPreview from '@/components/location-map-preview';
import { useRecordSetupContext } from '@/lib/record-setup-context';

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
  const router = useRouter();
  const { schema } = useSchemaStore();
  const { canAccess } = usePermissions();

  const canEdit = canAccess(objectApiName, 'edit');
  const canDelete = canAccess(objectApiName, 'delete');
  const { hasAppPermission } = usePermissions();
  const canCustomize = hasAppPermission('customizeApplication');
  const { setRecordSetupContext } = useRecordSetupContext();
  const { showToast } = useToast();

  const [rawRecord, setRawRecord] = useState<RecordData | null>(null);
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Tracks which sections the user has manually toggled open/closed
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
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  // Counter bumped after lookup records finish loading to trigger re-render
  const [lookupTick, setLookupTick] = useState(0);

  const objectDef: ObjectDef | undefined = schema?.objects.find(
    (o) => o.apiName.toLowerCase() === objectApiName.toLowerCase()
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
    // 1. Layout stored on the record itself
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
  }, [
    objectApiName,
    record,
    objectDef,
    pageLayout?.id,
    setRecordSetupContext,
  ]);

  useEffect(() => {
    return () => setRecordSetupContext(null);
  }, [setRecordSetupContext]);

  // ── Preload lookup target records so IDs resolve to labels ──────────
  useEffect(() => {
    if (!objectDef) return;
    // Build set of known objects to validate lookupObject targets
    const knownObjects = new Set<string>(
      (schema?.objects || []).map((o: any) => o.apiName)
    );
    knownObjects.add('User'); // always valid

    // Collect lookup target objects from object fields (layout-independent)
    const lookupTargets = new Set<string>();
    // Always preload Users — system fields (Created By, Last Modified By) need it
    lookupTargets.add('User');
    for (const field of objectDef.fields) {
      if ((field.type === 'Lookup' || field.type === 'ExternalLookup' || field.type === 'LookupUser' || field.type === 'PicklistLookup') && field.lookupObject && knownObjects.has(field.lookupObject)) {
        lookupTargets.add(field.lookupObject);
      }
      if (field.type === 'LookupUser') {
        lookupTargets.add('User');
      }
    }
    if (lookupTargets.size > 0) {
      Promise.all(
        Array.from(lookupTargets).map((t) => preloadLookupRecords(t))
      ).then(() => setLookupTick((n) => n + 1));
    }
  }, [objectDef, schema]);

  // ── Helpers ──────────────────────────────────────────────────────────
  const getFieldDef = (apiName: string, layoutField?: PageField): FieldDef | undefined => {
    // Always get the authoritative field definition from object fields
    const objField = objectDef?.fields.find((f) => f.apiName === apiName);

    // Self-contained path: use enriched layout field data directly
    if (layoutField && layoutField.type && layoutField.label) {
      const { column, order, presentation: _pres, colSpan: _cs, rowSpan: _rs, ...fieldProps } =
        layoutField;
      const def = {
        id: fieldProps.id || apiName,
        ...fieldProps,
        apiName,
        type: normalizeFieldType(fieldProps.type!),
      } as FieldDef;
      // Ensure lookupObject always comes from the authoritative field definition
      if (objField?.lookupObject) {
        def.lookupObject = objField.lookupObject;
      }
      if (objField?.relationshipName) {
        def.relationshipName = objField.relationshipName;
      }
      if (objField?.targetFields) {
        def.targetFields = objField.targetFields;
      }
      return def;
    }
    // Fallback: cross-reference object fields
    return objField;
  };

  /** Read a value from the flattened record, trying prefixed then stripped key. */
  const getRecordValue = (apiName: string, fieldDef?: FieldDef): any => {
    if (!record) return undefined;

    // For Formula fields, return the computed value from the formula hook
    if (fieldDef?.type === 'Formula' && fieldDef.formulaExpr) {
      const computed = formulaValues[fieldDef.apiName] ?? formulaValues[apiName];
      if (computed !== undefined && computed !== null) return computed;
    }

    let value = record[apiName] ?? record[apiName.replace(/^[A-Za-z]+__/, '')];

    // For CompositeText, construct from sub-fields when missing
    if (!value && fieldDef?.type === 'CompositeText' && fieldDef.subFields) {
      const composite: Record<string, any> = {};
      for (const sf of fieldDef.subFields) {
        const v = record[sf.apiName] ?? record[sf.apiName.replace(/^[A-Za-z]+__/, '')];
        if (v) composite[sf.apiName] = v;
      }
      if (Object.keys(composite).length > 0) value = composite;
    }

    return value;
  };

  /** Render a field value, handling Links, CompositeText, Email, Phone, etc. */
  const renderValue = (apiName: string, rawValue: any, fieldDef?: FieldDef): React.ReactNode => {
    // Auto-parse JSON strings
    let value = rawValue;
    if (typeof value === 'string' && value.startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* not JSON */ }
    }
    const fieldType = fieldDef?.type;

    // LocationSearch is a virtual widget — it has no stored value of its own.
    // Render the map preview by reading the mapped target fields from the record.
    if (fieldType === 'LocationSearch' && fieldDef?.targetFields && record) {
      const tf = fieldDef.targetFields;
      const resolve = (key: string | undefined) => {
        if (!key) return undefined;
        return record[key] ?? record[key.replace(/^[A-Za-z]+__/, '')];
      };
      const lat = Number(resolve(tf.lat));
      const lng = Number(resolve(tf.lng));
      const addressParts = [
        resolve(tf.street),
        resolve(tf.city),
        resolve(tf.state),
        resolve(tf.postalCode),
        resolve(tf.country),
      ].filter(Boolean).join(', ');

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return (
          <LocationMapPreview
            lat={lat}
            lng={lng}
            address={addressParts || undefined}
          />
        );
      }
      return addressParts || '-';
    }

    if (value === null || value === undefined || value === '') return '-';

    // Lookup → clickable link showing resolved label (not raw UUID)
    if ((fieldType === 'Lookup' || fieldType === 'LookupUser') && (fieldDef?.lookupObject || fieldType === 'LookupUser')) {
      const lookupTarget = fieldDef?.lookupObject || 'User';
      const routeMap: Record<string, string> = {
        Contact: 'contacts',
        Account: 'accounts',
        Property: 'properties',
        Lead: 'leads',
        Deal: 'deals',
        Product: 'products',
        Quote: 'quotes',
        Project: 'projects',
        Service: 'service',
        Installation: 'installations',
      };
      const route = routeMap[lookupTarget];
      // Resolve UUID → human-readable label (uses lookupTick to re-render)
      const displayLabel = resolveLookupDisplayName(value, lookupTarget);
      // Suppress unused-var warning — lookupTick forces re-render after cache loads
      void lookupTick;
      if (route) {
        return (
          <Link href={`/${route}/${value}`} className="text-brand-navy hover:underline underline-offset-2">
            {displayLabel}
          </Link>
        );
      }
      return displayLabel;
    }

    // TextArea — preserve line breaks
    if (fieldType === 'TextArea' && typeof value === 'string') {
      return <span className="whitespace-pre-wrap">{value}</span>;
    }

    // CompositeText (e.g. Name)
    if (fieldType === 'CompositeText' && typeof value === 'object') {
      const keys = Object.keys(value);
      const salutation =
        value.salutation ||
        keys.find((k) => k.toLowerCase().includes('salutation')) &&
          value[keys.find((k) => k.toLowerCase().includes('salutation'))!];
      const firstName =
        value.firstName ||
        keys.find((k) => k.toLowerCase().includes('firstname')) &&
          value[keys.find((k) => k.toLowerCase().includes('firstname'))!];
      const lastName =
        value.lastName ||
        keys.find((k) => k.toLowerCase().includes('lastname')) &&
          value[keys.find((k) => k.toLowerCase().includes('lastname'))!];
      const parts = [salutation, firstName, lastName].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : '-';
    }

    // Email
    if (fieldType === 'Email') {
      return (
        <a href={`mailto:${value}`} className="text-brand-navy hover:underline underline-offset-2">
          {value}
        </a>
      );
    }

    // Phone
    if (fieldType === 'Phone') {
      return (
        <a href={`tel:${value}`} className="text-brand-navy hover:underline underline-offset-2">
          {value}
        </a>
      );
    }

    // URL
    if (fieldType === 'URL') {
      const href = fieldDef?.staticUrl || value;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:underline underline-offset-2">
          {fieldDef?.staticUrl || value}
        </a>
      );
    }

    // Checkbox
    if (fieldType === 'Checkbox') {
      return value ? 'Yes' : 'No';
    }

    // PicklistText
    if (fieldType === 'PicklistText' && typeof value === 'object' && value !== null) {
      const parts = [value.picklist, value.text].filter(Boolean);
      return parts.length > 0 ? parts.join(' — ') : '-';
    }

    // PicklistLookup — composite: picklist selection + lookup record
    if (fieldType === 'PicklistLookup' && typeof value === 'object' && value !== null) {
      const lookupTarget = fieldDef?.lookupObject;
      const picklistPart = value.picklist || '';
      let lookupPart: React.ReactNode = '';
      if (value.lookup && lookupTarget) {
        const routeMap: Record<string, string> = {
          Contact: 'contacts', Account: 'accounts', Property: 'properties',
          Lead: 'leads', Deal: 'deals', Product: 'products',
          Quote: 'quotes', Project: 'projects', Service: 'service',
          Installation: 'installations',
        };
        const route = routeMap[lookupTarget];
        const displayLabel = resolveLookupDisplayName(value.lookup, lookupTarget);
        void lookupTick;
        lookupPart = route ? (
          <Link href={`/${route}/${value.lookup}`} className="text-brand-navy hover:underline underline-offset-2">
            {displayLabel}
          </Link>
        ) : displayLabel;
      }
      if (!picklistPart && !lookupPart) return '-';
      return (
        <span className="inline-flex items-center gap-1">
          {picklistPart}{picklistPart && lookupPart ? ' — ' : ''}{lookupPart}
        </span>
      );
    }

    // Address (object) — show map preview when lat/lng are available
    if (fieldType === 'Address' && typeof value === 'object') {
      const parts = [value.street, value.city, value.state, value.postalCode, value.country].filter(Boolean);
      const addressText = parts.length > 0 ? parts.join(', ') : '-';
      const lat = Number(value.lat);
      const lng = Number(value.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return (
          <div className="space-y-2">
            <span>{addressText}</span>
            <LocationMapPreview lat={lat} lng={lng} address={addressText !== '-' ? addressText : undefined} />
          </div>
        );
      }
      return addressText;
    }

    // Date — locale-aware formatting
    if (fieldType === 'Date' && typeof value === 'string') {
      const d = new Date(value + (value.includes('T') ? '' : 'T00:00:00'));
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric' }).format(d);
      }
    }

    // DateTime — locale-aware formatting
    if (fieldType === 'DateTime' && typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(undefined, { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
      }
    }

    return formatFieldValue(value, fieldType, fieldDef?.lookupObject);
  };

  // ── Build a display title from the record ────────────────────────────
  const getRecordTitle = (): string => {
    if (!record) return '';
    // Try the auto-number field (contactNumber, propertyNumber, etc.)
    const numberKey = Object.keys(record).find(
      (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k]
    );
    if (numberKey) return record[numberKey];
    // Fall back to name
    if (record.name && typeof record.name === 'string') return record.name;
    return `Untitled ${objectDef?.label ?? 'Record'}`;
  };

  const getRecordSubtitle = (): string => {
    if (!record) return '';
    // Try composite name first
    const nameObj = record[`${objectApiName}__name`] || record.name;
    if (nameObj && typeof nameObj === 'object') {
      const keys = Object.keys(nameObj);
      const findVal = (pattern: string) => {
        const k = keys.find(k => k.toLowerCase().includes(pattern));
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
    // Try firstName + lastName
    const first = record.firstName || record[`${objectApiName}__firstName`];
    const last = record.lastName || record[`${objectApiName}__lastName`];
    if (first || last) return [first, last].filter(Boolean).join(' ');
    // Try a name string
    if (typeof record.name === 'string') return record.name;
    // Try email
    if (record.email || record.primaryEmail) return record.email || record.primaryEmail;
    return '';
  };

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleEdit = () => {
    if (!pageLayout) {
      showToast('No page layout found for this record.', 'error');
      return;
    }
    setShowEditForm(true);
  };

  const handleEditSubmit = async (data: Record<string, any>) => {
    if (!record) return;
    try {
      // Strip object prefix from keys so the saved data matches the format
      // used by the per-page create handlers (which also strip prefixes).
      // This prevents duplicate keys (e.g. "status" + "Lead__status") from
      // accumulating in the JSON data blob.
      const normalizedData: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        const cleanKey = key.replace(/^[A-Za-z]+__/, '');
        normalizedData[cleanKey] = value;
      }
      const updated = await recordsService.updateRecord(objectApiName, record.id, { data: normalizedData });
      if (updated) {
        setRawRecord(updated);
        setRecord(recordsService.flattenRecord(updated));
      }
    } catch (err) {
      console.error('Failed to update record:', err);
      // Optimistic update
      setRecord({ ...record, ...data });
    }
    setShowEditForm(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!record) return;
    setShowDeleteConfirm(false);
    try {
      await recordsService.deleteRecord(objectApiName, record.id);
    } catch (err) {
      console.error('Failed to delete record:', err);
      showToast('Failed to delete record. Please try again.', 'error');
      return;
    }
    router.push(backRoute);
  };

  const [isCloning, setIsCloning] = useState(false);
  const handleClone = async () => {
    if (!record || !rawRecord) return;
    setIsCloning(true);
    try {
      const cloneData = { ...(rawRecord.data as Record<string, unknown>) };
      const cloned = await recordsService.createRecord(objectApiName, {
        data: cloneData,
        pageLayoutId: rawRecord.pageLayoutId ?? undefined,
      });
      if (cloned) {
        showToast('Record cloned successfully', 'success');
        router.push(`/${backRoute.replace(/^\//, '').split('/')[0]}/${cloned.id}`);
      }
    } catch (err) {
      console.error('Failed to clone record:', err);
      showToast('Failed to clone record. Please try again.', 'error');
    } finally {
      setIsCloning(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── Loading / not found ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="px-4 sm:px-6 py-6 animate-pulse">
          {/* Header skeleton */}
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
          {/* Panel skeletons */}
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
            href={backRoute}
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const title = getRecordTitle();
  const subtitle = getRecordSubtitle();

  const layoutVisibilityData = { ...record, ...formulaValues } as Record<string, unknown>;

  const renderTab = (tab: any, ti: number): React.ReactNode => {
    if (!pageLayout) return null;

    // NEW model: tab.regions exists
    if ('regions' in tab && Array.isArray((tab as any).regions)) {
      const regions = (tab as any).regions as LayoutSection[];
      const sortedRegions = [...regions].sort(
        (a, b) => (a.gridRow ?? 0) - (b.gridRow ?? 0) || (a.gridColumn ?? 0) - (b.gridColumn ?? 0)
      );

      return (
        <div
          key={tab.id ?? ti}
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}
        >
          {sortedRegions.map((region) => {
            if (region.hidden) return null;

            const regionFx = getFormattingEffectsForRegion(pageLayout, region.id, layoutVisibilityData);
            if (regionFx?.hidden) return null;

            const sortedPanels = [...(region.panels ?? [])].sort((a: any, b: any) => a.order - b.order);
            const sortedWidgets = [...(region.widgets ?? [])].sort((a: any, b: any) => a.order - b.order);

            const regionStyle: React.CSSProperties = {
              gridColumn: `${region.gridColumn ?? 1} / span ${region.gridColumnSpan ?? 12}`,
              ...(region.style?.background ? { backgroundColor: region.style.background } : {}),
              ...(region.style?.borderColor ? { borderColor: region.style.borderColor } : {}),
              ...(region.style?.borderStyle ? { borderStyle: region.style.borderStyle } : {}),
              borderRadius: region.style?.borderRadius === 'lg' ? 12 : region.style?.borderRadius === 'sm' ? 6 : undefined,
              boxShadow: region.style?.shadow === 'md'
                ? '0 10px 24px rgba(15,23,42,.14)'
                : region.style?.shadow === 'sm'
                ? '0 1px 3px rgba(15,23,42,.12)'
                : undefined,
            };

            return (
              <div key={region.id} style={regionStyle} className="min-w-0 space-y-4 p-2">
                {/* Panels */}
                {sortedPanels.map((panel: any) => {
                  if (panel.hidden) return null;
                  const panelFx = getFormattingEffectsForPanel(pageLayout, panel.id, layoutVisibilityData);
                  if (panelFx?.hidden) return null;

                  const sortedFields = [...(panel.fields ?? [])].sort((a: any, b: any) => a.order - b.order);
                  const visibleFields = sortedFields.filter((f: any) => {
                    if (f.behavior === 'hidden') return false;
                    const fd = getFieldDef(f.fieldApiName);
                    if (!fd) return false;
                    if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return false;
                    const fFx = getFormattingEffectsForField(pageLayout, f.fieldApiName, layoutVisibilityData);
                    if (fFx?.hidden) return false;
                    return true;
                  });

                  if (visibleFields.length === 0) return null;

                  const headerStyle: React.CSSProperties = {
                    ...(panel.style?.headerBackground ? { backgroundColor: panel.style.headerBackground } : {}),
                    ...(panel.style?.headerTextColor ? { color: panel.style.headerTextColor } : {}),
                    fontWeight: panel.style?.headerBold ? 700 : undefined,
                    fontStyle: panel.style?.headerItalic ? 'italic' : undefined,
                    textTransform: panel.style?.headerUppercase ? 'uppercase' : undefined,
                  };
                  const bodyStyle: React.CSSProperties = {
                    ...(panel.style?.bodyBackground ? { backgroundColor: panel.style.bodyBackground } : {}),
                  };

                  const isPanelCollapsed = collapsedPanelIds.has(panel.id);
                  return (
                    <div key={panel.id} className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => togglePanelCollapse(panel.id)}
                        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                        style={headerStyle}
                      >
                        <span className="text-sm font-semibold text-gray-700" style={headerStyle}>{panel.label}</span>
                        {isPanelCollapsed
                          ? <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                        }
                      </button>
                      {!isPanelCollapsed && (
                        <div
                          className="grid gap-x-6 gap-y-4 p-4"
                          style={{
                            ...bodyStyle,
                            gridTemplateColumns: `repeat(${panel.columns}, minmax(0, 1fr))`,
                          }}
                        >
                          {visibleFields.map((f: any) => {
                            const fd = getFieldDef(f.fieldApiName);
                            if (!fd) return null;
                            const raw = getRecordValue(f.fieldApiName, fd);
                            const labelStyle: React.CSSProperties = {
                              ...(f.labelStyle?.color ? { color: f.labelStyle.color } : {}),
                              fontWeight: f.labelStyle?.bold ? 700 : undefined,
                              fontStyle: f.labelStyle?.italic ? 'italic' : undefined,
                              textTransform: f.labelStyle?.uppercase ? 'uppercase' : undefined,
                            };
                            const valueStyle: React.CSSProperties = {
                              ...(f.valueStyle?.color ? { color: f.valueStyle.color } : {}),
                              ...(f.valueStyle?.background ? { backgroundColor: f.valueStyle.background, padding: '2px 6px', borderRadius: 4 } : {}),
                              fontWeight: f.valueStyle?.bold ? 700 : undefined,
                              fontStyle: f.valueStyle?.italic ? 'italic' : undefined,
                            };
                            const displayLabel = f.labelOverride || fd.label;
                            return (
                              <div
                                key={f.fieldApiName}
                                style={{ gridColumn: `span ${Math.min(f.colSpan ?? 1, panel.columns)}` }}
                              >
                                <div className="text-xs font-medium text-gray-500 mb-0.5" style={labelStyle}>
                                  {displayLabel}
                                </div>
                                <div className="text-sm text-gray-900" style={valueStyle}>
                                  {renderValue(f.fieldApiName, raw, fd)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Widgets */}
                {sortedWidgets.length > 0 && (
                  <LayoutWidgetsInline
                    widgets={sortedWidgets}
                    record={record ?? undefined}
                    objectDef={objectDef ? { apiName: objectDef.apiName, label: objectDef.label, fields: objectDef.fields.map(f => ({ apiName: f.apiName, label: f.label, type: String(f.type) })) } : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // LEGACY FALLBACK: old tab.sections model
    const legacyTab = tab as any;
    const sorted = [...(legacyTab.sections ?? [])].sort((a: any, b: any) => a.order - b.order);
    const eligible = sorted.filter((section: any) => {
      if (section.showInRecord === false) return false;
      if (!evaluateVisibility(section.visibleIf, layoutVisibilityData)) return false;
      const sectionFx = getFormattingEffectsForSection(pageLayout, section.id, layoutVisibilityData);
      if (sectionFx?.hidden) return false;
      const columnArrays: { layoutField: typeof section.fields[0]; fieldDef: FieldDef }[][] = [];
      for (let c = 0; c < section.columns; c++) {
        columnArrays[c] = section.fields
          .filter((f: any) => f.column === c)
          .sort((a: any, b: any) => a.order - b.order)
          .map((f: any) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, f)! }))
          .filter((entry: any) => entry.fieldDef != null)
          .filter(({ layoutField, fieldDef }: any) => {
            if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
            const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
            if (fFx?.hidden) return false;
            return true;
          });
      }
      const allFieldsEmpty = columnArrays.every((col) =>
        col.every(({ layoutField, fieldDef }: any) => {
          const v = getRecordValue(layoutField.apiName, fieldDef);
          return v === undefined || v === null || v === '' || v === 'N/A';
        })
      );
      return !allFieldsEmpty;
    });
    const isSectionShown = (section: any) =>
      eligible.some((s: any) => s.id === section.id);

    const items = resolveTabCanvasItems(legacyTab);
    const visibleItems = items.filter((item) => {
      if (item.kind === 'widget') return true;
      return isSectionShown(item.section);
    });

    return (
      <div
        key={tab.id ?? ti}
        className="grid gap-4 mb-6"
        style={{ gridTemplateColumns: `repeat(${TAB_GRID_COLUMNS}, minmax(0, 1fr))` }}
      >
        {visibleItems.map((item) => {
          if (item.kind === 'widget') {
            const g = item.widget;
            return (
              <div
                key={g.id}
                className="min-w-0"
                style={gridItemStyle({
                  gridColumn: g.gridColumn ?? 1,
                  gridColumnSpan: g.gridColumnSpan ?? TAB_GRID_COLUMNS,
                  gridRow: g.gridRow ?? 1,
                  gridRowSpan: g.gridRowSpan ?? 1,
                })}
              >
                <LayoutWidgetsInline
                  widgets={[g]}
                  record={record ?? undefined}
                  objectDef={objectDef ? { apiName: objectDef.apiName, label: objectDef.label, fields: objectDef.fields.map(f => ({ apiName: f.apiName, label: f.label, type: String(f.type) })) } : undefined}
                />
              </div>
            );
          }
          const section = item.section;
          const columnArrays: { layoutField: typeof section.fields[0]; fieldDef: FieldDef }[][] = [];
          for (let c = 0; c < section.columns; c++) {
            columnArrays[c] = section.fields
              .filter((f) => f.column === c)
              .sort((a, b) => a.order - b.order)
              .map((f) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, f)! }))
              .filter((entry) => entry.fieldDef != null)
              .filter(({ layoutField, fieldDef }) => {
                if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
                const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                if (fFx?.hidden) return false;
                return true;
              });
          }

          const hasSpanning = section.fields.some(
            (f) => ((f as any).colSpan ?? 1) > 1 || ((f as any).rowSpan ?? 1) > 1
          );

          const sectionKey = `${ti}-${section.id}`;
          const isCollapsed = sectionToggles[sectionKey] === false;

          const toggleSection = () => {
            if (!isCollapsed) {
              setSectionToggles((prev) => ({ ...prev, [sectionKey]: false }));
            } else {
              setSectionToggles((prev) => {
                const next = { ...prev };
                delete next[sectionKey];
                return next;
              });
            }
          };

          return (
            <div
              key={section.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden min-w-0"
              style={gridItemStyle({
                gridColumn: section.gridColumn ?? 1,
                gridColumnSpan: section.gridColumnSpan ?? TAB_GRID_COLUMNS,
                gridRow: section.gridRow ?? 1,
                gridRowSpan: section.gridRowSpan ?? 1,
              })}
            >
              <button
                type="button"
                onClick={toggleSection}
                className="w-full flex items-center justify-between bg-gray-50 px-6 py-3 border-b border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="text-left">
                  <h3 className="font-medium text-gray-900">{section.label}</h3>
                  {section.description ? (
                    <p className="text-xs text-gray-500 mt-0.5 font-normal">
                      {section.description}
                    </p>
                  ) : null}
                </div>
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-500" />
                )}
              </button>

              {!isCollapsed && (
                <div className="p-6">
                  {hasSpanning ? (() => {
                    const allFields = section.fields
                      .map((f) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, f)! }))
                      .filter((e) => e.fieldDef != null)
                      .filter(({ layoutField, fieldDef }) => {
                        if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) return false;
                        const fx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                        return !fx?.hidden;
                      });
                    const occupied = new Set<string>();
                    const colGroups: typeof allFields[] = [];
                    for (let c = 0; c < section.columns; c++) {
                      colGroups[c] = allFields
                        .filter(e => e.layoutField.column === c)
                        .sort((a, b) => a.layoutField.order - b.layoutField.order);
                    }
                    const placed: (typeof allFields[0] & { gridRow: number; colSpan: number; rowSpan: number })[] = [];
                    for (let c = 0; c < section.columns; c++) {
                      for (const entry of colGroups[c]) {
                        const f = entry.layoutField;
                        const cs = Math.min((f as any).colSpan ?? 1, section.columns - f.column);
                        const rs = (f as any).rowSpan ?? 1;
                        let row = 1;
                        search: while (true) {
                          for (let dr = 0; dr < rs; dr++) {
                            for (let dc = 0; dc < cs; dc++) {
                              if (occupied.has(`${row + dr},${f.column + dc}`)) { row++; continue search; }
                            }
                          }
                          break;
                        }
                        placed.push({ ...entry, gridRow: row, colSpan: cs, rowSpan: rs });
                        for (let dr = 0; dr < rs; dr++) {
                          for (let dc = 0; dc < cs; dc++) {
                            occupied.add(`${row + dr},${f.column + dc}`);
                          }
                        }
                      }
                    }
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${section.columns}, 1fr)`, gridAutoRows: 'minmax(60px, auto)', gap: '1.5rem' }}>
                        {placed.map(({ layoutField, fieldDef, gridRow, colSpan, rowSpan }) => {
                          const value = getRecordValue(layoutField.apiName, fieldDef);
                          const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                          const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                          const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                          const labelCn = labelPresentationClassName(layoutField.presentation);
                          return (
                            <div
                              key={layoutField.apiName}
                              style={{
                                gridColumn: `${layoutField.column + 1} / span ${Math.min(colSpan, section.columns - layoutField.column)}`,
                                gridRow: `${gridRow} / span ${rowSpan}`,
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                              className={hl || undefined}
                            >
                              <dt className={`text-sm ${labelCn}`}>
                                {fieldDef.label}
                                {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                                {fFx?.readOnly ? (
                                  <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
                                ) : null}
                              </dt>
                              <dd
                                className="mt-1 text-sm text-gray-900 flex flex-wrap items-center gap-2"
                                style={rowSpan > 1 ? { flex: 1 } : undefined}
                              >
                                {renderValue(layoutField.apiName, value, fieldDef)}
                                {badgeC ? <span className={badgeC}>Status</span> : null}
                              </dd>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })() : (
                  <div
                    className={`grid gap-6 ${
                      section.columns === 1
                        ? 'grid-cols-1'
                        : section.columns === 2
                          ? 'grid-cols-1 md:grid-cols-2'
                          : section.columns === 4
                            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
                            : 'grid-cols-1 md:grid-cols-3'
                    }`}
                  >
                    {columnArrays.map((colFields, colIdx) => (
                      <div key={`col-${colIdx}`} className="flex flex-col gap-4">
                        {colFields.map(({ layoutField, fieldDef }) => {
                          const value = getRecordValue(layoutField.apiName, fieldDef);
                          const fFx = getFormattingEffectsForField(pageLayout, layoutField.apiName, layoutVisibilityData);
                          const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                          const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                          const labelCn = labelPresentationClassName(layoutField.presentation);
                          return (
                            <div key={layoutField.apiName} className={hl || undefined}>
                              <dt className={`text-sm ${labelCn}`}>
                                {fieldDef.label}
                                {fieldDef.required && (
                                  <span className="text-red-500 ml-1">*</span>
                                )}
                                {fFx?.readOnly ? (
                                  <span className="ml-2 text-xs font-normal text-gray-400">(read-only)</span>
                                ) : null}
                              </dt>
                              <dd className="mt-1 text-sm text-gray-900 flex flex-wrap items-center gap-2">
                                {renderValue(layoutField.apiName, value, fieldDef)}
                                {badgeC ? <span className={badgeC}>Status</span> : null}
                              </dd>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={backRoute}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to {backLabel}
          </Link>

          {(() => {
            // Resolve HeaderHighlights widget config
            let highlightApiNames: string[] = [];
            let visibleActions: Array<'edit' | 'delete'> = ['edit', 'delete'];
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
            // Legacy fallback for field names
            if (highlightApiNames.length === 0 && pageLayout?.highlightFields?.length) {
              highlightApiNames = pageLayout.highlightFields;
            }

            // For new-style layouts (editorTabs with regions), only show the header card
            // when a HeaderHighlights widget has been explicitly placed in the layout.
            // Legacy layouts (no regions) always show the card for backward compatibility.
            const showHeaderCard = hasHighlightsWidget || !isNewStyleLayout;
            if (!showHeaderCard) return null;

            const showEdit = visibleActions.includes('edit');
            const showDelete = visibleActions.includes('delete');
            const showClone = visibleActions.includes('clone');
            const showPrint = visibleActions.includes('print');

            return (
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
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {showEdit && canEdit && (
                      <button
                        onClick={handleEdit}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Edit className="w-4 h-4 mr-1.5" />
                        Edit
                      </button>
                    )}
                    {showClone && canEdit && (
                      <button
                        onClick={handleClone}
                        disabled={isCloning}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Copy className="w-4 h-4 mr-1.5" />
                        {isCloning ? 'Cloning…' : 'Clone'}
                      </button>
                    )}
                    {showPrint && (
                      <button
                        onClick={handlePrint}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <Printer className="w-4 h-4 mr-1.5" />
                        Print
                      </button>
                    )}
                    {showDelete && canDelete && (
                      <button
                        onClick={handleDelete}
                        className="inline-flex items-center px-4 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-600 bg-white hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-1.5" />
                        Delete
                      </button>
                    )}
                    {canCustomize && (
                      <div className="relative">
                        <button
                          onClick={() => setShowAdminMenu(prev => !prev)}
                          className="inline-flex items-center px-2.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                          title="Page setup"
                        >
                          <Settings className="w-4 h-4" />
                          <ChevronDown className="w-3.5 h-3.5 ml-1" />
                        </button>
                        {showAdminMenu && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setShowAdminMenu(false)} />
                            <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40">
                              <Link
                                href={`/object-manager/${encodeURIComponent(objectApiName)}`}
                                className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setShowAdminMenu(false)}
                              >
                                <Database className="w-4 h-4 text-gray-400" />
                                Edit Object
                                <ExternalLink className="w-3 h-3 text-gray-300 ml-auto" />
                              </Link>
                              {pageLayout && (
                                <Link
                                  href={`/object-manager/${encodeURIComponent(objectApiName)}/page-editor/${encodeURIComponent(pageLayout.id)}`}
                                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                                  onClick={() => setShowAdminMenu(false)}
                                >
                                  <Edit className="w-4 h-4 text-gray-400" />
                                  Edit Page Layout
                                  <ExternalLink className="w-3 h-3 text-gray-300 ml-auto" />
                                </Link>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Highlight fields row */}
                {highlightApiNames.length > 0 && (
                  <>
                    <div className="border-t border-gray-100" />
                    <div className="flex flex-wrap gap-x-8 gap-y-3 px-5 py-3 bg-gray-50/60">
                      {highlightApiNames.map((apiName) => {
                        const fd = getFieldDef(apiName);
                        if (!fd) return null;
                        if (!evaluateVisibility(fd.visibleIf, layoutVisibilityData)) return null;
                        const fFx = getFormattingEffectsForField(pageLayout!, apiName, layoutVisibilityData);
                        if (fFx?.hidden) return null;
                        const raw = getRecordValue(apiName, fd);
                        return (
                          <div key={apiName} className="min-w-[100px] max-w-[220px]">
                            <div className="text-xs text-gray-500">{fd.label}</div>
                            <div className="text-sm font-medium text-gray-900 mt-0.5 break-words">
                              {renderValue(apiName, raw, fd)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Layout-driven field rendering */}
        {pageLayout ? (
          <div className="space-y-4">
            {/* Tab navigation — only shown when layout has multiple tabs */}
            {pageLayout.tabs.length > 1 && (() => {
              const sortedTabsForNav = [...pageLayout.tabs].sort((a: any, b: any) =>
                (a.order ?? 0) - (b.order ?? 0)
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
            {/* Render only the active tab when multiple tabs, all tabs when single */}
            {pageLayout.tabs.length > 1
              ? (() => {
                  const sortedTabsForRender = [...pageLayout.tabs].sort((a: any, b: any) =>
                    (a.order ?? 0) - (b.order ?? 0)
                  );
                  const tab = sortedTabsForRender[activeTabIdx] ?? sortedTabsForRender[0];
                  const ti = activeTabIdx;
                  return renderTab(tab, ti);
                })()
              : pageLayout.tabs.map((tab, ti) => renderTab(tab, ti))
            }
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            No page layout configured for this record.
          </div>
        )}

      </div>

      {/* Edit dialog — re-uses the SAME layout */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName={objectApiName}
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={record}
          onSubmit={handleEditSubmit}
          title={`Edit ${title}`}
        />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={`Delete ${objectDef?.label ?? 'record'}`}
        description={`Are you sure you want to delete "${title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="destructive"
        onConfirm={() => { void confirmDelete(); }}
      />
    </div>
  );
}
