'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft,
  Plus,
  X,
  Save,
  Play,
  ChevronDown,
  ChevronRight,
  Search,
  GripVertical,
  RefreshCw
} from 'lucide-react';
import PageHeader from '@/components/page-header';
import { useSchemaStore } from '@/lib/schema-store';

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: any;
}

const OBJECT_TYPES = [
  { value: 'Property', label: 'Properties', fields: ['propertyNumber', 'address', 'propertyType', 'status', 'owner', 'squareFeet', 'bedrooms', 'bathrooms'] },
  { value: 'Contact', label: 'Contacts', fields: ['contactNumber', 'firstName', 'lastName', 'email', 'phone', 'role', 'accountName'] },
  { value: 'Account', label: 'Accounts', fields: ['accountNumber', 'accountName', 'industry', 'type', 'phone', 'website', 'billingAddress'] },
  { value: 'Product', label: 'Products', fields: ['productCode', 'productName', 'category', 'unitPrice', 'stockQuantity', 'inStock', 'supplier'] },
  { value: 'Lead', label: 'Leads', fields: ['leadNumber', 'contactName', 'propertyAddress', 'source', 'stage', 'assignedTo', 'estimatedValue'] },
  { value: 'Deal', label: 'Deals', fields: ['dealNumber', 'dealName', 'accountName', 'stage', 'value', 'probability', 'closeDate', 'assignedTo'] },
  { value: 'Project', label: 'Projects', fields: ['projectNumber', 'projectName', 'status', 'startDate', 'expectedCompletion', 'assignedTeam', 'budget'] },
  { value: 'Service', label: 'Service', fields: ['serviceNumber', 'serviceName', 'accountName', 'serviceType', 'status', 'scheduledDate', 'priority'] },
  { value: 'Quote', label: 'Quotes', fields: ['quoteNumber', 'quoteName', 'accountName', 'dealNumber', 'status', 'totalAmount', 'validUntil'] },
  { value: 'Installation', label: 'Installations', fields: ['installationNumber', 'installationName', 'accountName', 'projectNumber', 'status', 'startDate', 'leadInstaller'] },
];

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'greaterThan', label: 'Greater Than' },
  { value: 'lessThan', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'In List' },
];

interface GroupRow {
  id: string;
  field: string;
}

interface ColumnConfig {
  id: string;
  field: string;
  label: string;
}

