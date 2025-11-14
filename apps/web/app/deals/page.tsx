'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Deal {
  id: string;
  propertyNumber: string;
  dealName: string;
  stage: string;
  value: number;
  closeDate: string;
  assignedTo: string;
  createdAt: string;
  probability: number;
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    propertyNumber: '',
    dealName: '',
    stage: 'Proposal',
    value: '',
    closeDate: '',
    assignedTo: '',
    probability: '50'
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Mock data
    setDeals([
      {
        id: '1',
        propertyNumber: 'P-2024-001',
        dealName: 'Complete Window Replacement',
        stage: 'Negotiation',
        value: 25000,
        closeDate: '2024-12-15',
        assignedTo: 'Sarah Johnson',
        createdAt: '2024-11-01',
        probability: 75
      },
      {
        id: '2',
        propertyNumber: 'P-2024-002',
        dealName: 'Front Door Installation',
        stage: 'Proposal',
        value: 8500,
        closeDate: '2024-11-30',
        assignedTo: 'Mike Wilson',
        createdAt: '2024-11-05',
        probability: 60
      }
    ]);
    setLoading(false);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newDeal: Deal = {
      id: Date.now().toString(),
      propertyNumber: formData.propertyNumber,
      dealName: formData.dealName,
      stage: formData.stage,
      value: parseFloat(formData.value),
      closeDate: formData.closeDate,
      assignedTo: formData.assignedTo,
      probability: parseInt(formData.probability),
      createdAt: new Date().toISOString().split('T')[0] || ''
    };
    
    setDeals([newDeal, ...deals]);
    setFormData({
      propertyNumber: '',
      dealName: '',
      stage: 'Proposal',
      value: '',
      closeDate: '',
      assignedTo: '',
      probability: '50'
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
              <span className="ml-4 text-2xl font-bold text-gray-900">Deals</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-green-900 mb-2">Deals Pipeline Module</h2>
          <p className="text-green-700 text-sm">
            <strong>Pipeline Module:</strong> Track qualified opportunities through the sales process. 
            Connected to Quotes (Financial Tool) for pricing and proposal management.
          </p>
          <div className="mt-3 text-xs">
            <strong className="text-green-900">Pipeline Flow:</strong>
            <span className="text-green-700"> Leads → </span>
            <span className="text-green-900 font-semibold">Deals</span>
            <span className="text-green-700"> → Projects → Service</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
          >
            Add New Deal
          </button>
        </div>

        {/* Add Deal Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">Add New Deal</h3>
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
                  <label className="block text-sm font-medium text-gray-700">Deal Name</label>
                  <input
                    type="text"
                    value={formData.dealName}
                    onChange={(e) => setFormData({...formData, dealName: e.target.value})}
                    placeholder="e.g., Complete Window Replacement"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stage</label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Proposal">Proposal</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Contract Review">Contract Review</option>
                    <option value="Closed Won">Closed Won</option>
                    <option value="Closed Lost">Closed Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Deal Value ($)</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    placeholder="25000"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expected Close Date</label>
                  <input
                    type="date"
                    value={formData.closeDate}
                    onChange={(e) => setFormData({...formData, closeDate: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
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
                <div>
                  <label className="block text-sm font-medium text-gray-700">Probability (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.probability}
                    onChange={(e) => setFormData({...formData, probability: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                  Add Deal
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

        {/* Deals List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Deal Pipeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deal Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Probability</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Close Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {deals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-green-600">{deal.propertyNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{deal.dealName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        deal.stage === 'Closed Won' ? 'bg-green-100 text-green-800' :
                        deal.stage === 'Closed Lost' ? 'bg-red-100 text-red-800' :
                        deal.stage === 'Negotiation' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {deal.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">${deal.value.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{deal.probability}%</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{deal.closeDate}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{deal.assignedTo}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-green-600 hover:text-green-900 mr-3">Edit</button>
                      <button className="text-blue-600 hover:text-blue-900">Create Quote</button>
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