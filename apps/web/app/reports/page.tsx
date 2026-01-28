'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Plus, 
  Search, 
  Filter,
  Download,
  Eye,
  Trash2,
  Copy,
  FileText,
  Table as TableIcon,
  Grid3x3,
  Columns,
  Clock,
  User,
  Lock,
  Globe,
  FolderOpen,
  Folder,
  Star,
  Share2,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  Edit,
  HelpCircle,
  Cog,
  Edit3,
  GripVertical,
  X
} from 'lucide-react';
import UniversalSearch from '@/components/universal-search';
import { cn } from '@/lib/utils';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';

interface SavedReport {
  id: string;
  name: string;
  description: string;
  objectType: string;
  format: 'tabular' | 'summary' | 'matrix';
  fields: string[];
  filters: any[];
  groupBy?: string[];
  sortBy?: { field: string; direction: 'asc' | 'desc' }[];
  isStandard: boolean;
  isPrivate: boolean;
  isFavorite?: boolean;
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
  sharedWith?: string[];
}

const OBJECT_TYPES = [
  { value: 'properties', label: 'Properties', icon: '🏠' },
  { value: 'contacts', label: 'Contacts', icon: '👤' },
  { value: 'accounts', label: 'Accounts', icon: '🏢' },
  { value: 'products', label: 'Products', icon: '📦' },
  { value: 'leads', label: 'Leads', icon: '🎯' },
  { value: 'deals', label: 'Deals', icon: '💼' },
  { value: 'projects', label: 'Projects', icon: '📋' },
  { value: 'services', label: 'Service', icon: '🔧' },
  { value: 'quotes', label: 'Quotes', icon: '💰' },
  { value: 'installations', label: 'Installations', icon: '⚙️' },
];

const defaultTabs = DEFAULT_TAB_ORDER;