export default function ReportBuilderPage() {
  const router = useRouter();
  const { schema, loadSchema } = useSchemaStore();
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [objectType, setObjectType] = useState('');
  const [format, setFormat] = useState<'tabular' | 'summary' | 'matrix'>('tabular');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [filters, setFilters] = useState<ReportFilter[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showOutline, setShowOutline] = useState(true);
  const [showFilters, setShowFilters] = useState(true);
  const [showGroups, setShowGroups] = useState(true);
  const [showColumns, setShowColumns] = useState(true);
  const [columnSearch, setColumnSearch] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [leftPanelWidth, setLeftPanelWidth] = useState(15);
  const [isResizing, setIsResizing] = useState(false);

  // Load schema on mount
  useEffect(() => {
    if (!schema) {
      console.log('🔄 Loading schema...');
      loadSchema();
    } else {
      console.log('✅ Schema already loaded:', schema.objects?.length, 'objects');
    }
  }, [schema, loadSchema]);

  // Get fields from schema store for the selected object
  const availableFields = React.useMemo(() => {
    if (!objectType) {
      console.log('⚠️ No objectType selected');
      return [];
    }
    
    // Try to get fields from schema store first
    if (schema?.objects) {
      console.log('🔍 Looking for objectType:', objectType);
      console.log('🔍 Available objects in schema:', schema.objects.map(obj => obj.apiName));
      
      const objectDef = schema.objects.find(obj => obj.apiName === objectType);
      if (objectDef?.fields) {
        const fields = objectDef.fields.map(field => field.apiName);
        console.log(`✅ Loaded ${fields.length} fields from schema for ${objectType}:`, fields);
        return fields;
      } else {
        console.log(`❌ Object ${objectType} not found in schema or has no fields`);
      }
    }
    
    // Fallback: Try to load from localStorage customObjects
    try {
      const storedObjects = localStorage.getItem('customObjects');
      if (storedObjects) {
        const customObjects = JSON.parse(storedObjects);
        console.log('🔍 Custom objects in localStorage:', customObjects.map((obj: any) => obj.apiName));
        const customObject = customObjects.find((obj: any) => obj.apiName === objectType);
        if (customObject?.fields) {
          const fields = customObject.fields.map((field: any) => field.apiName);
          console.log(`✅ Loaded ${fields.length} fields from localStorage for ${objectType}:`, fields);
          return fields;
        }
      }
    } catch (e) {
      console.error('Error loading from localStorage:', e);
    }
    
    // Final fallback to hard-coded fields
    console.log(`⚠️ Using hard-coded fields for ${objectType}`);
    const fallback = OBJECT_TYPES.find(t => t.value === objectType);
    return fallback?.fields || [];
  }, [objectType, schema]);

  // Load report from URL parameters for editing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    
    if (editId) {
      const existingReports = localStorage.getItem('customReports');
      if (existingReports) {
        const reports = JSON.parse(existingReports);
        const reportToEdit = reports.find((r: any) => r.id === editId);
        
        if (reportToEdit) {
          setReportId(reportToEdit.id);
          setReportName(reportToEdit.name || '');
          setDescription(reportToEdit.description || '');
          setObjectType(reportToEdit.objectType || '');
          setFormat(reportToEdit.format || 'tabular');
          setSortBy(reportToEdit.sortBy || '');
          setSortOrder(reportToEdit.sortOrder || 'asc');
          
          // Convert fields to columns
          if (reportToEdit.fields && reportToEdit.fields.length > 0) {
            const cols = reportToEdit.fields.map((field: string, index: number) => ({
              id: String(index + 1),
              field: field,
              label: field
            }));
            setColumns(cols);
          }
          
          // Load filters
          if (reportToEdit.filters) {
            setFilters(reportToEdit.filters);
          }
          
          // Load groups
          if (reportToEdit.groupBy) {
            setGroups([{ id: '1', field: reportToEdit.groupBy }]);
          }
        }
      }
    }
  }, []);

  // Resize handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth >= 15 && newWidth <= 75) {
          setLeftPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Load real data from localStorage when columns or groups change
  useEffect(() => {
    if (objectType && columns.length > 0 && columns.every(c => c.field)) {
      // Try to load real data from localStorage with multiple naming conventions
      const possibleKeys = [
        objectType,                          // e.g., "Property"
        objectType.toLowerCase(),            // e.g., "property"
        objectType.toLowerCase() + 's',      // e.g., "propertys"
        // Handle proper pluralization
        objectType.toLowerCase().endsWith('y') 
          ? objectType.toLowerCase().slice(0, -1) + 'ies'  // "Property" -> "properties"
          : objectType.toLowerCase() + 's',
      ];
      
      let records: any[] = [];
      
      for (const key of possibleKeys) {
        const rawData = localStorage.getItem(key);
        if (rawData) {
          try {
            const allRecords = JSON.parse(rawData);
            console.log(`📂 Preview: Loaded ${allRecords.length} records from localStorage['${key}']`);
            
            // Strip object prefix from field names when accessing data
            const stripPrefix = (fieldName: string, objectType: string) => {
              const prefix = `${objectType}__`;
              if (fieldName.startsWith(prefix)) {
                return fieldName.substring(prefix.length);
              }
              return fieldName;
            };
            
            // Map records to use clean field names
            records = allRecords.slice(0, 10).map((record: any) => {
              const cleanRecord: any = {};
              columns.forEach(col => {
                const cleanField = stripPrefix(col.field, objectType);
                cleanRecord[col.field] = record[cleanField] || record[col.field];
              });
              return cleanRecord;
            });
            
            break;
          } catch (e) {
            console.error('Error parsing data:', e);
          }
        }
      }
      
      // If no real data exists, generate sample data
      if (records.length === 0) {
        console.log(`⚠️ Preview: No real data found for ${objectType}, generating sample data`);
        for (let i = 0; i < 5; i++) {
          const row: any = {};
          columns.forEach(col => {
            const field = col.field;
            
            // Generate appropriate mock data based on field name
            if (field.toLowerCase().includes('name')) {
              row[field] = `Sample ${col.label || field} ${i + 1}`;
            } else if (field.toLowerCase().includes('email')) {
              row[field] = `sample${i + 1}@example.com`;
            } else if (field.toLowerCase().includes('phone')) {
              row[field] = `555-${String(i + 1).padStart(4, '0')}`;
            } else if (field.toLowerCase().includes('date')) {
              const date = new Date();
              date.setDate(date.getDate() - i);
              row[field] = date.toISOString().split('T')[0];
            } else if (field.toLowerCase().includes('status')) {
              const statuses = ['Active', 'Pending', 'Completed'];
              row[field] = statuses[i % statuses.length];
            } else if (field.toLowerCase().includes('type') || field.toLowerCase().includes('category') || field.toLowerCase().includes('industry')) {
              const types = ['Type A', 'Type B', 'Type C'];
              row[field] = types[i % types.length];
            } else if (field.toLowerCase().includes('value') || field.toLowerCase().includes('amount') || field.toLowerCase().includes('price') || field.toLowerCase().includes('budget')) {
              row[field] = `$${(Math.random() * 10000).toFixed(2)}`;
            } else if (field.toLowerCase().includes('quantity') || field.toLowerCase().includes('count') || field.toLowerCase().includes('number')) {
              row[field] = Math.floor(Math.random() * 100) + 1;
            } else if (field.toLowerCase().includes('address')) {
              row[field] = `${100 + i} Main St, City ${i + 1}`;
            } else if (field.toLowerCase().includes('owner') || field.toLowerCase().includes('assigned')) {
              const owners = ['John Doe', 'Jane Smith', 'Bob Johnson'];
              row[field] = owners[i % owners.length];
            } else {
              row[field] = `Sample ${i + 1}`;
            }
          });
          
          records.push(row);
        }
      }
      
      setPreviewData(records);
    } else {
      setPreviewData([]);
    }
  }, [objectType, columns, groups]);

  const addFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const updateFilter = (index: number, field: keyof ReportFilter, value: any) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value } as ReportFilter;
    setFilters(newFilters);
  };

  const toggleField = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
    } else {
      setSelectedFields([...selectedFields, field]);
    }
  };

  const handleSave = () => {
    if (!reportName || !objectType || columns.length === 0) {
      alert('Please fill in required fields: Report Name, Object Type, and at least one column');
      return;
    }

    const today = new Date().toISOString().split('T')[0] || '';
    const existingReports = localStorage.getItem('customReports');
    const reports = existingReports ? JSON.parse(existingReports) : [];
    
    if (reportId) {
      // Update existing report
      const reportIndex = reports.findIndex((r: any) => r.id === reportId);
      if (reportIndex !== -1) {
        reports[reportIndex] = {
          ...reports[reportIndex],
          name: reportName,
          description: description,
          objectType: objectType,
          format: format,
          fields: columns.map(col => col.field).filter(f => f),
          filters: filters.filter(f => f.field && f.value),
          groupBy: format === 'summary' || format === 'matrix' && groups.length > 0 ? groups[0]?.field : undefined,
          sortBy: sortBy || undefined,
          sortOrder: sortBy ? sortOrder : undefined,
          lastModifiedAt: today,
        };
      }
    } else {
      // Create new report
      const newReport = {
        id: `custom-${Date.now()}`,
        name: reportName,
        description: description,
        objectType: objectType,
        format: format,
        fields: columns.map(col => col.field).filter(f => f),
        filters: filters.filter(f => f.field && f.value),
        groupBy: format === 'summary' || format === 'matrix' && groups.length > 0 ? groups[0]?.field : undefined,
        sortBy: sortBy || undefined,
        sortOrder: sortBy ? sortOrder : undefined,
        createdBy: 'Development User',
        createdAt: today,
        lastModifiedAt: today,
        isStandard: false
      };
      reports.push(newReport);
    }
    
    localStorage.setItem('customReports', JSON.stringify(reports));
    router.push('/reports');
  };

  const handleRunReport = () => {
    if (!objectType || columns.length === 0) {
      alert('Please select an object type and at least one column');
      return;
    }
    
    // Create temporary report and navigate to view
    const tempReport = {
      id: 'temp',
      name: reportName || 'Untitled Report',
      description: description,
      objectType: objectType,
      format: format,
      fields: columns.map(col => col.field).filter(f => f),
      filters: filters.filter(f => f.field && f.value),
      groupBy: format === 'summary' || format === 'matrix' && groups.length > 0 ? groups[0]?.field : undefined,
      sortBy: sortBy || undefined,
      sortOrder: sortBy ? sortOrder : undefined,
    };
    
    localStorage.setItem('tempReport', JSON.stringify(tempReport));
    router.push('/reports/view/temp');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
        <Link
          href="/reports"
          className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Reports
        </Link>
        
        <div className="flex gap-3">
          <button
            onClick={() => {
              // Force preview to show current configuration
              const preview = document.querySelector('.preview-table');
              if (preview) {
                preview.classList.add('opacity-50');
                setTimeout(() => preview.classList.remove('opacity-50'), 300);
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh preview with current settings"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Preview
          </button>
          <button
            onClick={handleRunReport}
            className="inline-flex items-center px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <Play className="w-4 h-4 mr-2" />
            Run Report
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Report
          </button>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Configuration */}
        <div 
          className="overflow-y-auto bg-white border-r border-gray-200 pb-8"
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Outline Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowOutline(!showOutline)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900 uppercase">Outline</h3>
              {showOutline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showOutline && (
              <div className="px-6 pb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Report Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="e.g., Monthly Sales Report"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Object Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={objectType}
                    onChange={(e) => {
                      setObjectType(e.target.value);
                      setSelectedFields([]);
                      setFilters([]);
                      setGroups([]);
                      setSortBy('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="">Select an object...</option>
                    {OBJECT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="tabular">Tabular</option>
                    <option value="summary">Summary</option>
                    <option value="matrix">Matrix</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900 uppercase">Filters</h3>
              {showFilters ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showFilters && objectType && (
              <div className="px-6 pb-6">
                <button
                  onClick={addFilter}
                  className="w-full mb-4 px-3 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
                >
                  + Add Filter
                </button>
                <div className="space-y-3">
                  {filters.map((filter, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <select
                        value={filter.field}
                        onChange={(e) => updateFilter(index, 'field', e.target.value)}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Field...</option>
                        {availableFields.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                      
                      <select
                        value={filter.operator}
                        onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                        className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      >
                        {OPERATORS.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      
                      <input
                        type="text"
                        value={filter.value}
                        onChange={(e) => updateFilter(index, 'value', e.target.value)}
                        placeholder="Value..."
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500"
                      />
                      
                      <button
                        onClick={() => removeFilter(index)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Groups Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowGroups(!showGroups)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900 uppercase">Groups ({groups.length})</h3>
              {showGroups ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showGroups && objectType && (
              <div className="px-6 pb-6">
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-white">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <select
                        value={group.field}
                        onChange={(e) => {
                          setGroups(groups.map(g => 
                            g.id === group.id ? { ...g, field: e.target.value } : g
                          ));
                        }}
                        className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 capitalize"
                      >
                        <option value="">Select field...</option>
                        {availableFields.map(field => (
                          <option key={field} value={field} className="capitalize">{field}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setGroups(groups.filter(g => g.id !== group.id))}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      const newId = String(Date.now());
                      setGroups([...groups, { id: newId, field: '' }]);
                    }}
                    className="w-full mt-3 px-3 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
                  >
                    + Add Group
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Columns Section */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => setShowColumns(!showColumns)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50"
            >
              <h3 className="text-sm font-semibold text-gray-900 uppercase">Columns ({columns.length})</h3>
              {showColumns ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {showColumns && objectType && (
              <div className="px-6 pb-20">
                <div className="mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  {columns.map((col) => (
                    <div key={col.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-white">
                      <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                      <div className="flex-1 space-y-1">
                        <select
                          value={col.field}
                          onChange={(e) => {
                            setColumns(columns.map(c => 
                              c.id === col.id ? { ...c, field: e.target.value, label: e.target.value } : c
                            ));
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 capitalize"
                        >
                          <option value="">Select field...</option>
                          {availableFields
                            .filter(field => !columns.some(c => c.id !== col.id && c.field === field))
                            .map(field => (
                              <option key={field} value={field} className="capitalize">{field}</option>
                            ))}
                        </select>
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => {
                            setColumns(columns.map(c => 
                              c.id === col.id ? { ...c, label: e.target.value } : c
                            ));
                          }}
                          className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-indigo-500"
                          placeholder="Custom label (optional)"
                        />
                      </div>
                      <button
                        onClick={() => setColumns(columns.filter(c => c.id !== col.id))}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    onClick={() => {
                      const newId = String(Date.now());
                      setColumns([...columns, { id: newId, field: '', label: '' }]);
                    }}
                    className="w-full mt-3 px-3 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 text-sm font-medium"
                  >
                    + Add Column
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={() => setIsResizing(true)}
          className="w-1 bg-gray-300 hover:bg-indigo-500 cursor-col-resize flex-shrink-0 relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right Panel - Preview */}
        <div 
          className="overflow-y-auto bg-gray-50 p-6"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 uppercase">Preview</h3>
            </div>
            
            {objectType && columns.length > 0 ? (
              <div className="overflow-x-auto preview-table transition-opacity duration-300">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {columns.map(col => (
                        <th
                          key={col.id}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          {col.label || col.field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {previewData.length > 0 ? (
                      <>
                        {groups.length > 0 && groups[0]?.field ? (
                          // Grouped view
                          (() => {
                            const groupedRows: { [key: string]: any[] } = {};
                            const groupField = groups[0]?.field;
                            previewData.forEach(row => {
                              const groupValue = (groupField ? row[groupField] : null) || 'Unassigned';
                              if (!groupedRows[groupValue]) groupedRows[groupValue] = [];
                              groupedRows[groupValue].push(row);
                            });
                            
                            return Object.entries(groupedRows).map(([groupValue, rows]) => (
                              <React.Fragment key={groupValue}>
                                <tr className="bg-indigo-50">
                                  <td colSpan={columns.length} className="px-6 py-2 text-sm font-semibold text-indigo-900">
                                    {groupValue} ({rows.length} records)
                                  </td>
                                </tr>
                                {rows.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    {columns.map(col => (
                                      <td key={col.id} className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                        {row[col.field] || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </React.Fragment>
                            ));
                          })()
                        ) : (
                          // Ungrouped view
                          previewData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              {columns.map(col => (
                                <td key={col.id} className="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                                  {row[col.field] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </>
                    ) : (
                      <tr>
                        <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-gray-400">
                          Add columns with selected fields to see preview data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <p className="text-sm">Configure your report:</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-400">
                  <li>1. Select an object type in Outline</li>
                  <li>2. Add columns to display</li>
                  <li>3. Optionally add filters and groups</li>
                  <li>4. Click "Run Report" to see results</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
