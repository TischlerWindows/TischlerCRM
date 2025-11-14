'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  salutation: string;
  account: string;
  contactType: string;
  title: string;
  status: 'Active' | 'Inactive';
  primaryEmail: string;
  primaryPhone: string;
  createdAt: string;
  lastActivity?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({ 
    firstName: '',
    lastName: '',
    salutation: 'Mr.',
    account: '',
    contactType: '',
    title: '',
    reportsTo: '',
    status: 'Active' as 'Active' | 'Inactive',
    primaryEmail: '',
    secondaryEmail: '',
    primaryPhone: '',
    secondaryPhone: '',
    fax: '',
    primaryAddress: '',
    secondaryAddress: '',
    poBox: '',
    associatedProperties: '',
    contactNotes: '',
    contactOwner: ''
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Mock data for now - replace with actual API call
    setContacts([
      {
        id: '1',
        firstName: 'John',
        lastName: 'Smith',
        salutation: 'Mr.',
        account: 'Smith Residence',
        contactType: 'Client/Homeowner',
        title: 'Property Owner',
        status: 'Active',
        primaryEmail: 'john.smith@email.com',
        primaryPhone: '(416) 555-0123',
        createdAt: '2024-01-15',
        lastActivity: '2024-11-10'
      },
      {
        id: '2',
        firstName: 'Sarah',
        lastName: 'Johnson',
        salutation: 'Ms.',
        account: 'Johnson Construction',
        contactType: 'Project Manager',
        title: 'Senior Project Manager',
        status: 'Active',
        primaryEmail: 'sarah.johnson@johnsoncorp.com',
        primaryPhone: '(416) 555-0456',
        createdAt: '2024-02-20',
        lastActivity: '2024-11-08'
      }
    ]);
    setLoading(false);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingContact) {
      // Update existing contact
      const updatedContact: Contact = {
        ...editingContact,
        firstName: formData.firstName,
        lastName: formData.lastName,
        salutation: formData.salutation,
        account: formData.account,
        contactType: formData.contactType,
        title: formData.title,
        status: formData.status,
        primaryEmail: formData.primaryEmail,
        primaryPhone: formData.primaryPhone
      };
      
      setContacts(contacts.map(contact => 
        contact.id === editingContact.id ? updatedContact : contact
      ));
      setEditingContact(null);
    } else {
      // Add new contact
      const newContact: Contact = {
        id: Date.now().toString(),
        firstName: formData.firstName,
        lastName: formData.lastName,
        salutation: formData.salutation,
        account: formData.account,
        contactType: formData.contactType,
        title: formData.title,
        status: formData.status,
        primaryEmail: formData.primaryEmail,
        primaryPhone: formData.primaryPhone,
        createdAt: new Date().toISOString().split('T')[0] || ''
      };
      
      setContacts([newContact, ...contacts]);
    }
    
    setFormData({ 
      firstName: '',
      lastName: '',
      salutation: 'Mr.',
      account: '',
      contactType: '',
      title: '',
      reportsTo: '',
      status: 'Active',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      fax: '',
      primaryAddress: '',
      secondaryAddress: '',
      poBox: '',
      associatedProperties: '',
      contactNotes: '',
      contactOwner: ''
    });
    setShowForm(false);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      firstName: contact.firstName,
      lastName: contact.lastName,
      salutation: contact.salutation,
      account: contact.account,
      contactType: contact.contactType,
      title: contact.title,
      reportsTo: '',
      status: contact.status,
      primaryEmail: contact.primaryEmail,
      secondaryEmail: '',
      primaryPhone: contact.primaryPhone,
      secondaryPhone: '',
      fax: '',
      primaryAddress: '',
      secondaryAddress: '',
      poBox: '',
      associatedProperties: '',
      contactNotes: '',
      contactOwner: ''
    });
    setShowForm(true);
  };

  const handleDelete = (contactId: string) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      setContacts(contacts.filter(contact => contact.id !== contactId));
    }
  };

  const handleCancel = () => {
    setEditingContact(null);
    setFormData({ 
      firstName: '',
      lastName: '',
      salutation: 'Mr.',
      account: '',
      contactType: '',
      title: '',
      reportsTo: '',
      status: 'Active',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      fax: '',
      primaryAddress: '',
      secondaryAddress: '',
      poBox: '',
      associatedProperties: '',
      contactNotes: '',
      contactOwner: ''
    });
    setShowForm(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-indigo-600">TCES</Link>
              <span className="ml-4 text-2xl font-bold text-gray-900">Contacts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700"
          >
            Add New Contact
          </button>
        </div>

        {/* Add/Edit Contact Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">
              {editingContact ? 'Edit Contact' : 'Add New Contact'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Contact Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Salutation</em></strong></label>
                    <select
                      value={formData.salutation}
                      onChange={(e) => setFormData({...formData, salutation: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                      <option value="Dr.">Dr.</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>First Name</em></strong></label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Last Name</em></strong></label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Account</em></strong></label>
                    <input
                      type="text"
                      value={formData.account}
                      onChange={(e) => setFormData({...formData, account: e.target.value})}
                      placeholder="Search accounts..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Contact Type</em></strong></label>
                    <select
                      value={formData.contactType}
                      onChange={(e) => setFormData({...formData, contactType: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Architect">Architect</option>
                      <option value="Associate">Associate</option>
                      <option value="CEO">CEO</option>
                      <option value="Client/Homeowner">Client/Homeowner</option>
                      <option value="Designer">Designer</option>
                      <option value="Engineer">Engineer</option>
                      <option value="Property Manager">Property Manager</option>
                      <option value="Project Manager">Project Manager</option>
                      <option value="President">President</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Title</em></strong></label>
                    <select
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select title</option>
                      <option value="Senior Architect">Senior Architect</option>
                      <option value="Junior Architect">Junior Architect</option>
                      <option value="Executive Assistant">Executive Assistant</option>
                      <option value="Senior Project Manager">Senior Project Manager</option>
                      <option value="Project Coordinator">Project Coordinator</option>
                      <option value="Design Director">Design Director</option>
                      <option value="Operations Manager">Operations Manager</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Reports To</em></strong></label>
                    <input
                      type="text"
                      value={formData.reportsTo}
                      onChange={(e) => setFormData({...formData, reportsTo: e.target.value})}
                      placeholder="Search contacts..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Status</em></strong></label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Primary Email</em></strong></label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => setFormData({...formData, primaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Secondary Email</em></strong></label>
                    <input
                      type="email"
                      value={formData.secondaryEmail}
                      onChange={(e) => setFormData({...formData, secondaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Primary Phone</em></strong></label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => setFormData({...formData, primaryPhone: e.target.value})}
                      placeholder="(416) 555-0123"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Secondary Phone</em></strong></label>
                    <input
                      type="tel"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({...formData, secondaryPhone: e.target.value})}
                      placeholder="(416) 555-0456"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Fax</em></strong></label>
                    <input
                      type="tel"
                      value={formData.fax}
                      onChange={(e) => setFormData({...formData, fax: e.target.value})}
                      placeholder="(416) 555-0789"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Primary Address</em></strong></label>
                    <textarea
                      value={formData.primaryAddress}
                      onChange={(e) => setFormData({...formData, primaryAddress: e.target.value})}
                      placeholder="Used for mailing..."
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Secondary Address</em></strong></label>
                    <textarea
                      value={formData.secondaryAddress}
                      onChange={(e) => setFormData({...formData, secondaryAddress: e.target.value})}
                      placeholder="Used as needed..."
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700"><strong><em>PO Box</em></strong></label>
                    <textarea
                      value={formData.poBox}
                      onChange={(e) => setFormData({...formData, poBox: e.target.value})}
                      placeholder="Used as needed..."
                      rows={2}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Associated Properties Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Associated Properties</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700"><strong><em>Properties</em></strong></label>
                  <input
                    type="text"
                    value={formData.associatedProperties}
                    onChange={(e) => setFormData({...formData, associatedProperties: e.target.value})}
                    placeholder="Search and select property records..."
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* Notes Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Notes</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700"><strong><em>Contact Notes</em></strong></label>
                  <textarea
                    value={formData.contactNotes}
                    onChange={(e) => setFormData({...formData, contactNotes: e.target.value})}
                    placeholder="Records any pertinent information regarding contact..."
                    rows={4}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* System Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">System Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500"><strong><em>Created By</em></strong></label>
                    <input
                      type="text"
                      value="Current User"
                      disabled
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500"><strong><em>Last Modified By</em></strong></label>
                    <input
                      type="text"
                      value="Auto-generated"
                      disabled
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700"><strong><em>Contact Owner</em></strong></label>
                    <input
                      type="text"
                      value={formData.contactOwner}
                      onChange={(e) => setFormData({...formData, contactOwner: e.target.value})}
                      placeholder="Search users..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-700">
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </button>
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Contacts List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Contact Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-teal-600">
                      {contact.salutation} {contact.firstName} {contact.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{contact.account}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{contact.contactType}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{contact.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{contact.primaryEmail}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{contact.primaryPhone}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        contact.status === 'Active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button 
                        onClick={() => handleEdit(contact)}
                        className="text-teal-600 hover:text-teal-900 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(contact.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}