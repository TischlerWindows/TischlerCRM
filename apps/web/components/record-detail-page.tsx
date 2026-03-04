'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Database } from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { formatFieldValue } from '@/lib/utils';
import { PageLayout, FieldDef, ObjectDef } from '@/lib/schema';
import { recordsService, RecordData } from '@/lib/records-service';

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

  const [rawRecord, setRawRecord] = useState<RecordData | null>(null);
  const [record, setRecord] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  const objectDef: ObjectDef | undefined = schema?.objects.find(
    (o) => o.apiName.toLowerCase() === objectApiName.toLowerCase()
  );

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

  // ── Helpers ──────────────────────────────────────────────────────────
  const getFieldDef = (apiName: string): FieldDef | undefined =>
    objectDef?.fields.find((f) => f.apiName === apiName);

  /** Read a value from the flattened record, trying prefixed then stripped key. */
  const getRecordValue = (apiName: string, fieldDef?: FieldDef): any => {
    if (!record) return undefined;

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
  const renderValue = (apiName: string, value: any, fieldDef?: FieldDef): React.ReactNode => {
    if (value === null || value === undefined || value === '') return '-';

    const fieldType = fieldDef?.type;

    // Lookup → clickable link
    if (fieldType === 'Lookup' && fieldDef?.lookupObject) {
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
      const route = routeMap[fieldDef.lookupObject];
      if (route) {
        return (
          <Link href={`/${route}/${value}`} className="text-brand-navy hover:text-brand-navy">
            {String(value)}
          </Link>
        );
      }
      return String(value);
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
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-brand-navy hover:text-brand-navy">
          {value}
        </a>
      );
    }

    // Checkbox
    if (fieldType === 'Checkbox') {
      return value ? 'Yes' : 'No';
    }

    // Address (object)
    if (fieldType === 'Address' && typeof value === 'object') {
      const parts = [value.street, value.city, value.state, value.postalCode, value.country].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : '-';
    }

    return formatFieldValue(value, fieldType);
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

  const getRecordSubtitle = (): string => {
    if (!record) return '';
    // Try composite name first
    const nameObj = record[`${objectApiName}__name`] || record.name;
    if (nameObj && typeof nameObj === 'object') {
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
      const updated = await recordsService.updateRecord(objectApiName, record.id, { data });
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
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Layout-driven field rendering */}
        {pageLayout ? (
          <div className="space-y-6">
            {pageLayout.tabs.map((tab, ti) => (
              <div key={ti}>
                {tab.sections.map((section, si) => {
                  // Group fields into rows (order / columns)
                  const rows: Record<number, Record<number, (typeof section.fields)[0]>> = {};
                  section.fields.forEach((f) => {
                    const row = Math.floor(f.order / section.columns);
                    if (!rows[row]) rows[row] = {};
                    rows[row][f.column] = f;
                  });

                  return (
                    <div key={si} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="font-medium text-gray-900">{section.label}</h3>
                      </div>
                      <div className="p-6">
                        <div className="space-y-6">
                          {Object.keys(rows)
                            .sort((a, b) => +a - +b)
                            .map((rowKey) => {
                              const rowData = rows[+rowKey];
                              if (!rowData) return null;
                              const cells = Object.keys(rowData)
                                .sort((a, b) => +a - +b)
                                .map((col) => rowData[+col])
                                .filter((f): f is NonNullable<typeof f> => Boolean(f));

                              return (
                                <div
                                  key={rowKey}
                                  className={`grid gap-6 ${
                                    section.columns === 1
                                      ? 'grid-cols-1'
                                      : section.columns === 2
                                      ? 'grid-cols-1 md:grid-cols-2'
                                      : 'grid-cols-1 md:grid-cols-3'
                                  }`}
                                >
                                  {cells.map((layoutField) => {
                                    const fieldDef = getFieldDef(layoutField.apiName);
                                    if (!fieldDef) return null;
                                    const value = getRecordValue(layoutField.apiName, fieldDef);

                                    return (
                                      <div key={layoutField.apiName}>
                                        <dt className="text-sm font-medium text-gray-700">
                                          {fieldDef.label}
                                          {fieldDef.required && (
                                            <span className="text-red-500 ml-1">*</span>
                                          )}
                                        </dt>
                                        <dd className="mt-1 text-sm text-gray-900">
                                          {renderValue(layoutField.apiName, value, fieldDef)}
                                        </dd>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                        </div>
                      </div>
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
