'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Project {
  id: string;
  propertyNumber: string;
  projectName: string;
  status: string;
  startDate: string;
  expectedCompletion: string;
  assignedTeam: string;
  budget: number;
  createdAt: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    propertyNumber: '',
    projectName: '',
    status: 'Planning',
    startDate: '',
    expectedCompletion: '',
    assignedTeam: '',
    budget: ''
  });
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Mock data
    setProjects([
      {
        id: '1',
        propertyNumber: 'P-2024-001',
        projectName: 'Complete Window Replacement',
        status: 'In Progress',
        startDate: '2024-11-15',
        expectedCompletion: '2024-12-20',
        assignedTeam: 'Installation Team A',
        budget: 25000,
        createdAt: '2024-11-01'
      },
      {
        id: '2',
        propertyNumber: 'P-2024-005',
        projectName: 'Kitchen Window Installation',
        status: 'Planning',
        startDate: '2024-12-01',
        expectedCompletion: '2024-12-15',
        assignedTeam: 'Installation Team B',
        budget: 12000,
        createdAt: '2024-11-08'
      }
    ]);
    setLoading(false);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newProject: Project = {
      id: Date.now().toString(),
      propertyNumber: formData.propertyNumber,
      projectName: formData.projectName,
      status: formData.status,
      startDate: formData.startDate,
      expectedCompletion: formData.expectedCompletion,
      assignedTeam: formData.assignedTeam,
      budget: parseFloat(formData.budget),
      createdAt: new Date().toISOString().split('T')[0] || ''
    };
    
    setProjects([newProject, ...projects]);
    setFormData({
      propertyNumber: '',
      projectName: '',
      status: 'Planning',
      startDate: '',
      expectedCompletion: '',
      assignedTeam: '',
      budget: ''
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
              <span className="ml-4 text-2xl font-bold text-gray-900">Projects</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Description */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-purple-900 mb-2">Projects Pipeline Module</h2>
          <p className="text-purple-700 text-sm">
            <strong>Pipeline Module:</strong> Track active installations and project execution from won deals. 
            Connected to Installations (Financial Tool) for budget and cost management.
          </p>
          <div className="mt-3 text-xs">
            <strong className="text-purple-900">Pipeline Flow:</strong>
            <span className="text-purple-700"> Leads → Deals → </span>
            <span className="text-purple-900 font-semibold">Projects</span>
            <span className="text-purple-700"> → Service</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700"
          >
            Add New Project
          </button>
        </div>

        {/* Add Project Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">Add New Project</h3>
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
                  <label className="block text-sm font-medium text-gray-700">Project Name</label>
                  <input
                    type="text"
                    value={formData.projectName}
                    onChange={(e) => setFormData({...formData, projectName: e.target.value})}
                    placeholder="e.g., Complete Window Replacement"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Planning">Planning</option>
                    <option value="Materials Ordered">Materials Ordered</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Quality Check">Quality Check</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Expected Completion</label>
                  <input
                    type="date"
                    value={formData.expectedCompletion}
                    onChange={(e) => setFormData({...formData, expectedCompletion: e.target.value})}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Assigned Team</label>
                  <input
                    type="text"
                    value={formData.assignedTeam}
                    onChange={(e) => setFormData({...formData, assignedTeam: e.target.value})}
                    placeholder="Installation Team A"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget ($)</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    placeholder="25000"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              <div className="flex space-x-3">
                <button type="submit" className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
                  Add Project
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

        {/* Projects List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Project Pipeline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Property #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completion</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-purple-600">{project.propertyNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{project.projectName}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                        project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                        project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">${project.budget.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{project.startDate}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{project.expectedCompletion}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{project.assignedTeam}</td>
                    <td className="px-6 py-4 text-sm">
                      <button className="text-purple-600 hover:text-purple-900 mr-3">Edit</button>
                      <button className="text-blue-600 hover:text-blue-900">View Installation</button>
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