export default function ReportsPage() {
  const pathname = usePathname();
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedObjectType, setSelectedObjectType] = useState<string>('all');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [sidebarFilter, setSidebarFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const savedTabsStr = localStorage.getItem('tabConfiguration');
    if (savedTabsStr) {
      try {
        const savedTabs = JSON.parse(savedTabsStr);
        setTabs(savedTabs);
      } catch (e) {
        setTabs(defaultTabs);
      }
    } else {
      setTabs(defaultTabs);
    }

    const storedObjects = localStorage.getItem('customObjects');
    if (storedObjects) {
      try {
        const objects = JSON.parse(storedObjects);
        const objectTabs = objects.map((obj: any) => ({
          name: obj.label,
          href: `/${obj.apiName.toLowerCase()}`
        }));
        setAvailableObjects(objectTabs);
      } catch (e) {
        console.error('Error loading custom objects:', e);
      }
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = () => {
    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    const standardReports = getStandardReports();
    setReports([...standardReports, ...customReports]);
    setLoading(false);
  };

  const getStandardReports = (): SavedReport[] => {
    return [];
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    localStorage.setItem('tabConfiguration', JSON.stringify(newTabs));
  };

  const handleResetToDefault = () => {
    setTabs(defaultTabs);
    saveTabConfiguration(defaultTabs);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTabs = [...tabs];
    const draggedTab = newTabs[draggedIndex];
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(index, 0, draggedTab);

    setTabs(newTabs);
    setDraggedIndex(index);
    saveTabConfiguration(newTabs);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleAddTab = (tab: { name: string; href: string }) => {
    const newTabs = [...tabs, tab];
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
    setShowAddTab(false);
  };

  const handleRemoveTab = (index: number) => {
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
  };

  const filteredReports = reports.filter(report => {
    if (searchTerm && !report.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !report.description.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedObjectType !== 'all' && report.objectType !== selectedObjectType) {
      return false;
    }
    if (selectedFormat !== 'all' && report.format !== selectedFormat) {
      return false;
    }
    if (sidebarFilter === 'recent') {
      return true;
    }
    if (sidebarFilter === 'createdByMe') {
      return !report.isStandard;
    }
    if (sidebarFilter === 'private') {
      return report.isPrivate;
    }
    if (sidebarFilter === 'public') {
      return !report.isPrivate;
    }
    if (sidebarFilter === 'favorites') {
      return report.isFavorite;
    }
    return true;
  }).sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aVal = a[sortColumn as keyof SavedReport];
    const bVal = b[sortColumn as keyof SavedReport];
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return 0;
  });

  const handleDeleteReport = (id: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    const updatedReports = customReports.filter((r: SavedReport) => r.id !== id);
    localStorage.setItem('customReports', JSON.stringify(updatedReports));
    loadReports();
  };

  const handleDuplicateReport = (report: SavedReport) => {
    const newReport = {
      ...report,
      id: `report-${Date.now()}`,
      name: `${report.name} (Copy)`,
      isStandard: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString()
    };
    
    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    customReports.push(newReport);
    localStorage.setItem('customReports', JSON.stringify(customReports));
    loadReports();
  };

  const handleTogglePrivate = (id: string) => {
    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    const updatedCustomReports = customReports.map((r: SavedReport) => 
      r.id === id ? { ...r, isPrivate: !r.isPrivate } : r
    );
    localStorage.setItem('customReports', JSON.stringify(updatedCustomReports));
    loadReports();
  };

  const handleToggleFavorite = (id: string) => {
    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    const updatedCustomReports = customReports.map((r: SavedReport) => 
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    );
    localStorage.setItem('customReports', JSON.stringify(updatedCustomReports));
    loadReports();
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'tabular':
        return <TableIcon className="w-4 h-4" />;
      case 'summary':
        return <Columns className="w-4 h-4" />;
      case 'matrix':
        return <Grid3x3 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Create and manage data reports across all objects</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Reports</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSidebarFilter('recent')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'recent'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                Recent
              </button>
              <button
                onClick={() => setSidebarFilter('createdByMe')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'createdByMe'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                Created by Me
              </button>
              <button
                onClick={() => setSidebarFilter('private')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'private'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Lock className="w-4 h-4" />
                Private Reports
              </button>
              <button
                onClick={() => setSidebarFilter('public')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'public'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Globe className="w-4 h-4" />
                Public Reports
              </button>
              <button
                onClick={() => setSidebarFilter('all')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'all'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                All Reports
              </button>
              <button
                onClick={() => setSidebarFilter('favorites')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'favorites'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Star className="w-4 h-4" />
                All Favorites
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-6">
            {/* Actions */}
            <div className="mb-6 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Report Records</h3>
              <div className="flex gap-3">
                <select
                  value={selectedObjectType}
                  onChange={(e) => setSelectedObjectType(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Objects</option>
                  {OBJECT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
                
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Formats</option>
                  <option value="tabular">📊 Tabular</option>
                  <option value="summary">📈 Summary</option>
                  <option value="matrix">⊞ Matrix</option>
                </select>
                
                <Link
                  href="/reports/builder"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  New Report
                </Link>
              </div>
            </div>

            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search reports by name, description, or object type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Reports List */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-2">
                          <span>Report Name</span>
                          {sortColumn === 'name' && (
                            sortDirection === 'asc' 
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Object</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Format</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Fields</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium">
                          <Link 
                            href={`/reports/view/${report.id}`}
                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-2"
                          >
                            {getFormatIcon(report.format)}
                            {report.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {report.description}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                          {report.objectType}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                          {report.format}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {report.fields.length}
                        </td>
                        <td className="px-6 py-4">
                          {report.isStandard ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              Standard
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Custom
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/reports/view/${report.id}`}
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Run
                            </Link>
                            <button
                              onClick={() => handleToggleFavorite(report.id)}
                              className={`${
                                report.isFavorite 
                                  ? 'text-yellow-500 hover:text-yellow-600' 
                                  : 'text-gray-400 hover:text-yellow-500'
                              }`}
                              title={report.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Star className={`w-4 h-4 ${report.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            {!report.isStandard && (
                              <>
                                <Link
                                  href={`/reports/builder?edit=${report.id}`}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleDuplicateReport(report)}
                                  className="text-gray-600 hover:text-gray-900"
                                  title="Duplicate"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteReport(report.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredReports.length === 0 && (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search or filters.' : 'Get started by creating your first custom report.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Navigation Modal */}
      {editMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setEditMode(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Edit Tischler App App Navigation Items</h2>
              <p className="text-sm text-gray-600 mt-1">Personalize your nav bar for this app. Reorder items, and rename or remove items you've added.</p>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase">Navigation Items ({tabs.length})</h3>
                <button onClick={() => setShowAddTab(true)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Add More Items</button>
              </div>
              <div className="space-y-2">
                {tabs.map((item, index) => (
                  <div key={item.name} draggable onDragStart={() => handleDragStart(index)} onDragOver={(e) => handleDragOver(e, index)} onDragEnd={handleDragEnd} className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 cursor-move group">
                    <GripVertical className="w-5 h-5 text-gray-400" />
                    <span className="flex-1 text-sm font-medium text-gray-900">{item.name}</span>
                    <button onClick={() => handleRemoveTab(index)} className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Remove"><X className="w-4 h-4 text-gray-500" /></button>
                  </div>
                ))}
              </div>
              <button onClick={handleResetToDefault} className="mt-6 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">Reset Navigation to Default</button>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setEditMode(false)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => setEditMode(false)} className="px-6 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Tab Modal */}
      {showAddTab && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddTab(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Navigation Items</h3>
            </div>
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).map((item) => (
                  <button key={item.href} onClick={() => handleAddTab(item)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  </button>
                ))}
                {availableObjects.filter(obj => !tabs.some(t => t.href === obj.href)).map((obj) => (
                  <button key={obj.href} onClick={() => handleAddTab(obj)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left">
                    <span className="text-sm font-medium text-gray-900">{obj.name}</span>
                  </button>
                ))}
                {defaultTabs.filter(dt => !tabs.some(t => t.href === dt.href)).length === 0 && availableObjects.filter(obj => !tabs.some(t => t.href === obj.href)).length === 0 && (
                  <p className="text-gray-500 text-sm py-8 text-center">All available items are already added to navigation.</p>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4">
              <button onClick={() => setShowAddTab(false)} className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
