'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lead {
  id: string;
  propertyNumber: string;
  contactName: string;
  source: string;
  stage: string;
  assignedTo: string;
  createdAt: string;
  notes?: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    propertyNumber: '',
    contactName: '',
    source: '',
    stage: 'Initial Contact',
    assignedTo: '',
    notes: ''
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
      return;
    }

    // Mock data
    setLeads([
      {
        id: '1',
        propertyNumber: 'P-2024-003',
        contactName: 'John Smith',
        source: 'Website',
        stage: 'Qualified',
        assignedTo: 'Sarah Johnson',
        createdAt: '2024-11-10',
        notes: 'Interested in window replacement for entire home'
      },
      {
        id: '2',
        propertyNumber: 'P-2024-004',
        contactName: 'Maria Garcia',
        source: 'Referral',
        stage: 'Initial Contact',
        assignedTo: 'Mike Wilson',
        createdAt: '2024-11-11'
      }
    ]);
    setLoading(false);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newLead: Lead = {
      id: Date.now().toString(),
      propertyNumber: formData.propertyNumber,
      contactName: formData.contactName,
      source: formData.source,
      stage: formData.stage,
      assignedTo: formData.assignedTo,
      createdAt: new Date().toISOString().split('T')[0] || '',
      notes: formData.notes
    };
    
    setLeads([newLead, ...leads]);
    setFormData({
      propertyNumber: '',
      contactName: '',
      source: '',
      stage: 'Initial Contact',
      assignedTo: '',
      notes: ''
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
              <span className="ml-4 text-2xl font-bold text-gray-900">Leads</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-orange-900 mb-2">Leads Pipeline Module</h2>
          <p className="text-orange-700 text-sm">
            <strong>Pipeline Module:</strong> Track business activities from lead initiation. This is where the sales process begins,
            creating the initial property record and qualifying potential customers for the deals pipeline.
          </p>
          <div className="mt-3 text-xs">
            <strong className="text-orange-900">Pipeline Flow:</strong>
            <span className="text-orange-700"> Leads → Deals → Projects → Service</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
          >
            Add New Lead
          </button>
        </div>

        {/* Add Lead Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">Add New Lead</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700">Contact Name</label>
                  <input
                    type="text"
                    value={formData.contactName}
                    onChange={(e) => setFormData({...formData, contactName: e.target.value})}
                    placeholder="Primary contact name"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select source</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Advertisement">Advertisement</option>
                    <option value="Social Media">Social Media</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Initial Contact">Initial Contact</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Needs Assessment">Needs Assessment</option>
                    <option value="Ready for Deal">Ready for Deal</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                  <input
                    type="text"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                    placeholder="Team member name"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Additional notes about this lead..."
                />
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700">
                  Add Lead
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

        {/* Leads List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Lead Pipeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-orange-600">{lead.propertyNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lead.contactName}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lead.source}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        lead.stage === 'Ready for Deal' ? 'bg-green-100 text-green-800' :
                        lead.stage === 'Qualified' ? 'bg-blue-100 text-blue-800' :
                        lead.stage === 'Lost' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lead.assignedTo}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{lead.createdAt}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-orange-600 hover:text-orange-900 mr-3">Edit</button>
                      <button className="text-green-600 hover:text-green-900">Convert to Deal</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
