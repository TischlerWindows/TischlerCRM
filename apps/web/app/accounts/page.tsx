'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, Plus } from 'lucide-react';

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  status: 'Active' | 'Inactive';
  website: string;
  primaryEmail: string;
  secondaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  accountNotes: string;
  shippingAddress: string;
  billingAddress: string;
  accountOwner: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    accountName: '',
    accountType: '',
    status: 'Active' as 'Active' | 'Inactive',
    website: '',
    primaryEmail: '',
    secondaryEmail: '',
    primaryPhone: '',
    secondaryPhone: '',
    accountNotes: '',
    shippingAddress: '',
    billingAddress: '',
    accountOwner: ''
  });

  useEffect(() => {
    // Mock data - replace with actual API call
    setAccounts([
      {
        id: '1',
        accountNumber: '00001',
        accountName: 'Architect Associates Inc.',
        accountType: 'Architect Firm',
        status: 'Active',
        website: 'https://architectassociates.com',
        primaryEmail: 'info@architectassociates.com',
        secondaryEmail: 'contact@architectassociates.com',
        primaryPhone: '(416) 555-0100',
        secondaryPhone: '(416) 555-0101',
        accountNotes: 'Long-standing partner. Prefers modern design projects.',
        shippingAddress: '123 Design Avenue, Toronto, ON M5V 3A3',
        billingAddress: '123 Design Avenue, Toronto, ON M5V 3A3',
        accountOwner: 'Development User',
        createdBy: 'Development User',
        createdAt: '2024-01-15',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-10'
      },
      {
        id: '2',
        accountNumber: '00002',
        accountName: 'Smith Residence',
        accountType: 'Client/Homeowner',
        status: 'Active',
        website: '',
        primaryEmail: 'john.smith@email.com',
        secondaryEmail: '',
        primaryPhone: '(416) 555-0200',
        secondaryPhone: '',
        accountNotes: 'Interested in energy-efficient windows.',
        shippingAddress: '456 Oak Street, Mississauga, ON L5B 2K5',
        billingAddress: '456 Oak Street, Mississauga, ON L5B 2K5',
        accountOwner: 'Development User',
        createdBy: 'Development User',
        createdAt: '2024-02-20',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-12'
      }
    ]);
    setLoading(false);
  }, []);

  const filteredAccounts = accounts.filter(account =>
    account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.accountType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const today = new Date().toISOString().split('T')[0];
    
    if (editingAccount) {
      // Update existing account
      const updatedAccount: Account = {
        ...editingAccount,
        accountName: formData.accountName,
        accountType: formData.accountType,
        status: formData.status,
        website: formData.website,
        primaryEmail: formData.primaryEmail,
        secondaryEmail: formData.secondaryEmail,
        primaryPhone: formData.primaryPhone,
        secondaryPhone: formData.secondaryPhone,
        accountNotes: formData.accountNotes,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        accountOwner: formData.accountOwner,
        lastModifiedBy: 'Development User',
        lastModifiedAt: today || ''
      };
      
      setAccounts(accounts.map(acc => 
        acc.id === editingAccount.id ? updatedAccount : acc
      ));
      setEditingAccount(null);
    } else {
      // Create new account
      const nextNumber = String(accounts.length + 1).padStart(5, '0');
      
      const newAccount: Account = {
        id: Date.now().toString(),
        accountNumber: nextNumber,
        accountName: formData.accountName,
        accountType: formData.accountType,
        status: formData.status,
        website: formData.website,
        primaryEmail: formData.primaryEmail,
        secondaryEmail: formData.secondaryEmail,
        primaryPhone: formData.primaryPhone,
        secondaryPhone: formData.secondaryPhone,
        accountNotes: formData.accountNotes,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        accountOwner: formData.accountOwner,
        createdBy: 'Development User',
        createdAt: today || '',
        lastModifiedBy: 'Development User',
        lastModifiedAt: today || ''
      };
      
      setAccounts([newAccount, ...accounts]);
    }
    
    resetForm();
    setShowForm(false);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName,
      accountType: account.accountType,
      status: account.status,
      website: account.website,
      primaryEmail: account.primaryEmail,
      secondaryEmail: account.secondaryEmail,
      primaryPhone: account.primaryPhone,
      secondaryPhone: account.secondaryPhone,
      accountNotes: account.accountNotes,
      shippingAddress: account.shippingAddress,
      billingAddress: account.billingAddress,
      accountOwner: account.accountOwner
    });
    setShowForm(true);
  };

  const handleDelete = (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      setAccounts(accounts.filter(acc => acc.id !== accountId));
    }
  };

  const resetForm = () => {
    setEditingAccount(null);
    setFormData({
      accountName: '',
      accountType: '',
      status: 'Active',
      website: '',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      accountNotes: '',
      shippingAddress: '',
      billingAddress: '',
      accountOwner: ''
    });
  };

  const handleCancel = () => {
    resetForm();
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
              <span className="ml-4 text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-7 h-7" />
                Companies/Accounts
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Information Module</h2>
          <p className="text-blue-700 text-sm mb-2">
            This module tracks company/account information. Records can be created at any time.
          </p>
          <p className="text-xs text-blue-600">
            <strong>Status Changes:</strong> Accounts automatically become <strong>Inactive</strong> after 8 months of no activity or upon receipt of final payment.
          </p>
          <p className="text-xs text-blue-600 mt-1">
            <strong>Files/Storage:</strong> Property-specific documentation should be filed under the Property Number folder.
          </p>
        </div>

        {/* Search and Actions */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search accounts by name, number, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add New Account
          </button>
        </div>

        {/* Add/Edit Account Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Account Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Account Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Name</em></strong>
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                      placeholder="Companies' official, registered name"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Type</em></strong>
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({...formData, accountType: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Architect Firm">Architect Firm</option>
                      <option value="Owner Rep Firm">Owner Rep Firm</option>
                      <option value="Design Firm">Design Firm</option>
                      <option value="Builder/Contractor Firm">Builder/Contractor Firm</option>
                      <option value="Engineering Firm">Engineering Firm</option>
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Competitor">Competitor</option>
                      <option value="Client/Homeowner">Client/Homeowner</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Status</em></strong>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  {editingAccount && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500">
                        <strong><em>Account Number</em></strong>
                      </label>
                      <input
                        type="text"
                        value={editingAccount.accountNumber}
                        disabled
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Website</em></strong>
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      placeholder="https://example.com"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Primary Email</em></strong>
                    </label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => setFormData({...formData, primaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Secondary Email</em></strong>
                    </label>
                    <input
                      type="email"
                      value={formData.secondaryEmail}
                      onChange={(e) => setFormData({...formData, secondaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Primary Phone</em></strong>
                    </label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => setFormData({...formData, primaryPhone: e.target.value})}
                      placeholder="(416) 555-0100"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Secondary Phone</em></strong>
                    </label>
                    <input
                      type="tel"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({...formData, secondaryPhone: e.target.value})}
                      placeholder="(416) 555-0101"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Notes</em></strong>
                    </label>
                    <textarea
                      value={formData.accountNotes}
                      onChange={(e) => setFormData({...formData, accountNotes: e.target.value})}
                      placeholder="Records any pertinent information regarding account"
                      rows={4}
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
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Shipping Address</em></strong>
                    </label>
                    <textarea
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Billing Address</em></strong>
                    </label>
                    <textarea
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({...formData, billingAddress: e.target.value})}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* System Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">System Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editingAccount && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          <strong><em>Created By</em></strong>
                        </label>
                        <input
                          type="text"
                          value={editingAccount.createdBy}
                          disabled
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editingAccount.createdAt}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          <strong><em>Last Modified By</em></strong>
                        </label>
                        <input
                          type="text"
                          value={editingAccount.lastModifiedBy}
                          disabled
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editingAccount.lastModifiedAt}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Owner</em></strong>
                    </label>
                    <input
                      type="text"
                      value={formData.accountOwner}
                      onChange={(e) => setFormData({...formData, accountOwner: e.target.value})}
                      placeholder="Search users..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                  {editingAccount ? 'Update Account' : 'Add Account'}
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

        {/* Accounts List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Account Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Primary Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-indigo-600">
                      {account.accountNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{account.accountName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{account.accountType}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{account.primaryEmail}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{account.primaryPhone}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.status === 'Active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {account.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button 
                        onClick={() => handleEdit(account)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(account.id)}
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

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first account.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
