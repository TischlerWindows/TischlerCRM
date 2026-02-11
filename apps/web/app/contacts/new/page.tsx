'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, X, Search } from 'lucide-react';

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

  const handleChange = (field: keyof ContactForm, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Get existing contacts
    const storedContacts = localStorage.getItem('contacts');
    const contacts = storedContacts ? JSON.parse(storedContacts) : [];

    // Generate contact number
    const existingNumbers = contacts
      .map((c: any) => c.contactNumber)
      .filter((num: string) => num?.startsWith('C-'))
      .map((num: string) => parseInt(num.replace('C-', ''), 10))
      .filter((num: number) => !isNaN(num));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const contactNumber = `C-${String(maxNumber + 1).padStart(3, '0')}`;

    const today = new Date().toISOString().split('T')[0];

    // Create new contact
    const newContact = {
      id: String(Date.now()),
      contactNumber,
      firstName: formData.firstName,
      lastName: formData.lastName,
      company: formData.accountName,
      email: formData.email,
      secondaryEmail: formData.secondaryEmail,
      phone: formData.mobilePhone,
      title: '', // Not in this form
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
      createdBy: formData.createdBy,
      contactOwner: formData.contactOwner,
      lastModifiedBy: formData.lastModifiedBy,
      createdAt: today,
      lastModifiedAt: today,
      lastActivity: today
    };

    // Save to localStorage
    const updatedContacts = [newContact, ...contacts];
    localStorage.setItem('contacts', JSON.stringify(updatedContacts));

    // Navigate back to contacts list
    router.push('/contacts');
  };

  const handleCancel = () => {
    router.push('/contacts');
  };

  const handleReportsToSearch = () => {
    // Load contacts for searching
    const storedContacts = localStorage.getItem('contacts');
    if (storedContacts) {
      const contacts = JSON.parse(storedContacts);
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
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Contact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-6 py-6 max-w-6xl mx-auto">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account Name
                </label>
                <input
                  type="text"
                  value={formData.accountName}
                  onChange={(e) => handleChange('accountName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Email
                </label>
                <input
                  type="email"
                  value={formData.secondaryEmail}
                  onChange={(e) => handleChange('secondaryEmail', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex items-center pt-6">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => handleChange('active', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
