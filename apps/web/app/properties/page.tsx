'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Property {
  id: string;
  propertyNumber: string;
  address: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  lastActivity?: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ 
    propertyNumber: '', 
    address: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Mock data for now - replace with actual API call
    setProperties([
      {
        id: '1',
        propertyNumber: 'P-2024-001',
        address: '123 Main Street, Toronto, ON M5V 3A3',
        status: 'Active',
        createdAt: '2024-01-15',
        lastActivity: '2024-11-10'
      },
      {
        id: '2', 
        propertyNumber: 'P-2024-002',
        address: '456 Oak Avenue, Vancouver, BC V6B 1A1',
        status: 'Active',
        createdAt: '2024-02-20',
        lastActivity: '2024-11-08'
      }
    ]);
    setLoading(false);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mock submission - replace with actual API call
    const newProperty: Property = {
      id: Date.now().toString(),
      propertyNumber: formData.propertyNumber,
      address: formData.address,
      status: formData.status,
      createdAt: new Date().toISOString().split('T')[0] || ''
    };
    
    setProperties([newProperty, ...properties]);
    setFormData({ propertyNumber: '', address: '', status: 'Active' });
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
              <span className="ml-4 text-2xl font-bold text-gray-900">Properties</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">Properties Module</h2>
          <p className="text-blue-700 text-sm">
            <strong>THE umbrella module</strong> - every other module relates back to Properties and all documentation is filed under it. 
            Properties hinge on the property address, defined not only by the street but also by a unique Property Number. 
            A record is created at the onset of the Leads pipeline.
          </p>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <strong className="text-blue-900">Statuses:</strong>
              <div className="text-blue-700">• Active • Inactive</div>
            </div>
            <div>
              <strong className="text-blue-900">Security/Privacy:</strong>
              <div className="text-blue-700">All Tischler Employees</div>
            </div>
            <div>
              <strong className="text-blue-900">Files/Storage:</strong>
              <div className="text-blue-700">Master folder in SharePoint (Property Number)</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
          >
            Add New Property
          </button>
        </div>

        {/* Add Property Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">Add New Property</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Property Number</label>
                <input
                  type="text"
                  value={formData.propertyNumber}
                  onChange={(e) => setFormData({...formData, propertyNumber: e.target.value})}
                  placeholder="P-2024-XXX"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Full property address"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                  Add Property
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Properties List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Property Records</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property Number</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {properties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-indigo-600">{property.propertyNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{property.address}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        property.status === 'Active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {property.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{property.createdAt}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{property.lastActivity || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">Edit</button>
                      <button className="text-indigo-600 hover:text-indigo-900">View Files</button>
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