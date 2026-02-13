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

interface Contact {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  contactNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobilePhone: string;
  fax: string;
  accountName: string;
  jobTitle: string;
  department: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
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

  // Get the layout based on contact's pageLayoutId or recordTypeId
  const getLayoutForContact = () => {
    if (!contact || !contactObject) return null;

    // First, try to use the layout stored on the record itself
    if (contact.pageLayoutId) {
      const pageLayout = contactObject.pageLayouts?.find(l => l.id === contact.pageLayoutId);
      if (pageLayout) {
        return pageLayout;
      }
    }

    // Fall back to the layout from the record type
    const recordTypeId = contact.recordTypeId;
    const recordType = recordTypeId
      ? contactObject.recordTypes?.find(rt => rt.id === recordTypeId)
      : contactObject.recordTypes?.[0];

    // Get page layout from record type
    const pageLayoutId = recordType?.pageLayoutId;
    const pageLayout = pageLayoutId
      ? contactObject.pageLayouts?.find(l => l.id === pageLayoutId)
      : contactObject.pageLayouts?.[0];

    return pageLayout;
  };

  const pageLayout = getLayoutForContact();

  // Get fields to display from the layout
  const getFieldsFromLayout = () => {
    if (!pageLayout || !contactObject) return [];

    const layoutFieldApiNames = new Set<string>();
    
    pageLayout.tabs?.forEach((tab: any) => {
      tab.sections?.forEach((section: any) => {
        section.fields?.forEach((field: any) => {
          layoutFieldApiNames.add(field.apiName);
        });
      });
    });

    // Only return fields that are in the layout
    if (layoutFieldApiNames.size === 0) return [];
    
    return (contactObject.fields || []).filter(field => 
      layoutFieldApiNames.has(field.apiName)
    );
  };

  const displayFields = getFieldsFromLayout();

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
        lastModifiedAt: new Date().toISOString().split('T')[0]
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
                    {contact.email && <> ({contact.email})</>}
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

        {/* Layout Info */}
        {pageLayout && (
          <div className="mb-4 text-sm text-gray-500">
            Using layout: <span className="font-medium">{pageLayout.name}</span>
            {displayFields.length > 0 && (
              <span className="ml-2">({displayFields.length} fields)</span>
            )}
          </div>
        )}

        {/* Content based on layout */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {pageLayout?.tabs?.map((tab: any, tabIndex: number) => (
            <div key={tabIndex}>
              {tab.sections?.map((section: any, sectionIndex: number) => (
                <div key={sectionIndex} className="border-b border-gray-200 last:border-b-0">
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900">{section.name}</h3>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {section.fields?.map((layoutField: any, fieldIndex: number) => {
                        // Normalize field name - remove object prefix like "Contact__"
                        const normalizedFieldName = layoutField.apiName.replace(/^[^_]+__/, '');
                        
                        const fieldDef = contactObject?.fields?.find(
                          f => f.apiName === layoutField.apiName || f.apiName === normalizedFieldName
                        );
                        const value = contact[normalizedFieldName] || contact[layoutField.apiName];
                        
                        return (
                          <div key={fieldIndex}>
                            <dt className="text-sm font-medium text-gray-500">
                              {fieldDef?.label || layoutField.apiName}
                            </dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {formatFieldValue(value, fieldDef?.type) || '-'}
                            </dd>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Fallback if no layout sections */}
          {(!pageLayout?.tabs || pageLayout.tabs.length === 0) && displayFields.length > 0 && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {displayFields.map((field, index) => (
                  <div key={index}>
                    <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatFieldValue(contact[field.apiName], field.type) || '-'}
                    </dd>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No layout configured */}
          {!pageLayout && (
            <div className="p-6 text-center text-gray-500">
              No page layout configured for this contact's record type.
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-4">System Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Created by:</span>
              <span className="text-gray-900">{contact.createdBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Created:</span>
              <span className="text-gray-900">{contact.createdAt}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified by:</span>
              <span className="text-gray-900">{contact.lastModifiedBy}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">Modified:</span>
              <span className="text-gray-900">{contact.lastModifiedAt}</span>
            </div>
          </div>
        </div>
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
