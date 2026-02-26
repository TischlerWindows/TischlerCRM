'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type CRMRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  ownerName: string;
  stage: string;
  amount: number;
  recordType: string;
  [key: string]: string | number | null;
};

type AggregateFunction = 'sum' | 'count' | 'average' | 'max' | 'min';
type DateRange = 'all' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'custom';

type ChartConfig = {
  groupByField: string;
  metricField: string;
  aggregateFunction: AggregateFunction;
  dateRange: DateRange;
  customStartDate?: string;
  customEndDate?: string;
  filterStage?: string;
  filterRecordType?: string;
  showValues: boolean;
  showLegend: boolean;
  sortBy: 'label' | 'value-asc' | 'value-desc';
  maxBars: number;
  chartTitle: string;
  yAxisLabel: string;
  xAxisLabel: string;
  colorScheme: 'blue' | 'green' | 'purple' | 'orange' | 'multi';
};

interface VerticalBarChartConfiguratorProps {
  records: CRMRecord[];
  availableFields?: string[];
  onSave?: (config: ChartConfig) => void;
  initialConfig?: Partial<ChartConfig>;
}

// ============================================================================
// COLOR SCHEMES
// ============================================================================

const COLOR_SCHEMES = {
  blue: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  green: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
  purple: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'],
  orange: ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
  multi: ['#3b82f6', '#10b981', '#f97316', '#8b5cf6', '#ec4899']
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function filterRecordsByDateRange(records: CRMRecord[], dateRange: DateRange, customStart?: string, customEnd?: string): CRMRecord[] {
  const now = new Date();
  
  if (dateRange === 'all') return records;
  
  return records.filter(record => {
    const recordDate = new Date(record.createdAt);
    
    switch (dateRange) {
      case 'thisMonth': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return recordDate >= startOfMonth && recordDate <= now;
      }
      case 'lastMonth': {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        return recordDate >= startOfLastMonth && recordDate <= endOfLastMonth;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
        return recordDate >= startOfQuarter && recordDate <= now;
      }
      case 'lastQuarter': {
        const quarter = Math.floor(now.getMonth() / 3);
        const startOfLastQuarter = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        const endOfLastQuarter = new Date(now.getFullYear(), quarter * 3, 0);
        return recordDate >= startOfLastQuarter && recordDate <= endOfLastQuarter;
      }
      case 'thisYear': {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        return recordDate >= startOfYear && recordDate <= now;
      }
      case 'lastYear': {
        const startOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const endOfLastYear = new Date(now.getFullYear() - 1, 11, 31);
        return recordDate >= startOfLastYear && recordDate <= endOfLastYear;
      }
      case 'custom': {
        if (customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          return recordDate >= start && recordDate <= end;
        }
        return true;
      }
      default:
        return true;
    }
  });
}

