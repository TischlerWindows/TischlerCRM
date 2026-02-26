'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft,
  Download,
  RefreshCw,
  Filter,
  X,
  Edit
} from 'lucide-react';
import PageHeader from '@/components/page-header';

interface ReportData {
  id: string;
  name: string;
  description: string;
  objectType: string;
  format: 'tabular' | 'summary' | 'matrix';
  fields: string[];
  filters: ReportFilter[];
  groupBy?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface ReportFilter {
  field: string;
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: any;
}



export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.id as string;
  
  const [report, setReport] = useState<ReportData | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupedData, setGroupedData] = useState<{ [key: string]: any[] }>({});

  useEffect(() => {
    loadReport();
  }, [reportId]);

  const loadReport = () => {
    setLoading(true);
    
    // Load report configuration
    let reportConfig: ReportData | null = null;
    
    if (reportId === 'temp') {
      const tempReport = localStorage.getItem('tempReport');
      if (tempReport) {
        reportConfig = JSON.parse(tempReport);
      }
    } else {
      const customReports = localStorage.getItem('customReports');
      if (customReports) {
        const reports = JSON.parse(customReports);
        reportConfig = reports.find((r: ReportData) => r.id === reportId) || null;
      }
    }
    
    if (!reportConfig) {
      setLoading(false);
      return;
    }
    
    setReport(reportConfig);
    
    console.log('🔍 Report config:', reportConfig);
    console.log('🔍 Looking for objectType:', reportConfig.objectType);
    console.log('🔍 Report fields:', reportConfig.fields);
    
    // Load data from localStorage - try multiple naming conventions
    const possibleKeys = [
      reportConfig.objectType,                          // e.g., "Property"
      reportConfig.objectType.toLowerCase(),            // e.g., "property"
      reportConfig.objectType.toLowerCase() + 's',      // e.g., "propertys"
      // Handle proper pluralization
      reportConfig.objectType.toLowerCase().endsWith('y') 
        ? reportConfig.objectType.toLowerCase().slice(0, -1) + 'ies'  // "Property" -> "properties"
        : reportConfig.objectType.toLowerCase() + 's',
    ];
    
    console.log('🔍 Trying localStorage keys:', possibleKeys);
    
    let records: any[] = [];
    
    for (const key of possibleKeys) {
      const rawData = localStorage.getItem(key);
      if (rawData) {
        records = JSON.parse(rawData);
        console.log(`📂 Loaded ${records.length} records from localStorage['${key}']`);
        console.log('📋 First record sample:', records[0]);
        break;
      }
    }
    
    // Generate mock data if no real data exists
    if (records.length === 0) {
      console.log(`⚠️ No data found for ${reportConfig.objectType}, generating mock data`);
      records = generateMockData(reportConfig.objectType, reportConfig.fields);
    }
    
    // Strip object prefix from field names when accessing data
    const stripPrefix = (fieldName: string, objectType: string) => {
      const prefix = `${objectType}__`;
      if (fieldName.startsWith(prefix)) {
        return fieldName.substring(prefix.length);
      }
      return fieldName;
    };
    
    console.log('🔧 Mapping records to clean field names...');
    
    // Map records to use clean field names
    records = records.map((record, idx) => {
      const cleanRecord: any = {};
      reportConfig.fields.forEach(field => {
        const cleanField = stripPrefix(field, reportConfig.objectType);
        cleanRecord[field] = record[cleanField] || record[field]; // Try clean name first, fallback to original
        if (idx === 0) {
          console.log(`  ${field} -> looking for '${cleanField}' in record, found:`, record[cleanField] || record[field]);
        }
      });
      return cleanRecord;
    });
    
    console.log('✅ Mapped records, first record:', records[0]);
    
    // Apply filters
    records = applyFilters(records, reportConfig.filters);
    
    // Apply sorting
    if (reportConfig.sortBy) {
      records = applySorting(records, reportConfig.sortBy, reportConfig.sortOrder || 'asc');
    }
    
    setData(records);
    
    // Group data if needed
    if (reportConfig.groupBy && (reportConfig.format === 'summary' || reportConfig.format === 'matrix')) {
      const grouped = groupData(records, reportConfig.groupBy);
      setGroupedData(grouped);
    }
    
    setLoading(false);
  };

  const generateMockData = (objectType: string, fields: string[]) => {
    const mockData: any[] = [];
    const recordCount = 20;
    
    for (let i = 0; i < recordCount; i++) {
      const record: any = {};
      fields.forEach(field => {
        // Generate appropriate mock data based on field name
        if (field.toLowerCase().includes('name')) {
          record[field] = `Sample ${field} ${i + 1}`;
        } else if (field.toLowerCase().includes('email')) {
          record[field] = `sample${i + 1}@example.com`;
        } else if (field.toLowerCase().includes('phone')) {
          record[field] = `555-${String(i + 1).padStart(4, '0')}`;
        } else if (field.toLowerCase().includes('date')) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          record[field] = date.toISOString().split('T')[0];
        } else if (field.toLowerCase().includes('status')) {
          const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];
          record[field] = statuses[i % statuses.length];
        } else if (field.toLowerCase().includes('type') || field.toLowerCase().includes('category')) {
          const types = ['Type A', 'Type B', 'Type C'];
          record[field] = types[i % types.length];
        } else if (field.toLowerCase().includes('value') || field.toLowerCase().includes('amount') || field.toLowerCase().includes('price')) {
          record[field] = (Math.random() * 10000).toFixed(2);
        } else if (field.toLowerCase().includes('quantity') || field.toLowerCase().includes('count')) {
          record[field] = Math.floor(Math.random() * 100) + 1;
        } else {
          record[field] = `Sample ${field} ${i + 1}`;
        }
      });
      mockData.push(record);
    }
    
    return mockData;
  };

  const applyFilters = (records: any[], filters: ReportFilter[]) => {
    return records.filter(record => {
      return filters.every(filter => {
        if (!filter.field || !filter.value) return true;
        
        const fieldValue = record[filter.field];
        const filterValue = filter.value;
        
        switch (filter.operator) {
          case 'equals':
            return String(fieldValue).toLowerCase() === String(filterValue).toLowerCase();
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
          case 'greaterThan':
            return Number(fieldValue) > Number(filterValue);
          case 'lessThan':
            return Number(fieldValue) < Number(filterValue);
          default:
            return true;
        }
      });
    });
  };

  const applySorting = (records: any[], sortBy: string, sortOrder: 'asc' | 'desc') => {
    return [...records].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === bVal) return 0;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  };

  const groupData = (records: any[], groupByField: string) => {
    return records.reduce((acc, record) => {
      const key = record[groupByField] || 'Unassigned';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(record);
      return acc;
    }, {} as { [key: string]: any[] });
  };

  const formatValue = (field: string, value: any) => {
    if (value === null || value === undefined) return 'N/A';
    
    // Handle composite objects (Address, Name, etc.)
    if (typeof value === 'object' && value !== null) {
      // Address object: {street, city, state, postalCode, country}
      if ('street' in value || 'city' in value || 'postalCode' in value) {
        const parts = [
          value.street,
          value.city,
          value.state,
          value.postalCode,
          value.country
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'N/A';
      }
      
      // Name object: {salutation, firstName, lastName} or Contact prefixed keys
      if ('firstName' in value || 'lastName' in value || 'Contact__name_firstName' in value) {
        const parts = [
          value.salutation || value.Contact__name_salutation,
          value.firstName || value.Contact__name_firstName,
          value.lastName || value.Contact__name_lastName
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(' ') : 'N/A';
      }
      
      // Generic object - try to stringify
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    
    // Format numbers with commas
    if (field.includes('value') || field.includes('Amount') || field.includes('price') || field.includes('budget')) {
      if (typeof value === 'number') {
        return `$${value.toLocaleString()}`;
      }
    }
    
    // Format booleans
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    return String(value);
  };

  const exportToCSV = () => {
    if (!report || data.length === 0) return;
    
    // Create CSV header
    const headers = report.fields.join(',');
    
    // Create CSV rows
    const rows = data.map(record => 
      report.fields.map(field => {
        const value = record[field];
        // Escape commas and quotes
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    );
    
    const csv = [headers, ...rows].join('\n');
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const calculateSummary = (records: any[], field: string) => {
    const numericFields = ['value', 'amount', 'price', 'budget', 'estimatedValue', 'totalAmount', 'probability'];
    const isNumeric = numericFields.some(nf => field.toLowerCase().includes(nf.toLowerCase()));
    
    if (!isNumeric) return null;
    
    const values = records.map(r => Number(r[field]) || 0);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const count = records.length;
    
    return { sum, avg, count };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading report...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h2>
          <p className="text-gray-600 mb-4">The report you're looking for doesn't exist.</p>
          <Link href="/reports" className="text-indigo-600 hover:text-indigo-800">
            Back to Reports
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader 
        title={report.name}
        icon={Filter}
        subtitle={report.description}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <Link
            href="/reports"
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reports
          </Link>
          
          <div className="flex gap-3">
            <button
              onClick={loadReport}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            {reportId !== 'temp' && (
              <Link
                href={`/reports/builder?edit=${reportId}`}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Report
              </Link>
            )}
          </div>
        </div>

        {/* Report Info */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-500">Object:</span>
              <span className="ml-2 text-gray-900 capitalize">{report.objectType}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Format:</span>
              <span className="ml-2 text-gray-900 capitalize">{report.format}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Records:</span>
              <span className="ml-2 text-gray-900">{data.length}</span>
            </div>
            <div>
              <span className="font-medium text-gray-500">Active Filters:</span>
              <span className="ml-2 text-gray-900">{report.filters.filter(f => f.field && f.value).length}</span>
            </div>
          </div>
        </div>

        {/* Tabular Report */}
        {report.format === 'tabular' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {report.fields.map(field => (
                      <th
                        key={field}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {report.fields.map(field => (
                        <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatValue(field, record[field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {data.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No data found matching the report criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Summary Report */}
        {report.format === 'summary' && report.groupBy && (
          <div className="space-y-6">
            {Object.entries(groupedData).map(([groupValue, groupRecords]) => {
              const numericField = report.fields.find(f => 
                ['value', 'amount', 'price', 'budget', 'estimatedValue', 'totalAmount'].some(nf => f.toLowerCase().includes(nf.toLowerCase()))
              );
              const summary = numericField ? calculateSummary(groupRecords, numericField) : null;
              
              return (
                <div key={groupValue} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {groupValue} ({groupRecords.length} records)
                      </h3>
                      {summary && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Total:</span> ${summary.sum.toLocaleString()} | 
                          <span className="ml-2 font-medium">Avg:</span> ${Math.round(summary.avg).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {report.fields.map(field => (
                            <th
                              key={field}
                              className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                            >
                              {field.replace(/([A-Z])/g, ' $1').trim()}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {groupRecords.map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {report.fields.map(field => (
                              <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatValue(field, record[field])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            
            {Object.keys(groupedData).length === 0 && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500">No data found matching the report criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* Matrix Report */}
        {report.format === 'matrix' && (
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-center text-gray-500">
              Matrix reports display cross-tabulated data. This feature will show data grouped by two dimensions.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {report.fields.map(field => (
                      <th
                        key={field}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {field.replace(/([A-Z])/g, ' $1').trim()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((record, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {report.fields.map(field => (
                        <td key={field} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatValue(field, record[field])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
