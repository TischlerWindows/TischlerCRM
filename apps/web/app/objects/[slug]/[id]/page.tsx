'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Database, 
  ArrowLeft, 
  Edit, 
  Trash2
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { recordsService } from '@/lib/records-service';
import { formatFieldValue } from '@/lib/utils';
import { PageLayout, FieldDef } from '@/lib/schema';

interface CustomRecord {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  [key: string]: any;
}

export default function CustomObjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema, loadSchema } = useSchemaStore();
  const { user } = useAuth();
  const [record, setRecord] = useState<CustomRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  const slug = params.slug as string;
  const recordId = params.id as string;
  const storageKey = `custom_records_${slug}`;

  // Find the object definition from schema
  const objectDef = useMemo(() => {
    if (!schema) return null;
    return schema.objects.find(obj => 
      obj.apiName.toLowerCase() === slug.toLowerCase() ||
      obj.label.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
    );
  }, [schema, slug]);

  // Load schema on mount
  useEffect(() => {
    if (!schema) {
      loadSchema();
    }
  }, [schema, loadSchema]);

  // Load record from API with localStorage fallback
  useEffect(() => {
    const loadRecord = async () => {
      try {
        const apiName = objectDef?.apiName || slug;
        const result = await recordsService.getRecord(apiName, recordId);
        if (result) {
          setRecord(recordsService.flattenRecord(result) as CustomRecord);
        } else {
          setRecord(null);
        }
      } catch (error) {
        console.error('Failed to load record from API, trying localStorage:', error);
        try {
          const storedRecords = localStorage.getItem(storageKey);
          if (storedRecords) {
            const records: CustomRecord[] = JSON.parse(storedRecords);
            const foundRecord = records.find(r => r.id === recordId);
            setRecord(foundRecord || null);
          } else {
            setRecord(null);
          }
        } catch {
          setRecord(null);
        }
      } finally {
        setLoading(false);
      }
    };
    if (recordId) {
      loadRecord();
    } else {
      setLoading(false);
    }
  }, [recordId, storageKey, slug, objectDef]);

  // Get the page layout for this record
  const getLayoutForRecord = (): PageLayout | null => {
    if (!record || !objectDef) return null;

    // Try to use the layout stored on the record
    if (record.pageLayoutId) {
      const pageLayout = objectDef.pageLayouts?.find(l => l.id === record.pageLayoutId);
      if (pageLayout) return pageLayout;
    }

    // Fall back to the layout from the record type
    const recordTypeId = record.recordTypeId;
    const recordType = recordTypeId
      ? objectDef.recordTypes?.find(rt => rt.id === recordTypeId)
      : objectDef.recordTypes?.[0];

    if (recordType?.pageLayoutId) {
      const pageLayout = objectDef.pageLayouts?.find(l => l.id === recordType.pageLayoutId);
      if (pageLayout) return pageLayout;
    }

    // Default to first layout
    return objectDef.pageLayouts?.[0] || null;
  };

  const pageLayout = getLayoutForRecord();

  // Helper function to get field definition
  const getFieldDef = (apiName: string): FieldDef | undefined => {
    return objectDef?.fields.find(f => f.apiName === apiName);
  };

  // Helper function to get lookup record display name
  const getLookupDisplayName = (fieldDef: FieldDef, value: any): string => {
    if (!value) return '-';
    
    const lookupObject = fieldDef.lookupObject;
    if (!lookupObject) return String(value);

    const storageKeyMap: Record<string, string> = {
      'Contact': 'contacts',
      'Account': 'accounts',
      'Property': 'properties',
      'Lead': 'leads',
      'Deal': 'deals',
      'User': 'users',
      'Product': 'products',
      'Quote': 'quotes',
      'Project': 'projects',
      'Service': 'services',
      'Installation': 'installations'
    };
    
    const storageKey = storageKeyMap[lookupObject];
    if (!storageKey) {
      // Check if it's a custom object
      const customStorageKey = `custom_records_${lookupObject.toLowerCase()}`;
      const customRecords = localStorage.getItem(customStorageKey);
      if (customRecords) {
        try {
          const records = JSON.parse(customRecords);
          const relatedRecord = records.find((r: any) => String(r.id) === String(value));
          if (relatedRecord) {
            return relatedRecord.name || relatedRecord.label || relatedRecord.title || String(value);
          }
        } catch {
          // Ignore parse errors
        }
      }
      return String(value);
    }

    const storedRecords = localStorage.getItem(storageKey);
    if (!storedRecords) return String(value);

    try {
      const records = JSON.parse(storedRecords);
      const relatedRecord = records.find((r: any) => String(r.id) === String(value));
      
      if (relatedRecord) {
        switch (lookupObject) {
          case 'Contact': {
            const name = relatedRecord.name;
            if (name && typeof name === 'object') {
              const parts = [name.salutation, name.firstName, name.lastName].filter(Boolean);
              if (parts.length > 0) return parts.join(' ');
            }
            if (relatedRecord.firstName || relatedRecord.lastName) {
              return [relatedRecord.firstName, relatedRecord.lastName].filter(Boolean).join(' ');
            }
            return relatedRecord.email || relatedRecord.contactNumber || String(value);
          }
          case 'Account':
            return relatedRecord.accountName || relatedRecord.name || relatedRecord.accountNumber || String(value);
          case 'Property':
            return relatedRecord.propertyName || relatedRecord.name || relatedRecord.propertyNumber || relatedRecord.address || String(value);
          case 'Lead':
            return relatedRecord.leadName || relatedRecord.name || relatedRecord.leadNumber || relatedRecord.company || String(value);
          case 'Deal':
            return relatedRecord.dealName || relatedRecord.name || relatedRecord.dealNumber || String(value);
          case 'Product':
            return relatedRecord.productName || relatedRecord.name || relatedRecord.productNumber || String(value);
          case 'Quote':
            return relatedRecord.quoteName || relatedRecord.name || relatedRecord.quoteNumber || String(value);
          case 'Project':
            return relatedRecord.projectName || relatedRecord.name || relatedRecord.projectNumber || String(value);
          case 'Service':
            return relatedRecord.serviceName || relatedRecord.name || relatedRecord.serviceNumber || String(value);
          case 'Installation':
            return relatedRecord.installationName || relatedRecord.name || relatedRecord.installationNumber || String(value);
          case 'User':
            return relatedRecord.name || relatedRecord.email || String(value);
          default:
            return relatedRecord.name || relatedRecord.label || String(value);
        }
      }
    } catch {
      // Ignore parse errors
    }

    return String(value);
  };

  // Helper function to render field value with links
  const renderFieldValue = (apiName: string, value: any, fieldDef?: FieldDef): React.ReactNode => {
    if (!value) return '-';

    const fieldType = fieldDef?.type;

    // Handle Lookup fields - show the related record's name, not the ID
    if (fieldType === 'Lookup' && fieldDef) {
      const displayName = getLookupDisplayName(fieldDef, value);
      const lookupObject = fieldDef.lookupObject;
      
      // Make it a link if we know the object type
      if (lookupObject) {
        const routeMap: Record<string, string> = {
          'Contact': 'contacts',
          'Account': 'accounts',
          'Property': 'properties',
          'Lead': 'leads',
          'Deal': 'deals',
          'Product': 'products',
          'Quote': 'quotes',
          'Project': 'projects',
          'Service': 'service',
          'Installation': 'installations'
        };
        const route = routeMap[lookupObject];
        if (route) {
          return (
            <Link href={`/${route}/${value}`} className="text-indigo-600 hover:text-indigo-700">
              {displayName}
            </Link>
          );
        }
        // Check if it's a custom object
        return (
          <Link href={`/objects/${lookupObject.toLowerCase()}/${value}`} className="text-indigo-600 hover:text-indigo-700">
            {displayName}
          </Link>
        );
      }
      return displayName;
    }

    // Handle email links
    if (fieldType === 'Email') {
      return (
        <a href={`mailto:${value}`} className="text-indigo-600 hover:text-indigo-700">
          {value}
        </a>
      );
    }

    // Handle phone links
    if (fieldType === 'Phone') {
      return (
        <a href={`tel:${value}`} className="text-indigo-600 hover:text-indigo-700">
          {value}
        </a>
      );
    }

    // Format the value
    return formatFieldValue(value, fieldType);
  };

  const handleEdit = () => {
    if (!pageLayout) {
      alert('No page layout configured for this record type.');
      return;
    }
    setShowEditForm(true);
  };

  const handleEditSubmit = async (data: Record<string, any>) => {
    if (record && objectDef) {
      try {
        const apiName = objectDef.apiName || slug;
        await recordsService.updateRecord(apiName, record.id, { data });
        setRecord({ ...record, ...data });
      } catch (error) {
        console.error('Failed to update record via API:', error);
        alert('Failed to update record. Please try again.');
      }
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        const apiName = objectDef?.apiName || slug;
        await recordsService.deleteRecord(apiName, record!.id);
        router.push(`/objects/${slug}`);
      } catch (error) {
        console.error('Failed to delete record via API:', error);
        alert('Failed to delete record. Please try again.');
      }
    }
  };

  const convertRecordToFormData = (rec: CustomRecord): Record<string, any> => {
    const formData: Record<string, any> = {};
    Object.keys(rec).forEach(key => {
      formData[key] = rec[key];
    });
    return formData;
  };

  // Get display name for the record
  const getRecordDisplayName = (): string => {
    if (!record) return 'Record';
    // Try common name fields
    return record.name || record.title || record.label || record.id || 'Record';
  };

  if (loading || !schema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!objectDef) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Object Not Found</h2>
          <p className="text-gray-600 mb-6">The object &quot;{slug}&quot; does not exist.</p>
          <Link
            href="/object-manager"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go to Object Manager
          </Link>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Record Not Found</h2>
          <p className="text-gray-600 mb-6">The record you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href={`/objects/${slug}`}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to {objectDef.label}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/objects/${slug}`}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to {objectDef.label}
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{getRecordDisplayName()}</h1>
                  <p className="text-gray-600">{objectDef.label}</p>
                </div>
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

        {/* Dynamic Layout Rendering */}
        {pageLayout ? (
          <div className="space-y-6">
            {pageLayout.tabs.map((tab, tabIndex) => (
              <div key={tabIndex}>
                {tab.sections.map((section, sectionIndex) => {
                  // Organize fields by column and row
                  const fieldsByRow: Record<number, Record<number, typeof section.fields[0]>> = {};
                  section.fields.forEach(field => {
                    const row = Math.floor(field.order / section.columns);
                    if (!fieldsByRow[row]) fieldsByRow[row] = {};
                    fieldsByRow[row][field.column] = field;
                  });

                  return (
                    <div key={sectionIndex} className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
                      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                        <h3 className="font-medium text-gray-900">{section.label}</h3>
                      </div>
                      <div className="p-6">
                        <div className="space-y-6">
                          {Object.keys(fieldsByRow).sort((a, b) => parseInt(a) - parseInt(b)).map((rowKey) => {
                            const row = fieldsByRow[parseInt(rowKey)];
                            if (!row) return null;
                            const rowFields = Object.keys(row).sort((a, b) => parseInt(a) - parseInt(b)).map(col => row[parseInt(col)]).filter(Boolean);
                            
                            return (
                              <div
                                key={rowKey}
                                className={`grid gap-6 ${
                                  section.columns === 1 ? 'grid-cols-1' :
                                  section.columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                  'grid-cols-1 md:grid-cols-3'
                                }`}
                              >
                                {rowFields.map((layoutField) => {
                                  if (!layoutField) return null;
                                  const fieldDef = getFieldDef(layoutField.apiName);
                                  // Try both with and without prefix
                                  const value = record[layoutField.apiName] || record[layoutField.apiName.replace(/^[^_]+__/, '')];
                                  
                                  if (!fieldDef) return null;

                                  return (
                                    <div key={layoutField.apiName}>
                                      <dt className="text-sm font-medium text-gray-700">
                                        {fieldDef.label}
                                        {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                                      </dt>
                                      <dd className="mt-1 text-sm text-gray-900">
                                        {renderFieldValue(layoutField.apiName, value, fieldDef)}
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
            No page layout configured for this record type.
            <Link href={`/object-manager/${objectDef.apiName}`} className="ml-2 text-indigo-600 hover:underline">
              Configure in Object Manager
            </Link>
          </div>
        )}
      </div>

      {/* Edit Form Dialog */}
      {pageLayout && objectDef && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName={objectDef.apiName}
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={convertRecordToFormData(record)}
          onSubmit={handleEditSubmit}
          title={`Edit ${getRecordDisplayName()}`}
        />
      )}
    </div>
  );
}