function aggregateData(
  records: CRMRecord[],
  groupByField: string,
  metricField: string,
  aggregateFunction: AggregateFunction
): { name: string; value: number }[] {
  const grouped = records.reduce((acc, record) => {
    const groupValue = String(record[groupByField] || 'Unknown');
    if (!acc[groupValue]) {
      acc[groupValue] = [];
    }
    acc[groupValue].push(record);
    return acc;
  }, {} as Record<string, CRMRecord[]>);

  return Object.entries(grouped).map(([name, groupRecords]) => {
    let value = 0;

    switch (aggregateFunction) {
      case 'sum':
        value = groupRecords.reduce((sum, r) => sum + (Number(r[metricField]) || 0), 0);
        break;
      case 'count':
        value = groupRecords.length;
        break;
      case 'average':
        const total = groupRecords.reduce((sum, r) => sum + (Number(r[metricField]) || 0), 0);
        value = groupRecords.length > 0 ? total / groupRecords.length : 0;
        break;
      case 'max':
        value = Math.max(...groupRecords.map(r => Number(r[metricField]) || 0));
        break;
      case 'min':
        value = Math.min(...groupRecords.map(r => Number(r[metricField]) || 0));
        break;
    }

    return { name, value: Math.round(value * 100) / 100 };
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function VerticalBarChartConfigurator({
  records,
  availableFields,
  onSave,
  initialConfig
}: VerticalBarChartConfiguratorProps) {
  const [config, setConfig] = useState<ChartConfig>({
    groupByField: 'stage',
    metricField: 'amount',
    aggregateFunction: 'sum',
    dateRange: 'all',
    showValues: true,
    showLegend: false,
    sortBy: 'value-desc',
    maxBars: 10,
    chartTitle: 'Vertical Bar Chart',
    yAxisLabel: '',
    xAxisLabel: '',
    colorScheme: 'blue',
    ...initialConfig
  });

  // Extract unique values for filters
  const uniqueStages = useMemo(() => 
    Array.from(new Set(records.map(r => r.stage).filter(Boolean))),
    [records]
  );

  const uniqueRecordTypes = useMemo(() =>
    Array.from(new Set(records.map(r => r.recordType).filter(Boolean))),
    [records]
  );

  // Get available numeric fields for metrics
  const numericFields = useMemo(() => {
    if (availableFields) return availableFields;
    if (records.length === 0) return [];
    
    const sample = records[0];
    return Object.keys(sample).filter(key => typeof sample[key] === 'number');
  }, [records, availableFields]);

  // Get available fields for grouping
  const groupableFields = useMemo(() => {
    if (records.length === 0) return [];
    
    const sample = records[0];
    return Object.keys(sample).filter(key => 
      typeof sample[key] === 'string' || typeof sample[key] === 'number'
    );
  }, [records]);

  // Process data based on config
  const chartData = useMemo(() => {
    let filtered = [...records];

    // Apply date range filter
    filtered = filterRecordsByDateRange(
      filtered,
      config.dateRange,
      config.customStartDate,
      config.customEndDate
    );

    // Apply stage filter
    if (config.filterStage) {
      filtered = filtered.filter(r => r.stage === config.filterStage);
    }

    // Apply record type filter
    if (config.filterRecordType) {
      filtered = filtered.filter(r => r.recordType === config.filterRecordType);
    }

    // Aggregate data
    let aggregated = aggregateData(
      filtered,
      config.groupByField,
      config.metricField,
      config.aggregateFunction
    );

    // Sort data
    if (config.sortBy === 'value-asc') {
      aggregated.sort((a, b) => a.value - b.value);
    } else if (config.sortBy === 'value-desc') {
      aggregated.sort((a, b) => b.value - a.value);
    } else {
      aggregated.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Limit bars
    if (config.maxBars > 0) {
      aggregated = aggregated.slice(0, config.maxBars);
    }

    return aggregated;
  }, [records, config]);

  const updateConfig = (updates: Partial<ChartConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const colors = COLOR_SCHEMES[config.colorScheme];

  return (
    <div className="flex h-full gap-6 bg-gray-50">
      {/* LEFT PANEL - Configuration */}
      <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Chart Configuration</h2>
        </div>

        {/* Chart Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Chart Title</label>
          <input
            type="text"
            value={config.chartTitle}
            onChange={(e) => updateConfig({ chartTitle: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        {/* Group By Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Group By</label>
          <select
            value={config.groupByField}
            onChange={(e) => updateConfig({ groupByField: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {groupableFields.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </div>

        {/* Metric Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Metric Field</label>
          <select
            value={config.metricField}
            onChange={(e) => updateConfig({ metricField: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {numericFields.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </div>

        {/* Aggregate Function */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Aggregate Function</label>
          <select
            value={config.aggregateFunction}
            onChange={(e) => updateConfig({ aggregateFunction: e.target.value as AggregateFunction })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="sum">Sum</option>
            <option value="count">Count</option>
            <option value="average">Average</option>
            <option value="max">Maximum</option>
            <option value="min">Minimum</option>
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
          <select
            value={config.dateRange}
            onChange={(e) => updateConfig({ dateRange: e.target.value as DateRange })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="thisQuarter">This Quarter</option>
            <option value="lastQuarter">Last Quarter</option>
            <option value="thisYear">This Year</option>
            <option value="lastYear">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {/* Custom Date Range */}
        {config.dateRange === 'custom' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={config.customStartDate || ''}
                onChange={(e) => updateConfig({ customStartDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={config.customEndDate || ''}
                onChange={(e) => updateConfig({ customEndDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Filters</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stage</label>
              <select
                value={config.filterStage || ''}
                onChange={(e) => updateConfig({ filterStage: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Stages</option>
                {uniqueStages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Record Type</label>
              <select
                value={config.filterRecordType || ''}
                onChange={(e) => updateConfig({ filterRecordType: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Types</option>
                {uniqueRecordTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Display Options</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={config.sortBy}
                onChange={(e) => updateConfig({ sortBy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="label">Label (A-Z)</option>
                <option value="value-asc">Value (Low to High)</option>
                <option value="value-desc">Value (High to Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Bars</label>
              <input
                type="number"
                min="1"
                max="50"
                value={config.maxBars}
                onChange={(e) => updateConfig({ maxBars: parseInt(e.target.value) || 10 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color Scheme</label>
              <select
                value={config.colorScheme}
                onChange={(e) => updateConfig({ colorScheme: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="blue">Blue</option>
                <option value="green">Green</option>
                <option value="purple">Purple</option>
                <option value="orange">Orange</option>
                <option value="multi">Multi-Color</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showValues"
                checked={config.showValues}
                onChange={(e) => updateConfig({ showValues: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="showValues" className="text-sm text-gray-700">Show Values on Bars</label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showLegend"
                checked={config.showLegend}
                onChange={(e) => updateConfig({ showLegend: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <label htmlFor="showLegend" className="text-sm text-gray-700">Show Legend</label>
            </div>
          </div>
        </div>

        {/* Axis Labels */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Axis Labels</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis Label</label>
              <input
                type="text"
                value={config.xAxisLabel}
                onChange={(e) => updateConfig({ xAxisLabel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis Label</label>
              <input
                type="text"
                value={config.yAxisLabel}
                onChange={(e) => updateConfig({ yAxisLabel: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        {onSave && (
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => onSave(config)}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Save Configuration
            </button>
          </div>
        )}

        {/* Data Summary */}
        <div className="border-t border-gray-200 pt-4 text-xs text-gray-500">
          <p>Total Records: {records.length}</p>
          <p>Filtered Records: {chartData.reduce((sum, d) => sum + (config.aggregateFunction === 'count' ? d.value : 0), chartData.length)}</p>
          <p>Bars Displayed: {chartData.length}</p>
        </div>
      </div>

      {/* RIGHT PANEL - Live Chart Preview */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
          <h2 className="text-xl font-bold text-gray-900 mb-6">{config.chartTitle}</h2>
          
          {chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[500px] text-gray-500">
              <p>No data available for the selected filters</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={500}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                  label={config.xAxisLabel ? { value: config.xAxisLabel, position: 'insideBottom', offset: -50 } : undefined}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  label={config.yAxisLabel ? { value: config.yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '8px'
                  }}
                  formatter={(value: any) => [
                    typeof value === 'number' ? value.toLocaleString() : value,
                    config.aggregateFunction.charAt(0).toUpperCase() + config.aggregateFunction.slice(1)
                  ]}
                />
                {config.showLegend && <Legend />}
                <Bar
                  dataKey="value"
                  name={`${config.aggregateFunction} of ${config.metricField}`}
                  label={config.showValues ? { position: 'top', fontSize: 11 } : false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
