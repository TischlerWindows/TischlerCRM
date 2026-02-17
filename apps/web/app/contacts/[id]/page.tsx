'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  ArrowLeft, 
  Edit, 
  Trash2,
  Calendar,
  User,
  Clock
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { formatFieldValue } from '@/lib/utils';
import { PageLayout, FieldDef } from '@/lib/schema';

interface Contact {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  contactNumber: string;
  [key: string]: any;
}

export default function ContactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);

  // Get Contact object from schema
  const contactObject = schema?.objects.find(obj => obj.apiName === 'Contact');

  // Load contact from localStorage
  useEffect(() => {
    const storedContacts = localStorage.getItem('contacts');
    if (storedContacts && params?.id) {
      const contacts: Contact[] = JSON.parse(storedContacts);
      const foundContact = contacts.find(c => c.id === params.id as string);
      setContact(foundContact || null);
    }
    setLoading(false);
  }, [params?.id]);

  // Get the page layout for this contact
  const getLayoutForContact = (): PageLayout | null => {
    if (!contact || !contactObject) return null;

    // Try to use the layout stored on the record
    if (contact.pageLayoutId) {
      const pageLayout = contactObject.pageLayouts?.find(l => l.id === contact.pageLayoutId);
      if (pageLayout) return pageLayout;
    }

    // Fall back to the layout from the record type
    const recordTypeId = contact.recordTypeId;
    const recordType = recordTypeId
      ? contactObject.recordTypes?.find(rt => rt.id === recordTypeId)
      : contactObject.recordTypes?.[0];

    if (recordType?.pageLayoutId) {
      const pageLayout = contactObject.pageLayouts?.find(l => l.id === recordType.pageLayoutId);
      if (pageLayout) return pageLayout;
    }

    // Default to first layout
    return contactObject.pageLayouts?.[0] || null;
  };

  const pageLayout = getLayoutForContact();

  // Helper function to get field definition
  const getFieldDef = (apiName: string): FieldDef | undefined => {
    return contactObject?.fields.find(f => f.apiName === apiName);
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
    if (!storageKey) return String(value);

    const storedRecords = localStorage.getItem(storageKey);
    if (!storedRecords) return String(value);

    try {
      const records = JSON.parse(storedRecords);
      const relatedRecord = records.find((r: any) => String(r.id) === String(value));
      
      if (relatedRecord) {
        // Handle each object type with appropriate display fields
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
  };

  // Helper function to render field value with links
  const renderFieldValue = (apiName: string, value: any, fieldDef?: FieldDef): React.ReactNode => {
    if (!value) return '-';

    const fieldType = fieldDef?.type;

    // Handle Lookup fields
    if (fieldType === 'Lookup' && fieldDef) {
      const displayName = getLookupDisplayName(fieldDef, value);
      const lookupObject = fieldDef.lookupObject;
      
      if (lookupObject) {
        const routeMap: Record<string, string> = {
          'Contact': 'contacts',
          'Account': 'accounts',
          'Property': 'properties',
          'Lead': 'leads',
          'Deal': 'deals',
          'Project': 'projects',
          'Product': 'products',
          'Quote': 'quotes',
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

  const handleEditSubmit = (data: Record<string, any>) => {
    if (contact) {
      const currentUserName = user?.name || user?.email || 'System';
      const updatedContact: Contact = {
        ...contact,
        ...data,
        lastModifiedBy: currentUserName,
        lastModifiedAt: new Date().toISOString().split('T')[0] || ''
      };
      
      const storedContacts = localStorage.getItem('contacts');
      if (storedContacts) {
        const contacts: Contact[] = JSON.parse(storedContacts);
        const updatedContacts = contacts.map(c => 
          c.id === contact.id ? updatedContact : c
        );
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
      }
      
      setContact(updatedContact);
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this contact?')) {
      const storedContacts = localStorage.getItem('contacts');
      if (storedContacts && contact) {
        const contacts: Contact[] = JSON.parse(storedContacts);
        const updatedContacts = contacts.filter(c => c.id !== contact.id);
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
      }
      router.push('/contacts');
    }
  };

  const convertContactToFormData = (cont: Contact): Record<string, any> => {
    const formData: Record<string, any> = {};
    Object.keys(cont).forEach(key => {
      formData[key] = cont[key];
    });
    return formData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Not Found</h2>
          <p className="text-gray-600 mb-6">The contact you're looking for doesn't exist.</p>
          <Link
            href="/contacts"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Contacts
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
            href="/contacts"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Contacts
          </Link>
          
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{contact.contactNumber}</h1>
                  <p className="text-gray-600">
                    {contact.firstName} {contact.lastName}
                    {contact.primaryEmail && <> ({contact.primaryEmail})</>}
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
                                  const fieldDef = getFieldDef(layoutField.apiName);
                                  const value = contact[layoutField.apiName] || contact[layoutField.apiName.replace(/^[^_]+__/, '')];
                                  
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
            No page layout configured for this contact's record type.
          </div>
        )}
      </div>

      {/* Edit Form Dialog */}
      {pageLayout && (
        <DynamicFormDialog
          open={showEditForm}
          onOpenChange={setShowEditForm}
          objectApiName="Contact"
          layoutType="edit"
          layoutId={pageLayout.id}
          recordData={convertContactToFormData(contact)}
          onSubmit={handleEditSubmit}
          title={`Edit ${contact.contactNumber}`}
        />
      )}
    </div>
  );
}
