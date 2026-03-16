'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, X, Search } from 'lucide-react';
import { recordsService } from '@/lib/records-service';

interface ContactForm {
  // Contact Information
  firstName: string;
  lastName: string;
  accountName: string;
  email: string;
  secondaryEmail: string;
  mobilePhone: string;
  active: boolean;
  contactType: string;
  reportsTo: string;
  fax: string;
  otherPhone: string;

  // Address Information
  addressSearch: string;
  mailingCountry: string;
  mailingStreet: string;
  mailingCity: string;
  mailingStateProvince: string;
  mailingZipPostalCode: string;
  poBox: string;

  // Description Information
  generalNotes: string;

  // System Information (read-only for new contacts)
  createdBy: string;
  contactOwner: string;
  lastModifiedBy: string;
}

const CONTACT_TYPES = [
  'Customer',
  'Prospect',
  'Partner',
  'Vendor',
  'Other'
];

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Germany',
  'France',
  'Australia',
  'Other'
];

export default function NewContactPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<ContactForm>({
    firstName: '',
    lastName: '',
    accountName: '',
    email: '',
    secondaryEmail: '',
    mobilePhone: '',
    active: true,
    contactType: '',
    reportsTo: '',
    fax: '',
    otherPhone: '',
    addressSearch: '',
    mailingCountry: 'United States',
    mailingStreet: '',
    mailingCity: '',
    mailingStateProvince: '',
    mailingZipPostalCode: '',
    poBox: '',
    generalNotes: '',
    createdBy: 'Development User',
    contactOwner: 'Development User',
    lastModifiedBy: 'Development User'
  });

  const [showReportsToSearch, setShowReportsToSearch] = useState(false);
  const [reportsToSearchTerm, setReportsToSearchTerm] = useState('');
  const [availableContacts, setAvailableContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: keyof ContactForm, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => { const next = { ...prev }; delete next[field]; return next; });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (formData.secondaryEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.secondaryEmail)) {
      errors.secondaryEmail = 'Please enter a valid email address';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    setSaveError(null);

    const recordData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.accountName,
      email: formData.email,
      secondaryEmail: formData.secondaryEmail,
      phone: formData.mobilePhone,
      title: '',
      status: formData.active ? 'Active' : 'Inactive',
      contactType: formData.contactType,
      reportsTo: formData.reportsTo,
      fax: formData.fax,
      otherPhone: formData.otherPhone,
      mailingCountry: formData.mailingCountry,
      mailingStreet: formData.mailingStreet,
      mailingCity: formData.mailingCity,
      mailingStateProvince: formData.mailingStateProvince,
      mailingZipPostalCode: formData.mailingZipPostalCode,
      poBox: formData.poBox,
      generalNotes: formData.generalNotes,
    };

    try {
      await recordsService.createRecord('Contact', { data: recordData });
      router.push('/contacts');
    } catch (err) {
      console.error('Failed to create contact via API:', err);
      setSaveError('Failed to create contact. Please check your input and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/contacts');
  };

  const handleReportsToSearch = async () => {
    // Load contacts for searching via API
    try {
      const records = await recordsService.getRecords('Contact');
      const contacts = recordsService.flattenRecords(records);
      const filtered = contacts
        .filter((c: any) => 
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(reportsToSearchTerm.toLowerCase())
        )
        .map((c: any) => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`
        }))
        .slice(0, 10);
      setAvailableContacts(filtered);
    } catch (err) {
      console.error('Failed to fetch contacts for search:', err);
    }
  };

  const selectReportsTo = (contact: { id: string; name: string }) => {
    setFormData(prev => ({ ...prev, reportsTo: contact.name }));
    setShowReportsToSearch(false);
    setReportsToSearchTerm('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/contacts"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">New Contact</h1>
                <p className="text-sm text-gray-600">Create a new contact record</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-6 py-6 max-w-6xl mx-auto">
        {saveError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <span className="text-sm">{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-sm text-red-600 hover:text-red-800 font-medium">Dismiss</button>
          </div>
        )}
        {Object.keys(validationErrors).length > 0 && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm font-medium text-amber-800">Please fix the following errors:</p>
            <ul className="mt-1 list-disc list-inside text-sm text-amber-700">
              {Object.values(validationErrors).map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
        <div className="space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-3">
              Contact Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy ${validationErrors.firstName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Enter first name"
                />
                {validationErrors.firstName && <p className="mt-1 text-xs text-red-600">{validationErrors.firstName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy ${validationErrors.lastName ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Enter last name"
                />
                {validationErrors.lastName && <p className="mt-1 text-xs text-red-600">{validationErrors.lastName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => handleChange('accountName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="Enter account name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy ${validationErrors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="email@example.com"
                />
                {validationErrors.email && <p className="mt-1 text-xs text-red-600">{validationErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Email
                </label>
                <input
                  type="email"
                  value={formData.secondaryEmail}
                  onChange={(e) => handleChange('secondaryEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="secondary@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Phone
                </label>
                <input
                  type="tel"
                  value={formData.mobilePhone}
                  onChange={(e) => handleChange('mobilePhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Type
                </label>
                <select
                  value={formData.contactType}
                  onChange={(e) => handleChange('contactType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                >
                  <option value="">Select type...</option>
                  {CONTACT_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reports To
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formData.reportsTo}
                    onChange={(e) => {
                      handleChange('reportsTo', e.target.value);
                      setReportsToSearchTerm(e.target.value);
                      setShowReportsToSearch(true);
                      if (e.target.value) {
                        handleReportsToSearch();
                      }
                    }}
                    onFocus={() => setShowReportsToSearch(true)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                    placeholder="Search for contact..."
                  />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  
                  {showReportsToSearch && availableContacts.length > 0 && (
                    <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                      {availableContacts.map(contact => (
                        <button
                          key={contact.id}
                          onClick={() => selectReportsTo(contact)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-50 transition-colors text-sm"
                        >
                          {contact.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fax
                </label>
                <input
                  type="tel"
                  value={formData.fax}
                  onChange={(e) => handleChange('fax', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Other Phone
                </label>
                <input
                  type="tel"
                  value={formData.otherPhone}
                  onChange={(e) => handleChange('otherPhone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                  className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                />
                <label htmlFor="active" className="ml-2 text-sm font-medium text-gray-700">
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-3">
              Address Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address Search
                </label>
                <input
                  type="text"
                  value={formData.addressSearch}
                  onChange={(e) => handleChange('addressSearch', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="Search for address..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailing Country
                </label>
                <select
                  value={formData.mailingCountry}
                  onChange={(e) => handleChange('mailingCountry', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                >
                  {COUNTRIES.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PO Box
                </label>
                <input
                  type="text"
                  value={formData.poBox}
                  onChange={(e) => handleChange('poBox', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="PO Box number"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailing Street
                </label>
                <textarea
                  value={formData.mailingStreet}
                  onChange={(e) => handleChange('mailingStreet', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="Street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailing City
                </label>
                <input
                  type="text"
                  value={formData.mailingCity}
                  onChange={(e) => handleChange('mailingCity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="City"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailing State / Province
                </label>
                <input
                  type="text"
                  value={formData.mailingStateProvince}
                  onChange={(e) => handleChange('mailingStateProvince', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="State or Province"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailing Zip / Postal Code
                </label>
                <input
                  type="text"
                  value={formData.mailingZipPostalCode}
                  onChange={(e) => handleChange('mailingZipPostalCode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                  placeholder="Zip or Postal Code"
                />
              </div>
            </div>
          </div>

          {/* Description Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-3">
              Description Information
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                General Notes
              </label>
              <textarea
                value={formData.generalNotes}
                onChange={(e) => handleChange('generalNotes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                placeholder="Add notes about this contact..."
              />
            </div>
          </div>

          {/* System Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-3">
              System Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Created By
                </label>
                <input
                  type="text"
                  value={formData.createdBy}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Owner
                </label>
                <input
                  type="text"
                  value={formData.contactOwner}
                  onChange={(e) => handleChange('contactOwner', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Modified By
                </label>
                <input
                  type="text"
                  value={formData.lastModifiedBy}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
