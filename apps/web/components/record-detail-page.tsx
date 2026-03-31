'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Database, ChevronDown, ChevronRight, Settings, ExternalLink, FileSpreadsheet } from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { usePermissions } from '@/lib/permissions-context';
import { formatFieldValue, resolveLookupDisplayName, preloadLookupRecords } from '@/lib/utils';
import { PageLayout, PageField, FieldDef, ObjectDef, normalizeFieldType } from '@/lib/schema';
import { evaluateVisibility } from '@/lib/field-visibility';
import {
  getFormattingEffectsForField,
  getFormattingEffectsForSection,
} from '@/lib/layout-formatting';
import {
  badgePillClass,
  fieldHighlightWrapperClass,
  labelPresentationClassName,
} from '@/lib/layout-presentation';
import { recordsService, RecordData } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { useFormulaFields } from '@/lib/use-formula-fields';
import LocationMapPreview from '@/components/location-map-preview';
import { DropboxFileBrowser } from '@/components/dropbox-file-browser';

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

  const [rawRecord, setRawRecord] = useState<RecordData | null>(null);
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  // Tracks which sections the user has manually toggled open/closed
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({});
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  // Counter bumped after lookup records finish loading to trigger re-render
  const [lookupTick, setLookupTick] = useState(0);

  // When a Lead/Opportunity is linked to a Property, redirect its file browser
  // into the Property's subfolder (e.g. /Property/{addr}/Leads/{childName}).
  // null = still resolving, false = no linked parent, object = linked info
  const [linkedDropboxInfo, setLinkedDropboxInfo] = useState<{
    objectApiName: string;
    recordId: string;
    folderName: string;
    subPath: string;
  } | false | null>(null);

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

  // ── Auto-create linked subfolder inside parent Property's Dropbox folder ──
  // When a Lead or Opportunity record has a propertyId, create a
  // subfolder like /TischlerCRM/Property/{addr}/Leads/{leadFolder} automatically.
  // Also redirect the DropboxFileBrowser to browse this subfolder.
  const LINKED_SUBFOLDER: Record<string, string> = { Lead: 'Leads', Opportunity: 'Project Books', WorkOrder: 'Service' };
  useEffect(() => {
    if (!record || !params?.id) return;
    // Only for object types that map to a Property subfolder
    const LINKED_TYPES = ['Lead', 'Opportunity', 'WorkOrder'];
    if (!LINKED_TYPES.includes(objectApiName)) return;

    // Find the property lookup value (could be propertyId, Property__propertyId, etc.)
    const propKey = Object.keys(record).find(k => {
      const lk = k.toLowerCase().replace(/^[a-z]+__/, '');
      return lk === 'propertyid' || lk === 'property';
    });
    const propertyRecordId = propKey ? record[propKey] : null;
    if (!propertyRecordId || typeof propertyRecordId !== 'string') {
      setLinkedDropboxInfo(false);
      return;
    }

    // Build a child folder name from the record (same logic as getDropboxFolderName)
    const numberKey = Object.keys(record).find(
      k => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k]
    );
    const nameKey = Object.keys(record).find(
      k => (k.toLowerCase() === 'name' || k.toLowerCase().endsWith('__name')) && typeof record[k] === 'string' && record[k]
    );
    const childName = (numberKey ? record[numberKey] : '') || (nameKey ? record[nameKey] : '') || params.id as string;

    // Fetch the parent Property record to get its folder name
    (async () => {
      try {
        const parentRaw = await recordsService.getRecord('Property', propertyRecordId);
        if (!parentRaw) { setLinkedDropboxInfo(false); return; }
        const parent = recordsService.flattenRecord(parentRaw);
        // Build parent folder name the same way getDropboxFolderName does
        const pNumKey = Object.keys(parent).find(k => k.toLowerCase().includes('number') && typeof parent[k] === 'string' && parent[k]);
        let addrStr = '';
        const streetKey = Object.keys(parent).find(k => {
          const lk = k.toLowerCase();
          return lk === 'street_address' || lk === 'property_address' || lk.endsWith('__street_address') || lk.endsWith('__property_address');
        });
        if (streetKey && typeof parent[streetKey] === 'string') addrStr = parent[streetKey];
        if (!addrStr) {
          const addrKey = Object.keys(parent).find(k => { const lk = k.toLowerCase(); return lk === 'address' || lk.endsWith('__address'); });
          if (addrKey) {
            let addr = parent[addrKey];
            if (typeof addr === 'string' && addr.startsWith('{')) { try { addr = JSON.parse(addr); } catch { /* ignore */ } }
            if (typeof addr === 'object' && addr !== null) addrStr = addr.street || addr.address || addr.addressLine1 || '';
            else if (typeof addr === 'string') addrStr = addr;
          }
        }
        const autoNum = pNumKey ? parent[pNumKey] : '';
        const parentFolderName = addrStr && autoNum ? `${addrStr} (${autoNum})` : addrStr || autoNum || propertyRecordId;

        // Point the file browser at the Property subfolder
        const subfolder = LINKED_SUBFOLDER[objectApiName] || objectApiName;
        setLinkedDropboxInfo({
          objectApiName: 'Property',
          recordId: propertyRecordId,
          folderName: parentFolderName,
          subPath: `${subfolder}/${childName}`,
        });

        await apiClient.ensureDropboxLinkedFolder({
          parentObjectApiName: 'Property',
          parentRecordId: propertyRecordId,
          parentFolderName,
          childObjectApiName: objectApiName,
          childFolderName: childName,
        });
      } catch { setLinkedDropboxInfo(false); /* non-fatal — Dropbox may not be connected */ }
    })();
  }, [record, params?.id, objectApiName]);

  // ── Resolve layout ───────────────────────────────────────────────────
  const resolveLayout = (): PageLayout | null => {
    if (!record || !objectDef) return null;

    // 1. Layout stored on the record itself (the layout used to create it)
    if (record.pageLayoutId) {
      const layout = objectDef.pageLayouts?.find((l) => l.id === record.pageLayoutId);
      if (layout) return layout;
    }

    // 2. Fallback: layout from the record type
    const rt = record.recordTypeId
      ? objectDef.recordTypes?.find((r) => r.id === record.recordTypeId)
      : objectDef.recordTypes?.[0];
    if (rt?.pageLayoutId) {
      const layout = objectDef.pageLayouts?.find((l) => l.id === rt.pageLayoutId);
      if (layout) return layout;
    }

    // 3. Last resort: first available layout
    return objectDef.pageLayouts?.[0] ?? null;
  };

  const pageLayout = resolveLayout();

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
        Opportunity: 'opportunities',
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
          <Link href={`/${route}/${value}`} className="text-brand-navy hover:text-brand-navy">
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
        <a href={`mailto:${value}`} className="text-brand-navy hover:text-brand-navy">
          {value}
        </a>
      );
    }

    // Phone
    if (fieldType === 'Phone') {
      return (
        <a href={`tel:${value}`} className="text-brand-navy hover:text-brand-navy">
          {value}
        </a>
      );
    }

    // URL
    if (fieldType === 'URL') {
      const href = fieldDef?.staticUrl || value;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:text-brand-navy">
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
          Lead: 'leads', Opportunity: 'opportunities', Product: 'products',
          Quote: 'quotes', Project: 'projects', Service: 'service',
          Installation: 'installations',
        };
        const route = routeMap[lookupTarget];
        const displayLabel = resolveLookupDisplayName(value.lookup, lookupTarget);
        void lookupTick;
        lookupPart = route ? (
          <Link href={`/${route}/${value.lookup}`} className="text-brand-navy hover:text-brand-navy">
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

    // Date → MM-DD-YYYY
    if (fieldType === 'Date' && typeof value === 'string') {
      const d = new Date(value + (value.includes('T') ? '' : 'T00:00:00'));
      if (!isNaN(d.getTime())) {
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${mm}-${dd}-${yyyy}`;
      }
    }

    // DateTime → MM-DD-YYYY HH:MM
    if (fieldType === 'DateTime' && typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
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
    return record.id;
  };

  /** Build a Dropbox folder name: "6 Suburban Avenue (CT00001)" */
  const getDropboxFolderName = (): string => {
    if (!record) return '';
    // Find the auto-number (propertyNumber, contactNumber, etc.)
    const numberKey = Object.keys(record).find(
      (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k]
    );
    const autoNumber = numberKey ? record[numberKey] : '';

    // Try to find the street address from multiple possible sources:
    // 1. street_address or property_address (standalone text fields)
    // 2. address composite object's street sub-field
    // 3. address as plain text string
    let addrStr = '';

    // Check standalone street address fields first
    const streetKey = Object.keys(record).find((k) => {
      const lk = k.toLowerCase();
      return lk === 'street_address' || lk === 'property_address' ||
             lk.endsWith('__street_address') || lk.endsWith('__property_address');
    });
    if (streetKey && typeof record[streetKey] === 'string' && record[streetKey]) {
      addrStr = record[streetKey];
    }

    // Fall back to composite address object or plain address string
    if (!addrStr) {
      const addrKey = Object.keys(record).find((k) => {
        const lk = k.toLowerCase();
        return lk === 'address' || lk.endsWith('__address');
      });
      if (addrKey) {
        let addr = record[addrKey];
        if (typeof addr === 'string' && addr.startsWith('{')) {
          try { addr = JSON.parse(addr); } catch { /* not JSON */ }
        }
        if (typeof addr === 'object' && addr !== null) {
          addrStr = addr.street || addr.address || addr.addressLine1 || '';
        } else if (typeof addr === 'string' && addr) {
          addrStr = addr;
        }
      }
    }

    if (addrStr && autoNumber) return `${addrStr} (${autoNumber})`;
    if (addrStr) return addrStr;
    if (autoNumber) return autoNumber;
    return record.id;
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
      alert('No page layout found for this record.');
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

  const handleDelete = async () => {
    if (!record) return;
    if (!confirm(`Are you sure you want to delete this ${objectDef?.label ?? 'record'}?`)) return;
    try {
      await recordsService.deleteRecord(objectApiName, record.id);
    } catch (err) {
      console.error('Failed to delete record:', err);
    }
    router.push(backRoute);
  };

  // ── Loading / not found ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading {objectDef?.label ?? 'record'}...</div>
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

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={backRoute}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to {backLabel}
          </Link>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <IconComponent className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                {subtitle && subtitle !== title && (
                  <p className="text-gray-600">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {objectApiName === 'Opportunity' && record && (
              <button
                onClick={() => {
                  const numberKey = Object.keys(record).find(
                    (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k]
                  );
                  const oppNumber = numberKey ? record[numberKey] : '';
                  const oppName = typeof record.name === 'string' ? record.name : '';
                  const params = new URLSearchParams({ fromOpportunity: record.id });
                  if (oppName) params.set('opportunityName', oppName);
                  if (oppNumber) params.set('opportunityNumber', oppNumber);
                  router.push(`/summary?${params.toString()}`);
                }}
                className="inline-flex items-center px-4 py-2 border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                New Summary
              </button>
              )}
              {canEdit && (
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              )}
              {canDelete && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
              )}
              {canCustomize && (
              <div className="relative">
                <button
                  onClick={() => setShowAdminMenu(prev => !prev)}
                  className="inline-flex items-center px-2.5 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500"
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
                        href={`/object-manager/${objectApiName}`}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setShowAdminMenu(false)}
                      >
                        <Database className="w-4 h-4 text-gray-400" />
                        Edit Object
                        <ExternalLink className="w-3 h-3 text-gray-300 ml-auto" />
                      </Link>
                      {pageLayout && (
                        <Link
                          href={`/object-manager/${objectApiName}?section=page-editor&layoutId=${pageLayout.id}`}
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
        </div>

        {/* Layout-driven field rendering */}
        {pageLayout ? (
          <div className="space-y-6">
            {pageLayout.tabs.map((tab, ti) => (
              <div key={ti}>
                {tab.sections.map((section, si) => {
                  if (section.showInRecord === false) return null;
                  if (!evaluateVisibility(section.visibleIf, layoutVisibilityData)) return null;
                  const sectionFx = pageLayout
                    ? getFormattingEffectsForSection(pageLayout, section.id, layoutVisibilityData)
                    : null;
                  if (sectionFx?.hidden) return null;

                  // Column-based layout: group fields by column, sorted by
                  // order within each column (same approach as DynamicForm).
                  const columnArrays: { layoutField: typeof section.fields[0]; fieldDef: FieldDef }[][] = [];
                  for (let c = 0; c < section.columns; c++) {
                    columnArrays[c] = section.fields
                      .filter((f) => f.column === c)
                      .sort((a, b) => a.order - b.order)
                      .map((f) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, f)! }))
                      .filter((entry) => entry.fieldDef != null)
                      .filter(({ layoutField, fieldDef }) => {
                        if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) {
                          return false;
                        }
                        const fFx = pageLayout
                          ? getFormattingEffectsForField(
                              pageLayout,
                              layoutField.apiName,
                              layoutVisibilityData
                            )
                          : null;
                        if (fFx?.hidden) return false;
                        return true;
                      });
                  }

                  // Check if any field uses spanning
                  const hasSpanning = section.fields.some(
                    (f) => ((f as any).colSpan ?? 1) > 1 || ((f as any).rowSpan ?? 1) > 1
                  );

                  // Determine if every field in this section is empty
                  const allFieldsEmpty = columnArrays.every((col) =>
                    col.every(({ layoutField, fieldDef }) => {
                      if (fieldDef.type === 'LocationSearch') return false;
                      const v = getRecordValue(layoutField.apiName, fieldDef);
                      return v === undefined || v === null || v === '' || v === 'N/A';
                    })
                  );

                  if (allFieldsEmpty) return null;

                  const sectionKey = `${ti}-${si}`;
                  const isCollapsed = sectionToggles[sectionKey] === false;

                  const toggleSection = () => {
                    setSectionToggles((prev) => ({
                      ...prev,
                      [sectionKey]: !isCollapsed ? false : undefined!,
                    }));
                    // Clean up undefined entries
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
                    <div key={si} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
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
                            // Spanning mode: CSS grid with explicit row/col placement
                            const allFields = section.fields
                              .map((f) => ({ layoutField: f, fieldDef: getFieldDef(f.apiName, f)! }))
                              .filter((e) => e.fieldDef != null)
                              .filter(({ layoutField, fieldDef }) => {
                                if (!evaluateVisibility(fieldDef.visibleIf, layoutVisibilityData)) {
                                  return false;
                                }
                                const fx = pageLayout
                                  ? getFormattingEffectsForField(
                                      pageLayout,
                                      layoutField.apiName,
                                      layoutVisibilityData
                                    )
                                  : null;
                                return !fx?.hidden;
                              });
                            // Grid-cell occupation: spanning fields only push down overlapping fields
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
                                  const fFx = pageLayout
                                    ? getFormattingEffectsForField(
                                        pageLayout,
                                        layoutField.apiName,
                                        layoutVisibilityData
                                      )
                                    : null;
                                  const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                                  const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                                  const labelCn = labelPresentationClassName(
                                    layoutField.presentation
                                  );
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
                                          <span className="ml-2 text-xs font-normal text-gray-400">
                                            (read-only)
                                          </span>
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
                                : 'grid-cols-1 md:grid-cols-3'
                            }`}
                          >
                            {columnArrays.map((colFields, colIdx) => (
                              <div key={`col-${colIdx}`} className="flex flex-col gap-4">
                                {colFields.map(({ layoutField, fieldDef }) => {
                                  const value = getRecordValue(layoutField.apiName, fieldDef);
                                  const fFx = pageLayout
                                    ? getFormattingEffectsForField(
                                        pageLayout,
                                        layoutField.apiName,
                                        layoutVisibilityData
                                      )
                                    : null;
                                  const hl = fieldHighlightWrapperClass(fFx?.highlightToken);
                                  const badgeC = fFx?.badge ? badgePillClass(fFx.badge) : '';
                                  const labelCn = labelPresentationClassName(
                                    layoutField.presentation
                                  );
                                  return (
                                    <div key={layoutField.apiName} className={hl || undefined}>
                                      <dt className={`text-sm ${labelCn}`}>
                                        {fieldDef.label}
                                        {fieldDef.required && (
                                          <span className="text-red-500 ml-1">*</span>
                                        )}
                                        {fFx?.readOnly ? (
                                          <span className="ml-2 text-xs font-normal text-gray-400">
                                            (read-only)
                                          </span>
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
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center text-gray-500">
            No page layout configured for this record.
          </div>
        )}

      </div>

      {/* Dropbox file browser — hardcoded at end of every record */}
      {/* For linked types (Lead/Opportunity), wait for property resolution before rendering */}
      {record && params?.id &&
        (!['Lead', 'Opportunity', 'WorkOrder'].includes(objectApiName) || linkedDropboxInfo !== null) && (
        <div className="max-w-6xl mx-auto px-6 pb-6">
          <DropboxFileBrowser
            objectApiName={linkedDropboxInfo && linkedDropboxInfo !== false ? linkedDropboxInfo.objectApiName : objectApiName}
            recordId={linkedDropboxInfo && linkedDropboxInfo !== false ? linkedDropboxInfo.recordId : (params.id as string)}
            folderName={linkedDropboxInfo && linkedDropboxInfo !== false ? linkedDropboxInfo.folderName : getDropboxFolderName()}
            defaultSubPath={linkedDropboxInfo && linkedDropboxInfo !== false ? linkedDropboxInfo.subPath : undefined}
            rootLabel={linkedDropboxInfo && linkedDropboxInfo !== false ? linkedDropboxInfo.folderName : undefined}
          />
        </div>
      )}

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
    </div>
  );
}
