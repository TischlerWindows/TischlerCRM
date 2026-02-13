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
  Clock,
  Plus,
  Search,
  FileText
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
  
  // Contact Information
  salutation?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  accountId?: string;
  accountName?: string;
  contactType?: string;
  title?: string;
  reportsToId?: string;
  reportsToName?: string;
  status?: string;
  primaryEmail: string;
  secondaryEmail?: string;
  primaryPhone: string;
  secondaryPhone?: string;
  fax?: string;
  
  // Address Information
  primaryAddressStreet?: string;
  primaryAddressCity?: string;
  primaryAddressState?: string;
  primaryAddressZip?: string;
  secondaryAddressStreet?: string;
  secondaryAddressCity?: string;
  secondaryAddressState?: string;
  secondaryAddressZip?: string;
  poBox?: string;
  
  // Associated Properties
  properties?: string[];
  
  // Notes
  contactNotes?: string;
  
  // System Information
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  contactOwnerId?: string;
  contactOwnerName?: string;
  
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

  // Get the first available layout for edit dialog purposes
  const getDefaultLayout = () => {
    if (!contactObject) return null;
    return contactObject.pageLayouts?.[0];
  };

  const pageLayout = getDefaultLayout();

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
                    {contact.salutation && <>{contact.salutation} </>}{contact.firstName} {contact.lastName}
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

        {/* Contact Information */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Contact Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name Fields */}
              <div>
                <label className="text-sm font-medium text-gray-700">Salutation</label>
                <p className="mt-1 text-sm text-gray-900">{contact.salutation || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <p className="mt-1 text-sm text-gray-900">{contact.firstName || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Middle Name</label>
                <p className="mt-1 text-sm text-gray-900">{contact.middleName || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <p className="mt-1 text-sm text-gray-900">{contact.lastName || '-'}</p>
              </div>
              
              {/* Account */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Account</label>
                {contact.accountName ? (
                  <Link href={`/accounts/${contact.accountId}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                    {contact.accountName}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">-</p>
                )}
              </div>

              {/* Contact Type */}
              <div>
                <label className="text-sm font-medium text-gray-700">Contact Type</label>
                <p className="mt-1 text-sm text-gray-900">{contact.contactType || '-'}</p>
              </div>

              {/* Title */}
              <div>
                <label className="text-sm font-medium text-gray-700">Title</label>
                <p className="mt-1 text-sm text-gray-900">{contact.title || '-'}</p>
              </div>

              {/* Reports To */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Reports To</label>
                {contact.reportsToName ? (
                  <Link href={`/contacts/${contact.reportsToId}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                    {contact.reportsToName}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">-</p>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  contact.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {contact.status || '-'}
                </span>
              </div>

              {/* Emails */}
              <div>
                <label className="text-sm font-medium text-gray-700">Primary Email</label>
                <a href={`mailto:${contact.primaryEmail}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                  {contact.primaryEmail || '-'}
                </a>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Secondary Email</label>
                {contact.secondaryEmail ? (
                  <a href={`mailto:${contact.secondaryEmail}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                    {contact.secondaryEmail}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">-</p>
                )}
              </div>

              {/* Phones */}
              <div>
                <label className="text-sm font-medium text-gray-700">Primary Phone</label>
                <a href={`tel:${contact.primaryPhone}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                  {contact.primaryPhone || '-'}
                </a>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Secondary Phone</label>
                {contact.secondaryPhone ? (
                  <a href={`tel:${contact.secondaryPhone}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                    {contact.secondaryPhone}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">-</p>
                )}
              </div>

              {/* Fax */}
              <div>
                <label className="text-sm font-medium text-gray-700">Fax</label>
                {contact.fax ? (
                  <a href={`tel:${contact.fax}`} className="mt-1 text-sm text-indigo-600 hover:text-indigo-700">
                    {contact.fax}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-gray-900">-</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Address Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Primary Address */}
              <div>
                <label className="text-sm font-medium text-gray-700">Primary Address</label>
                <div className="mt-1 text-sm text-gray-900">
                  {contact.primaryAddressStreet && <div>{contact.primaryAddressStreet}</div>}
                  {(contact.primaryAddressCity || contact.primaryAddressState || contact.primaryAddressZip) && (
                    <div>
                      {contact.primaryAddressCity}{contact.primaryAddressCity && contact.primaryAddressState && ', '}
                      {contact.primaryAddressState} {contact.primaryAddressZip}
                    </div>
                  )}
                  {!contact.primaryAddressStreet && !contact.primaryAddressCity && !contact.primaryAddressState && <span>-</span>}
                </div>
              </div>

              {/* Secondary Address */}
              <div>
                <label className="text-sm font-medium text-gray-700">Secondary Address</label>
                <div className="mt-1 text-sm text-gray-900">
                  {contact.secondaryAddressStreet && <div>{contact.secondaryAddressStreet}</div>}
                  {(contact.secondaryAddressCity || contact.secondaryAddressState || contact.secondaryAddressZip) && (
                    <div>
                      {contact.secondaryAddressCity}{contact.secondaryAddressCity && contact.secondaryAddressState && ', '}
                      {contact.secondaryAddressState} {contact.secondaryAddressZip}
                    </div>
                  )}
                  {!contact.secondaryAddressStreet && !contact.secondaryAddressCity && !contact.secondaryAddressState && <span>-</span>}
                </div>
              </div>

              {/* PO Box */}
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">PO Box</label>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{contact.poBox || '-'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Associated Properties */}
        {contact.properties && contact.properties.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Associated Properties</h3>
            </div>
            <div className="p-6">
              <div className="text-sm text-gray-900">
                {Array.isArray(contact.properties) ? (
                  <ul className="space-y-2">
                    {contact.properties.map((prop, idx) => (
                      <li key={idx}>{prop}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{contact.properties}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {contact.contactNotes && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Notes</h3>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{contact.contactNotes}</p>
            </div>
          </div>
        )}

        {/* System Information */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">System Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-700">Created By</label>
                <p className="mt-1 text-sm text-gray-900">{contact.createdBy || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Created Date</label>
                <p className="mt-1 text-sm text-gray-900">{contact.createdAt || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Modified By</label>
                <p className="mt-1 text-sm text-gray-900">{contact.lastModifiedBy || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Modified Date</label>
                <p className="mt-1 text-sm text-gray-900">{contact.lastModifiedAt || '-'}</p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Contact Owner</label>
                <p className="mt-1 text-sm text-gray-900">{contact.contactOwnerName || '-'}</p>
              </div>
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
