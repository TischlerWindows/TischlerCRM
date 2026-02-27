'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  ArrowLeft, 
  Edit, 
  Trash2
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { formatFieldValue } from '@/lib/utils';
import { recordsService } from '@/lib/records-service';
import { PageLayout, FieldDef } from '@/lib/schema';

interface Installation {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  installationNumber: string;
  [key: string]: any;
}

function getLayoutForRecord(record: Installation | null, object: any): PageLayout | null {
  if (!record || !object) return null;

  if (record.pageLayoutId) {
    const pageLayout = object.pageLayouts?.find((l: any) => l.id === record.pageLayoutId);
    if (pageLayout) return pageLayout;
  }

  const recordType = record.recordTypeId
    ? object.recordTypes?.find((rt: any) => rt.id === record.recordTypeId)
    : object.recordTypes?.[0];

  if (recordType?.pageLayoutId) {
    const pageLayout = object.pageLayouts?.find((l: any) => l.id === recordType.pageLayoutId);
    if (pageLayout) return pageLayout;
  }

  return object.pageLayouts?.[0] || null;
}

function getFieldDef(object: any, apiName: string): FieldDef | undefined {
  return object?.fields.find((f: any) => f.apiName === apiName);
}

function getLookupDisplayName(object: any, fieldDef: FieldDef, value: any): string {
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
  if (!storageKey) return String(value);

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
  } catch { /* ignore */ }

  return String(value);
}

function renderFieldValue(object: any, record: Installation, apiName: string, value: any, fieldDef?: FieldDef): React.ReactNode {
  if (!value) return '-';
  
  // Handle Lookup fields
  if (fieldDef?.type === 'Lookup' && fieldDef) {
    const displayName = getLookupDisplayName(object, fieldDef, value);
    const lookupObject = fieldDef.lookupObject;
    
    if (lookupObject) {
      const routeMap: Record<string, string> = {
        'Contact': 'contacts',
        'Account': 'accounts',
        'Property': 'properties',
        'Lead': 'leads',
        'Deal': 'deals',
        'Project': 'projects',
        'Quote': 'quotes',
        'Product': 'products',
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
    }
    return displayName;
  }
  
  return formatFieldValue(value, fieldDef?.type);
}

export default function InstallationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const [installation, setInstallation] = useState<Installation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Get Installation object from schema
  const installationObject = schema?.objects.find(obj => obj.apiName === 'Installation');

  // Load installation from API (with localStorage fallback)
  useEffect(() => {
    const loadRecord = async () => {
      try {
        const record = await recordsService.getRecord('Installation', params?.id as string);
        if (record) {
          setInstallation(recordsService.flattenRecord(record) as Installation);
        } else {
          setInstallation(null);
        }
      } catch (error) {
        console.error('Failed to fetch installation from API, trying localStorage:', error);
        const stored = localStorage.getItem('installations');
        if (stored) {
          const items: Installation[] = JSON.parse(stored);
          const found = items.find(i => i.id === params?.id);
          setInstallation(found || null);
        }
      } finally {
        setLoading(false);
      }
    };
    if (params?.id) {
      loadRecord();
    } else {
      setLoading(false);
    }
  }, [params?.id]);

  const pageLayout = getLayoutForRecord(installation, installationObject);

  const handleEdit = () => {
    if (!pageLayout) {
      alert('No page layout configured for this record type.');
      return;
    }
    setShowEditForm(true);
  };

  const handleEditSubmit = async (data: Record<string, any>) => {
    if (installation) {
      try {
        const updated = await recordsService.updateRecord('Installation', installation.id, { data });
        if (updated) {
          setInstallation(recordsService.flattenRecord(updated) as Installation);
        }
      } catch (error) {
        console.error('Failed to update installation via API:', error);
        setInstallation({ ...installation, ...data });
      }
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this installation?') && installation) {
      try {
        await recordsService.deleteRecord('Installation', installation.id);
      } catch (error) {
        console.error('Failed to delete installation via API:', error);
      }
      router.push('/installations');
    }
  };

  const convertInstallationToFormData = (i: Installation): Record<string, any> => {
    const formData: Record<string, any> = {};
    Object.keys(i).forEach(key => {
      formData[key] = i[key];
    });
    return formData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading installation...</div>
      </div>
    );
  }

  if (!installation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Zap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Installation Not Found</h2>
          <p className="text-gray-600 mb-6">The installation you're looking for doesn't exist.</p>
          <Link
            href="/installations"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Installations
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
            href="/installations"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Installations
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{installation.installationNumber}</h1>
                  <p className="text-gray-600">
                    {installation.installationName}
                    {installation.status && <> - {installation.status}</>}
                  </p>
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
                                  const fieldDef = getFieldDef(installationObject, layoutField.apiName);
                                  const value = installation[layoutField.apiName] || installation[layoutField.apiName.replace(/^[^_]+__/, '')];
                                  
                                  if (!fieldDef) return null;

                                  return (
                                    <div key={layoutField.apiName}>
                                      <dt className="text-sm font-medium text-gray-700">
                                        {fieldDef.label}
                                        {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
                                      </dt>
                                      <dd className="mt-1 text-sm text-gray-900">
                                        {renderFieldValue(installationObject, installation, layoutField.apiName, value, fieldDef)}
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
            No page layout configured for this installation's record type.
          </div>
        )}
      </div>

      {/* Edit Form Dialog */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName="Installation"
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={convertInstallationToFormData(installation)}
          onSubmit={handleEditSubmit}
          title={`Edit ${installation.installationNumber}`}
        />
      )}
    </div>
  );
}
