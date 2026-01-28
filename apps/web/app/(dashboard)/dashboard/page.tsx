'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard,
  Plus,
  Edit,
  Trash2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart,
  Gauge,
  Table as TableIcon,
  TrendingUp,
  Grid3x3,
  Settings,
  Filter,
  Download,
  RefreshCw,
  Search,
  Clock,
  User,
  Star,
  Eye,
  Copy,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Cog,
  Edit3,
  GripVertical,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { aggregateChartData, getAvailableFields } from '@/lib/chart-data-utils';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import { cn } from '@/lib/utils';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';

interface DashboardWidget {
  id: string;
  type: 'horizontal-bar' | 'vertical-bar' | 'stacked-horizontal-bar' | 'stacked-vertical-bar' | 'line' | 'donut' | 'metric' | 'gauge' | 'funnel' | 'scatter' | 'table';
  title: string;
  reportId?: string;
  dataSource: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
  isFavorite?: boolean;
}

const WIDGET_TYPES = [
  { id: 'vertical-bar', label: 'Vertical Bar Chart', icon: BarChart3 },
  { id: 'horizontal-bar', label: 'Horizontal Bar Chart', icon: BarChart3 },
  { id: 'stacked-vertical-bar', label: 'Stacked Vertical Bar', icon: BarChart3 },
  { id: 'stacked-horizontal-bar', label: 'Stacked Horizontal Bar', icon: BarChart3 },
  { id: 'line', label: 'Line Chart', icon: LineChartIcon },
  { id: 'donut', label: 'Donut Chart', icon: PieChart },
  { id: 'metric', label: 'Metric', icon: TrendingUp },
  { id: 'gauge', label: 'Gauge', icon: Gauge },
  { id: 'funnel', label: 'Funnel Chart', icon: Filter },
  { id: 'scatter', label: 'Scatter Chart', icon: Grid3x3 },
  { id: 'table', label: 'Lightning Table', icon: TableIcon }
];

const OBJECT_TYPES = [
  { value: 'properties', label: 'Properties' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'products', label: 'Products' },
  { value: 'leads', label: 'Leads' },
  { value: 'deals', label: 'Deals' },
  { value: 'projects', label: 'Projects' },
  { value: 'services', label: 'Service' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'installations', label: 'Installations' },
];

const FIELD_OPTIONS: Record<string, string[]> = {
  accounts: ['Name', 'Industry', 'Revenue', 'Employees', 'Status', 'Type', 'Rating'],
  contacts: ['Name', 'Email', 'Phone', 'Title', 'Department', 'Status'],
  deals: ['Name', 'Amount', 'Stage', 'Probability', 'Close Date', 'Owner'],
  leads: ['Name', 'Company', 'Status', 'Source', 'Estimated Value', 'Rating'],
  products: ['Name', 'Category', 'Unit Price', 'Stock Quantity', 'Status'],
  properties: ['Address', 'Type', 'Value', 'Size', 'Status', 'Owner'],
  projects: ['Name', 'Status', 'Budget', 'Start Date', 'End Date', 'Progress'],
  quotes: ['Number', 'Total Amount', 'Status', 'Valid Until', 'Customer'],
  installations: ['Site', 'Scheduled Date', 'Status', 'Team Size', 'Completion Date'],
  services: ['Property', 'Service Type', 'Scheduled Date', 'Status', 'Technician'],
};

const defaultTabs = DEFAULT_TAB_ORDER;

// Helper function to generate contextual data from localStorage or fallback to mock data
const generateMockDataForObject = (objectType: string, xField: string, yField: string) => {
  // Try to load real data from localStorage first
  let records: any[] = [];
  
  // Try multiple naming conventions for localStorage keys
  const possibleKeys = [
    objectType,                          // e.g., "Property"
    objectType.toLowerCase(),            // e.g., "property"
    objectType.toLowerCase() + 's',      // e.g., "properties"
    objectType + 's',                    // e.g., "Propertys" (unlikely but possible)
  ];
  
  try {
    for (const key of possibleKeys) {
      const storedData = localStorage.getItem(key);
      if (storedData) {
        records = JSON.parse(storedData);
        console.log(`📂 Loaded ${records.length} records from localStorage['${key}'] for ${objectType}`);
        break;
      }
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }
  
  // Fallback to mock data if no real data exists
  if (records.length === 0) {
    console.log(`⚠️ No real data found for ${objectType}, using mock data`);
    const mockDataMap: Record<string, any[]> = {
      Property: [
        { address: '123 Main St', propertyType: 'Residential', status: 'Available', squareFeet: 2500, bedrooms: 3, bathrooms: 2, price: 450000 },
        { address: '456 Oak Ave', propertyType: 'Commercial', status: 'Sold', squareFeet: 5000, bedrooms: 0, bathrooms: 3, price: 850000 },
        { address: '789 Pine Rd', propertyType: 'Residential', status: 'Pending', squareFeet: 1800, bedrooms: 2, bathrooms: 1, price: 320000 },
        { address: '321 Elm Blvd', propertyType: 'Industrial', status: 'Available', squareFeet: 10000, bedrooms: 0, bathrooms: 2, price: 1200000 },
        { address: '654 Maple Dr', propertyType: 'Residential', status: 'Available', squareFeet: 3200, bedrooms: 4, bathrooms: 3, price: 575000 },
        { address: '987 Cedar Ln', propertyType: 'Commercial', status: 'Available', squareFeet: 7500, bedrooms: 0, bathrooms: 4, price: 950000 },
      ],
      properties: [ // Fallback for old naming convention
        { address: '123 Main St', propertyType: 'Residential', status: 'Available', squareFeet: 2500, bedrooms: 3, bathrooms: 2, price: 450000 },
        { address: '456 Oak Ave', propertyType: 'Commercial', status: 'Sold', squareFeet: 5000, bedrooms: 0, bathrooms: 3, price: 850000 },
        { address: '789 Pine Rd', propertyType: 'Residential', status: 'Pending', squareFeet: 1800, bedrooms: 2, bathrooms: 1, price: 320000 },
        { address: '321 Elm Blvd', propertyType: 'Industrial', status: 'Available', squareFeet: 10000, bedrooms: 0, bathrooms: 2, price: 1200000 },
        { address: '654 Maple Dr', propertyType: 'Residential', status: 'Available', squareFeet: 3200, bedrooms: 4, bathrooms: 3, price: 575000 },
        { address: '987 Cedar Ln', propertyType: 'Commercial', status: 'Available', squareFeet: 7500, bedrooms: 0, bathrooms: 4, price: 950000 },
      ],
      Contact: [
        { name: 'John Smith', role: 'Manager', accountName: 'Acme Corp', email: 'john@acme.com' },
        { name: 'Jane Doe', role: 'Developer', accountName: 'Tech Inc', email: 'jane@tech.com' },
        { name: 'Bob Johnson', role: 'Manager', accountName: 'Global Ltd', email: 'bob@global.com' },
        { name: 'Alice Brown', role: 'Sales', accountName: 'Acme Corp', email: 'alice@acme.com' },
        { name: 'Charlie Wilson', role: 'Developer', accountName: 'Startup Co', email: 'charlie@startup.com' },
      ],
      contacts: [ // Fallback for old naming convention
        { name: 'John Smith', role: 'Manager', accountName: 'Acme Corp', email: 'john@acme.com' },
        { name: 'Jane Doe', role: 'Developer', accountName: 'Tech Inc', email: 'jane@tech.com' },
        { name: 'Bob Johnson', role: 'Manager', accountName: 'Global Ltd', email: 'bob@global.com' },
        { name: 'Alice Brown', role: 'Sales', accountName: 'Acme Corp', email: 'alice@acme.com' },
        { name: 'Charlie Wilson', role: 'Developer', accountName: 'Startup Co', email: 'charlie@startup.com' },
      ],
      Deal: [
        { dealName: 'Q1 Contract', stage: 'Prospecting', value: 50000, probability: 20, closeDate: '2024-03-15' },
        { dealName: 'Enterprise Sale', stage: 'Qualification', value: 75000, probability: 40, closeDate: '2024-04-20' },
        { dealName: 'Partner Deal', stage: 'Proposal', value: 120000, probability: 60, closeDate: '2024-05-10' },
        { dealName: 'Upsell Opportunity', stage: 'Negotiation', value: 90000, probability: 80, closeDate: '2024-06-05' },
        { dealName: 'New Account', stage: 'Closed Won', value: 150000, probability: 100, closeDate: '2024-02-28' },
      ],
      deals: [ // Fallback for old naming convention
        { dealName: 'Q1 Contract', stage: 'Prospecting', value: 50000, probability: 20, closeDate: '2024-03-15' },
        { dealName: 'Enterprise Sale', stage: 'Qualification', value: 75000, probability: 40, closeDate: '2024-04-20' },
        { dealName: 'Partner Deal', stage: 'Proposal', value: 120000, probability: 60, closeDate: '2024-05-10' },
        { dealName: 'Upsell Opportunity', stage: 'Negotiation', value: 90000, probability: 80, closeDate: '2024-06-05' },
        { dealName: 'New Account', stage: 'Closed Won', value: 150000, probability: 100, closeDate: '2024-02-28' },
      ],
      Lead: [
        { leadName: 'Marketing Campaign', stage: 'New', estimatedValue: 25000, source: 'Website', owner: 'John' },
        { leadName: 'Referral Lead', stage: 'Contacted', estimatedValue: 30000, source: 'Referral', owner: 'Jane' },
        { leadName: 'Trade Show', stage: 'Qualified', estimatedValue: 45000, source: 'Website', owner: 'Bob' },
        { leadName: 'Cold Outreach', stage: 'New', estimatedValue: 20000, source: 'Cold Call', owner: 'Alice' },
        { leadName: 'Partner Referral', stage: 'Qualified', estimatedValue: 60000, source: 'Referral', owner: 'Charlie' },
      ],
      leads: [ // Fallback for old naming convention
        { leadName: 'Marketing Campaign', stage: 'New', estimatedValue: 25000, source: 'Website', owner: 'John' },
        { leadName: 'Referral Lead', stage: 'Contacted', estimatedValue: 30000, source: 'Referral', owner: 'Jane' },
        { leadName: 'Trade Show', stage: 'Qualified', estimatedValue: 45000, source: 'Website', owner: 'Bob' },
        { leadName: 'Cold Outreach', stage: 'New', estimatedValue: 20000, source: 'Cold Call', owner: 'Alice' },
        { leadName: 'Partner Referral', stage: 'Qualified', estimatedValue: 60000, source: 'Referral', owner: 'Charlie' },
      ],
      Project: [
        { projectName: 'Website Redesign', status: 'Planning', budget: 100000, team: 'Marketing' },
        { projectName: 'CRM Integration', status: 'In Progress', budget: 250000, team: 'Engineering' },
        { projectName: 'Mobile App', status: 'Completed', budget: 180000, team: 'Product' },
        { projectName: 'API Platform', status: 'In Progress', budget: 320000, team: 'Engineering' },
      ],
      projects: [ // Fallback for old naming convention
        { projectName: 'Website Redesign', status: 'Planning', budget: 100000, team: 'Marketing' },
        { projectName: 'CRM Integration', status: 'In Progress', budget: 250000, team: 'Engineering' },
        { projectName: 'Mobile App', status: 'Completed', budget: 180000, team: 'Product' },
        { projectName: 'API Platform', status: 'In Progress', budget: 320000, team: 'Engineering' },
      ],
    };
    
    records = mockDataMap[objectType] || mockDataMap[objectType.toLowerCase()] || mockDataMap[objectType.toLowerCase() + 's'] || [];
  }
  
  if (records.length === 0) return [];
  
  // Strip object prefix from field names (e.g., "Property__address" -> "address")
  const stripPrefix = (fieldName: string, objectType: string) => {
    const prefix = `${objectType}__`;
    if (fieldName.startsWith(prefix)) {
      return fieldName.substring(prefix.length);
    }
    return fieldName;
  };
  
  const cleanXField = stripPrefix(xField, objectType);
  const cleanYField = stripPrefix(yField, objectType);
  
  console.log(`🔧 Field mapping: ${xField} -> ${cleanXField}, ${yField} -> ${cleanYField}`);
  
  // Group by X field and aggregate Y field  
  const groups: Record<string, number[]> = {};
  records.forEach((record: any) => {
    const xValue = String(record[cleanXField] || 'Unknown');
    
    // Try to parse Y field as number, if it fails (string field), count it as 1
    const yRawValue = record[cleanYField];
    const yValue = typeof yRawValue === 'number' ? yRawValue : (parseFloat(yRawValue) || 1);
    
    if (!groups[xValue]) {
      groups[xValue] = [];
    }
    groups[xValue].push(yValue);
  });
  
  // Calculate sum for each group
  const chartData = Object.entries(groups).map(([label, values]) => ({
    label,
    value: Math.round(values.reduce((sum, val) => sum + val, 0))
  }));
  
  // Sort by value descending
  chartData.sort((a, b) => b.value - a.value);
  
  return chartData.slice(0, 8);
};

export default function DashboardPage() {
  const pathname = usePathname();
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);

  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [showNewDashboard, setShowNewDashboard] = useState(false);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [showWidgetConfig, setShowWidgetConfig] = useState(false);
  const [selectedWidgetType, setSelectedWidgetType] = useState<string | null>(null);
  const [availableReports, setAvailableReports] = useState<any[]>([]);
  const [widgetConfig, setWidgetConfig] = useState<any>({
    reportId: '',
    dataSource: '',
    xAxis: '',
    yAxis: '',
    aggregationType: 'sum',
    displayUnits: 'actual',
    showValues: true,
    sortLegend: 'asc',
    yAxisRange: 'automatic',
    yAxisMin: 0,
    yAxisMax: 100,
    decimalPlaces: 'automatic',
    customDecimals: 2,
    sortBy: '',
    customLink: '',
    title: '',
    subtitle: '',
    footer: '',
    legendPosition: 'right'
  });
  const [dashEditMode, setDashEditMode] = useState(false);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [refreshingWidgetId, setRefreshingWidgetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [previewKey, setPreviewKey] = useState(0);
  const [resizingWidget, setResizingWidget] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);

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

  // Generate preview data based on widget config
  const previewData = useMemo(() => {
    console.log('🎯 useMemo running - selectedWidgetType:', selectedWidgetType, 'reportId:', widgetConfig.reportId, 'xAxis:', widgetConfig.xAxis, 'yAxis:', widgetConfig.yAxis);
    
    if (!selectedWidgetType) return null;
    
    // For bar charts with real data
    if ((selectedWidgetType === 'vertical-bar' || selectedWidgetType === 'horizontal-bar') && widgetConfig.reportId && widgetConfig.xAxis && widgetConfig.yAxis) {
      const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
      
      if (selectedReport) {
        console.log('✅ Fetching real data for:', { objectType: selectedReport.objectType, xAxis: widgetConfig.xAxis, yAxis: widgetConfig.yAxis });
        
        try {
          // Use the aggregation utility to get real data from localStorage
          const aggregatedData = aggregateChartData({
            objectType: selectedReport.objectType,
            xAxisField: widgetConfig.xAxis,
            yAxisField: widgetConfig.yAxis,
            aggregationType: widgetConfig.aggregationType || 'sum'
          });
          
          console.log('📊 Aggregated data:', aggregatedData);
          
          if (aggregatedData && aggregatedData.length > 0) {
            return { data: aggregatedData };
          } else {
            return { data: [] };
          }
        } catch (error) {
          console.error('❌ Error aggregating data:', error);
          return { data: [] };
        }
      }
    } else if (widgetConfig.reportId && (!widgetConfig.xAxis || !widgetConfig.yAxis)) {
      // Report selected but no axes - show prompt
      return {
        data: [
          { label: 'Configure X & Y Axis', value: 30 },
          { label: 'to see preview', value: 20 }
        ]
      };
    } else {
      // Default sample data when no report selected
      if (selectedWidgetType === 'vertical-bar' || selectedWidgetType === 'horizontal-bar') {
        return {
          data: [
            { label: 'Jan', value: 45 },
            { label: 'Feb', value: 62 },
            { label: 'Mar', value: 38 },
            { label: 'Apr', value: 75 },
            { label: 'May', value: 52 }
          ]
        };
      } else if (selectedWidgetType === 'line') {
        return {
          data: [
            { label: 'Week 1', value: 30 },
            { label: 'Week 2', value: 45 },
            { label: 'Week 3', value: 38 },
            { label: 'Week 4', value: 62 }
          ]
        };
      } else if (selectedWidgetType === 'donut') {
        return {
          data: [
            { label: 'Category A', value: 35 },
            { label: 'Category B', value: 25 },
            { label: 'Category C', value: 20 },
            { label: 'Category D', value: 20 }
          ]
        };
      } else if (selectedWidgetType === 'metric') {
        return {
          value: 1234,
          prefix: '$',
          suffix: '',
          trend: 12
        };
      }
    }
    
    return null;
  }, [selectedWidgetType, widgetConfig.reportId, widgetConfig.xAxis, widgetConfig.yAxis, availableReports]);

  const handleResizeStart = (e: React.MouseEvent, widget: DashboardWidget) => {
    if (!dashEditMode) return;
    e.preventDefault();
    setResizingWidget({
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: widget.position.w,
      startH: widget.position.h
    });
  };

  useEffect(() => {
    if (!resizingWidget) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedDashboard) return;

      const deltaX = (e.clientX - resizingWidget.startX) / 100; // pixels to grid units
      const deltaY = (e.clientY - resizingWidget.startY) / 50; // pixels to grid units (50px per row)

      let newW = Math.max(2, Math.min(9, Math.round(resizingWidget.startW + deltaX)));
      let newH = Math.max(1, Math.round(resizingWidget.startH + deltaY));

      const updatedDashboard = {
        ...selectedDashboard,
        widgets: selectedDashboard.widgets.map(w =>
          w.id === resizingWidget.id
            ? { ...w, position: { ...w.position, w: newW, h: newH } }
            : w
        )
      };

      const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
      setDashboards(updated);
      setSelectedDashboard(updatedDashboard);
    };

    const handleMouseUp = () => {
      setResizingWidget(null);
      if (selectedDashboard) {
        localStorage.setItem('dashboards', JSON.stringify(dashboards));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingWidget, selectedDashboard, dashboards]);

  useEffect(() => {
    // Load saved reports for widget data sources
    const loadReports = () => {
      const savedReports = localStorage.getItem('customReports');
      if (savedReports) {
        try {
          const reports = JSON.parse(savedReports);
          setAvailableReports(reports || []);
        } catch (e) {
          console.error('Error loading reports:', e);
          setAvailableReports([]);
        }
      } else {
        setAvailableReports([]);
      }
    };

    loadReports();

    // Load dashboards from localStorage
    const savedDashboards = localStorage.getItem('dashboards');
    if (savedDashboards) {
      const parsed = JSON.parse(savedDashboards);
      setDashboards(parsed);
      if (parsed.length > 0) {
        setSelectedDashboard(parsed[0]);
      }
    } else {
      // Create default dashboard
      const defaultDashboard: Dashboard = {
        id: '1',
        name: 'Sales Overview',
        description: 'Key sales metrics and performance indicators',
        widgets: [
          {
            id: 'w1',
            type: 'metric',
            title: 'Total Revenue',
            dataSource: 'deals',
            config: { value: 2450000, prefix: '$', trend: 12.5 },
            position: { x: 0, y: 0, w: 3, h: 1 }
          },
          {
            id: 'w2',
            type: 'metric',
            title: 'Active Deals',
            dataSource: 'deals',
            config: { value: 47, trend: -5.2 },
            position: { x: 3, y: 0, w: 3, h: 1 }
          },
          {
            id: 'w3',
            type: 'metric',
            title: 'Win Rate',
            dataSource: 'deals',
            config: { value: 68, suffix: '%', trend: 3.1 },
            position: { x: 6, y: 0, w: 3, h: 1 }
          },
          {
            id: 'w4',
            type: 'vertical-bar',
            title: 'Deals by Stage',
            dataSource: 'deals',
            config: {
              data: [
                { label: 'Prospecting', value: 15 },
                { label: 'Qualification', value: 12 },
                { label: 'Proposal', value: 8 },
                { label: 'Negotiation', value: 7 },
                { label: 'Closed Won', value: 5 }
              ]
            },
            position: { x: 0, y: 1, w: 6, h: 2 }
          },
          {
            id: 'w5',
            type: 'donut',
            title: 'Revenue by Product',
            dataSource: 'products',
            config: {
              data: [
                { label: 'Solar Panels', value: 45 },
                { label: 'Inverters', value: 25 },
                { label: 'Batteries', value: 20 },
                { label: 'Installation', value: 10 }
              ]
            },
            position: { x: 6, y: 1, w: 3, h: 2 }
          },
          {
            id: 'w6',
            type: 'line',
            title: 'Monthly Revenue Trend',
            dataSource: 'deals',
            config: {
              data: [
                { label: 'Jan', value: 180000 },
                { label: 'Feb', value: 195000 },
                { label: 'Mar', value: 210000 },
                { label: 'Apr', value: 205000 },
                { label: 'May', value: 225000 },
                { label: 'Jun', value: 240000 }
              ]
            },
            position: { x: 0, y: 3, w: 9, h: 2 }
          }
        ],
        createdBy: 'Development User',
        createdAt: '2024-01-15',
        lastModifiedAt: new Date().toISOString().split('T')[0] || ''
      };
      setDashboards([defaultDashboard]);
      setSelectedDashboard(defaultDashboard);
      localStorage.setItem('dashboards', JSON.stringify([defaultDashboard]));
    }
    setLoading(false);
  }, []);

  const handleCreateDashboard = (name: string, description: string) => {
    const newDashboard: Dashboard = {
      id: Date.now().toString(),
      name,
      description,
      widgets: [],
      createdBy: 'Development User',
      createdAt: new Date().toISOString().split('T')[0] || '',
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = [...dashboards, newDashboard];
    setDashboards(updated);
    setSelectedDashboard(newDashboard);
    localStorage.setItem('dashboards', JSON.stringify(updated));
    setShowNewDashboard(false);
  };

  const handleDeleteDashboard = (id: string) => {
    if (confirm('Are you sure you want to delete this dashboard?')) {
      const updated = dashboards.filter(d => d.id !== id);
      setDashboards(updated);
      if (selectedDashboard?.id === id) {
        setSelectedDashboard(updated[0] || null);
      }
      localStorage.setItem('dashboards', JSON.stringify(updated));
    }
  };

  const handleSelectWidgetType = (type: string) => {
    // Reload reports to ensure we have the latest
    const savedReports = localStorage.getItem('customReports');
    let reports = [];
    if (savedReports) {
      try {
        reports = JSON.parse(savedReports);
        setAvailableReports(reports || []);
      } catch (e) {
        console.error('Error loading reports:', e);
      }
    }

    setSelectedWidgetType(type);
    setWidgetConfig({
      reportId: reports.length > 0 ? reports[0].id : '',
      dataSource: reports.length > 0 ? reports[0].objectType : '',
      xAxis: '',
      yAxis: '',
      aggregationType: 'sum',
      displayUnits: 'actual',
      showValues: true,
      sortLegend: 'asc',
      yAxisRange: 'automatic',
      yAxisMin: 0,
      yAxisMax: 100,
      decimalPlaces: 'automatic',
      customDecimals: 2,
      sortBy: '',
      customLink: '',
      title: `New ${WIDGET_TYPES.find(t => t.id === type)?.label}`,
      subtitle: '',
      footer: '',
      legendPosition: 'right'
    });
    setShowWidgetSelector(false);
    setShowWidgetConfig(true);
  };

  const handleSaveWidget = () => {
    if (!selectedDashboard || !selectedWidgetType) return;

    // Use the real previewData that was computed with actual aggregation
    let configData: any = { ...widgetConfig };
    if (previewData) {
      if (previewData.data) {
        configData.data = previewData.data;
      }
      if (previewData.value !== undefined) {
        configData.value = previewData.value;
        configData.prefix = previewData.prefix || '$';
        configData.suffix = previewData.suffix || '';
        configData.trend = previewData.trend || 0;
      }
    }

    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      type: selectedWidgetType as any,
      title: widgetConfig.title,
      reportId: widgetConfig.reportId,
      dataSource: widgetConfig.dataSource,
      config: configData,
      position: { x: 0, y: 0, w: 4, h: 2 }
    };

    const updatedDashboard = {
      ...selectedDashboard,
      widgets: [...selectedDashboard.widgets, newWidget],
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };

    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    localStorage.setItem('dashboards', JSON.stringify(updated));
    setShowWidgetConfig(false);
    setSelectedWidgetType(null);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!selectedDashboard) return;

    const updatedDashboard = {
      ...selectedDashboard,
      widgets: selectedDashboard.widgets.filter(w => w.id !== widgetId),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };

    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    localStorage.setItem('dashboards', JSON.stringify(updated));
  };

  const handleRefreshWidget = (widget: DashboardWidget) => {
    if (!selectedDashboard) return;

    // Show loading overlay
    setRefreshingWidgetId(widget.id);

    // Find the report to get object type
    const report = availableReports.find(r => r.id === widget.reportId);
    if (!report) {
      console.warn('Report not found for widget refresh');
      setRefreshingWidgetId(null);
      return;
    }

    const objectType = report.objectType;
    const xField = widget.config?.xAxis;
    const yField = widget.config?.yAxis;

    if (!objectType || !xField || !yField) {
      console.warn('Widget missing configuration for refresh');
      setRefreshingWidgetId(null);
      return;
    }

    console.log(`🔄 Refreshing widget: ${widget.title} with ${objectType}, ${xField}, ${yField}`);

    try {
      // Use aggregateChartData utility to recompute widget data
      const aggregatedData = aggregateChartData({
        objectType,
        xAxisField: xField,
        yAxisField: yField,
        aggregationType: widget.config?.aggregationType || 'sum'
      });

      if (!aggregatedData || aggregatedData.length === 0) {
        console.warn('No data available after refresh');
        setRefreshingWidgetId(null);
        return;
      }

      // Update the widget with fresh data
      const updatedWidgets = selectedDashboard.widgets.map(w => 
        w.id === widget.id 
          ? { ...w, config: { ...w.config, data: aggregatedData } }
          : w
      );

      const updatedDashboard = {
        ...selectedDashboard,
        widgets: updatedWidgets,
        lastModifiedAt: new Date().toISOString().split('T')[0] || ''
      };

      const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
      setDashboards(updated);
      setSelectedDashboard(updatedDashboard);
      localStorage.setItem('dashboards', JSON.stringify(updated));

      console.log(`✨ Refreshed widget: ${widget.title} with ${aggregatedData.length} data points`);
      
      // Hide loading overlay after a brief moment
      setTimeout(() => {
        setRefreshingWidgetId(null);
      }, 400);
    } catch (error) {
      console.error('❌ Error refreshing widget:', error);
      setRefreshingWidgetId(null);
    }
  };

  const handleEditWidget = (widget: DashboardWidget) => {
    if (!widget) return;
    setEditingWidget(widget.id);
    setSelectedWidgetType(widget.type);
    setWidgetConfig({
      reportId: widget.reportId,
      dataSource: widget.dataSource,
      xAxis: widget.config?.xAxis || '',
      yAxis: widget.config?.yAxis || '',
      aggregationType: widget.config?.aggregationType || 'sum',
      displayUnits: widget.config?.displayUnits || 'actual',
      showValues: widget.config?.showValues !== false,
      sortLegend: widget.config?.sortLegend || 'asc',
      yAxisRange: widget.config?.yAxisRange || 'automatic',
      yAxisMin: widget.config?.yAxisMin || 0,
      yAxisMax: widget.config?.yAxisMax || 100,
      decimalPlaces: widget.config?.decimalPlaces || 'automatic',
      customDecimals: widget.config?.customDecimals || 2,
      sortBy: widget.config?.sortBy || '',
      customLink: widget.config?.customLink || '',
      title: widget.title || '',
      subtitle: widget.config?.subtitle || '',
      footer: widget.config?.footer || '',
      legendPosition: widget.config?.legendPosition || 'right'
    });
    setShowWidgetConfig(true);
  };

  const handleUpdateWidget = () => {
    if (!selectedDashboard || !editingWidget || !selectedWidgetType) return;

    // Get the existing widget to preserve its position
    const existingWidget = selectedDashboard.widgets.find(w => w.id === editingWidget);

    // Use the real previewData that was computed with actual aggregation
    let configData: any = { ...widgetConfig };
    if (previewData) {
      if (previewData.data) {
        configData.data = previewData.data;
      }
      if (previewData.value !== undefined) {
        configData.value = previewData.value;
        configData.prefix = previewData.prefix || '$';
        configData.suffix = previewData.suffix || '';
        configData.trend = previewData.trend || 0;
      }
    }

    const updatedWidget: DashboardWidget = {
      id: editingWidget,
      type: selectedWidgetType as any,
      title: widgetConfig.title,
      reportId: widgetConfig.reportId,
      dataSource: widgetConfig.dataSource,
      config: configData,
      position: existingWidget?.position || { x: 0, y: 0, w: 4, h: 2 }
    };

    const updatedDashboard = {
      ...selectedDashboard,
      widgets: selectedDashboard.widgets.map(w => w.id === editingWidget ? updatedWidget : w),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };

    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    localStorage.setItem('dashboards', JSON.stringify(updated));
    setShowWidgetConfig(false);
    setSelectedWidgetType(null);
    setEditingWidget(null);
  };

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    localStorage.setItem('tabConfiguration', JSON.stringify(newTabs));
    setTabs(newTabs);
  };

  const handleResetToDefault = () => {
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
    if (!draggedTab) return;
    
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(index, 0, draggedTab);

    setTabs(newTabs);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    saveTabConfiguration(tabs);
  };

  const handleAddTab = (tab: { name: string; href: string }) => {
    const newTabs = [...tabs, tab];
    saveTabConfiguration(newTabs);
    setShowAddTab(false);
  };

  const handleRemoveTab = (index: number) => {
    const newTabs = tabs.filter((_, i) => i !== index);
    saveTabConfiguration(newTabs);
  };

  const renderWidget = (widget: DashboardWidget) => {
    const widgetStyle = {
      gridColumn: `span ${widget.position.w}`,
      gridRow: `span ${widget.position.h}`
    };

    switch (widget.type) {
      case 'metric':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative group">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse" />
            )}
            <div className="absolute top-2 right-2 flex gap-1">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm text-gray-600 mb-2">{widget.title}</div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-gray-900">
                {widget.config.prefix}{widget.config.value?.toLocaleString()}{widget.config.suffix}
              </div>
              {widget.config.trend && (
                <div className={`text-sm font-medium ${widget.config.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {widget.config.trend > 0 ? '+' : ''}{widget.config.trend}%
                </div>
              )}
            </div>
          </div>
        );

      case 'vertical-bar':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative flex flex-col group">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {dashEditMode && (
              <div
                onMouseDown={(e) => handleResizeStart(e, widget)}
                className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-500 rounded-tl cursor-se-resize hover:bg-indigo-600 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            
            {widget.config.data && widget.config.data.length > 0 ? (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={widget.config.data}
                    margin={{ top: 20, right: 30, left: 0, bottom: Math.max(40, Math.min(80, (widget.config.data?.length || 1) * 8)) }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      angle={-45}
                      textAnchor="end"
                      height={Math.max(40, Math.min(80, (widget.config.data?.length || 1) * 8))}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      label={{ value: widget.config.yAxis || 'Value', angle: -90, position: 'insideLeft' }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                      formatter={(value: any) => [Number(value).toLocaleString(), 'Count']}
                    />
                    {widget.config.showLegend && <Legend />}
                    <Bar dataKey="value" fill={widget.config.barColor || '#4f46e5'} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400 text-sm flex-1">
                {widget.config.xAxis && widget.config.yAxis ? 'No data available' : 'Configure axes to see data'}
              </div>
            )}
          </div>
        );

      case 'horizontal-bar':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative group flex flex-col">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            {dashEditMode && (
              <div
                onMouseDown={(e) => handleResizeStart(e, widget)}
                className="absolute bottom-0 right-0 w-4 h-4 bg-indigo-500 rounded-tl cursor-se-resize hover:bg-indigo-600 z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              {widget.config.data?.map((item: any, idx: number) => {
                const maxValue = Math.max(...widget.config.data.map((d: any) => d.value));
                const widthPercent = (item.value / maxValue) * 100;
                const barHeight = Math.max(24, Math.min(32, 100 / Math.max(1, (widget.config.data?.length || 1))));
                return (
                  <div key={idx} className="flex items-center gap-3 flex-1 min-h-0">
                    <div className="text-xs text-gray-600 w-20 text-right truncate">{item.label}</div>
                    <div className="flex-1 bg-gray-100 rounded-full flex items-center" style={{ height: `${barHeight}px` }}>
                      <div
                        className="bg-indigo-500 rounded-full h-full transition-all hover:bg-indigo-600"
                        style={{ width: `${widthPercent}%`, minWidth: '2px' }}
                        title={`${item.label}: ${item.value}`}
                      />
                    </div>
                    <div className="text-xs text-gray-700 font-medium w-12">{item.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'line':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            <div className="flex items-end gap-2 h-[calc(100%-2rem)]">
              {widget.config.data?.map((item: any, idx: number) => (
                <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end">
                  <div className="relative h-full w-full flex items-end justify-center">
                    <div
                      className="bg-indigo-100 w-full rounded-t"
                      style={{ height: `${(item.value / Math.max(...widget.config.data.map((d: any) => d.value))) * 100}%` }}
                    />
                    {idx > 0 && (
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500" />
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-2">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'donut':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                  {widget.config.data?.reduce((acc: any[], item: any, idx: number) => {
                    const total = widget.config.data.reduce((sum: number, d: any) => sum + d.value, 0);
                    const percentage = (item.value / total) * 100;
                    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'];
                    const offset = acc.length > 0 ? acc[acc.length - 1].offset : 0;
                    
                    acc.push({
                      percentage,
                      offset,
                      color: colors[idx % colors.length]
                    });
                    return acc;
                  }, []).map((segment: any, idx: number) => (
                    <circle
                      key={idx}
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="20"
                      strokeDasharray={`${segment.percentage * 2.513} 251.3`}
                      strokeDashoffset={-segment.offset * 2.513}
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-4 space-y-2 w-full">
                {widget.config.data?.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'][idx % 4] }} />
                    <span className="text-gray-700">{item.label}</span>
                    <span className="text-gray-500 ml-auto">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'gauge':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
              <Gauge className="w-24 h-24 text-indigo-600" />
              <div className="text-2xl font-bold text-gray-900 mt-4">75%</div>
              <div className="text-sm text-gray-600">Goal Achievement</div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 relative overflow-auto">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit widget"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteWidget(widget.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                    title="Delete widget"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
            <div className="text-sm font-semibold text-gray-900 mb-4">{widget.title}</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-600">Name</th>
                  <th className="text-left py-2 text-gray-600">Status</th>
                  <th className="text-right py-2 text-gray-600">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-2">Acme Corp</td>
                  <td className="py-2"><span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span></td>
                  <td className="py-2 text-right">$125,000</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2">TechStart Inc</td>
                  <td className="py-2"><span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">Pending</span></td>
                  <td className="py-2 text-right">$89,500</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-2">Global Systems</td>
                  <td className="py-2"><span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Active</span></td>
                  <td className="py-2 text-right">$210,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        );

      default:
        return (
          <div key={widget.id} style={widgetStyle} className="bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center text-gray-400 relative">
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10">
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              {dashEditMode && (
                <button
                  onClick={() => handleDeleteWidget(widget.id)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <div className="text-sm">{widget.type} - Coming Soon</div>
            </div>
          </div>
        );
    }
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updated = dashboards.map(d => 
      d.id === id ? { ...d, isFavorite: !d.isFavorite } : d
    );
    setDashboards(updated);
    localStorage.setItem('dashboards', JSON.stringify(updated));
  };

  const handleDuplicateDashboard = (dashboard: Dashboard) => {
    const today = new Date().toISOString().split('T')[0] || '';
    const newDashboard: Dashboard = {
      ...dashboard,
      id: Date.now().toString(),
      name: `${dashboard.name} (Copy)`,
      createdAt: today,
      lastModifiedAt: today
    };
    
    const updated = [...dashboards, newDashboard];
    setDashboards(updated);
    localStorage.setItem('dashboards', JSON.stringify(updated));
  };

  const filteredDashboards = dashboards
    .filter(dashboard => {
      if (sidebarFilter === 'recent') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return new Date(dashboard.lastModifiedAt) >= weekAgo;
      }
      if (sidebarFilter === 'createdByMe') {
        return dashboard.createdBy === 'Development User';
      }
      if (sidebarFilter === 'favorites') {
        return dashboard.isFavorite;
      }
      return true;
    })
    .filter(dashboard => {
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        dashboard.name.toLowerCase().includes(search) ||
        dashboard.description.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;
      
      const aValue = (a as any)[sortColumn];
      const bValue = (b as any)[sortColumn];
      
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
      
      if (sortColumn === 'lastModifiedAt' || sortColumn === 'createdAt') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr, undefined, { numeric: true })
        : bStr.localeCompare(aStr, undefined, { numeric: true });
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading dashboards...</div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-1 bg-gray-50 h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboards</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Build custom visualizations and track key metrics</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Dashboards</h3>
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setSidebarFilter('recent');
                  setSelectedDashboard(null);
                  setViewMode('list');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'recent' && !selectedDashboard
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4" />
                Recent
              </button>
              <button
                onClick={() => {
                  setSidebarFilter('createdByMe');
                  setSelectedDashboard(null);
                  setViewMode('list');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'createdByMe' && !selectedDashboard
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                Created by Me
              </button>
              <button
                onClick={() => {
                  setSidebarFilter('all');
                  setSelectedDashboard(null);
                  setViewMode('list');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'all' && !selectedDashboard
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                All Dashboards
              </button>
              <button
                onClick={() => {
                  setSidebarFilter('favorites');
                  setSelectedDashboard(null);
                  setViewMode('list');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'favorites' && !selectedDashboard
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
          <h3 className="text-lg font-medium text-gray-900">Dashboard Records</h3>
          <div className="flex gap-3">
            
          </div>
          
          <button
            onClick={() => setShowNewDashboard(true)}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Dashboard
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search dashboards by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Dashboards List/Grid */}
        {viewMode === 'list' ? (
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-2">
                        <span>Dashboard Name</span>
                        {sortColumn === 'name' && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('description')}>
                      <div className="flex items-center gap-2">
                        <span>Description</span>
                        {sortColumn === 'description' && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Widgets</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('lastModifiedAt')}>
                      <div className="flex items-center gap-2">
                        <span>Last Modified</span>
                        {sortColumn === 'lastModifiedAt' && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    <th className="px-6 py-3"></th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDashboards.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center">
                          <LayoutDashboard className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600">No dashboards found</p>
                          <button
                            onClick={() => setShowNewDashboard(true)}
                            className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Create your first dashboard
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredDashboards.map(dashboard => (
                        <tr key={dashboard.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Link 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedDashboard(dashboard);
                                  setViewMode('grid');
                                }}
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                              >
                                {dashboard.name}
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{dashboard.description}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{dashboard.widgets.length}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{dashboard.lastModifiedAt}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedDashboard(dashboard);
                                  setViewMode('grid');
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="View"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedDashboard(dashboard);
                                  setEditMode(true);
                                  setViewMode('grid');
                                }}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDuplicateDashboard(dashboard)}
                                className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Duplicate"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDashboard(dashboard.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleFavorite(dashboard.id)}
                              className={`${dashboard.isFavorite ? 'text-yellow-500' : 'text-gray-400'} hover:text-yellow-500`}
                            >
                              <Star className="w-5 h-5" fill={dashboard.isFavorite ? 'currentColor' : 'none'} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Grid View - Show selected dashboard */
            selectedDashboard ? (
              <div>
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedDashboard.name}</h2>
                    <p className="text-sm text-gray-600">{selectedDashboard.description}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDashEditMode(!dashEditMode)}
                      className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                        dashEditMode 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Settings className="w-5 h-5 mr-2" />
                      {dashEditMode ? 'Done Editing' : 'Edit Dashboard'}
                    </button>
                    {dashEditMode && (
                      <button
                        onClick={() => setShowWidgetSelector(true)}
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Widget
                      </button>
                    )}
                  </div>
                </div>

                {selectedDashboard.widgets.length > 0 ? (
                  <div className="grid grid-cols-9 gap-4 auto-rows-[200px] pb-[600px]">
                    {selectedDashboard.widgets.map(widget => renderWidget(widget))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                    <LayoutDashboard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Widgets Yet</h3>
                    <p className="text-gray-600 mb-4">Add widgets to start building your dashboard</p>
                    <button
                      onClick={() => {
                        setEditMode(true);
                        setShowWidgetSelector(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Add Your First Widget
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <LayoutDashboard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Dashboard</h3>
                <p className="text-gray-600">Choose a dashboard from the list to view it</p>
              </div>
            )
          )}
          </div>
        </div>
      </div>

      {/* New Dashboard Dialog */}
      {showNewDashboard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Dashboard</h2>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleCreateDashboard(
                  formData.get('name') as string,
                  formData.get('description') as string
                );
              }}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dashboard Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Sales Dashboard"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Track sales performance and key metrics"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewDashboard(false)}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Create Dashboard
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Widget Selector Dialog */}
      {showWidgetSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Add Widget</h2>
              <p className="text-sm text-gray-600 mt-1">Choose a visualization type</p>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {WIDGET_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleSelectWidgetType(type.id)}
                  className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  <type.icon className="w-8 h-8 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-900">{type.label}</span>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowWidgetSelector(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Widget Configuration Dialog */}
      {showWidgetConfig && selectedWidgetType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">{editingWidget ? 'Edit' : 'Configure'} {WIDGET_TYPES.find(t => t.id === selectedWidgetType)?.label}</h2>
              <p className="text-sm text-gray-600 mt-1">{editingWidget ? 'Update widget' : 'Set up data source and display'} options</p>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Configuration */}
              <div className="w-1/2 p-6 overflow-y-auto border-r border-gray-200 space-y-6">
              {/* Data Source - Select Report */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Source (Report)</label>
                {availableReports.length > 0 ? (
                  <select
                    value={widgetConfig.reportId}
                    onChange={(e) => {
                      const selectedReport = availableReports.find(r => r.id === e.target.value);
                      setWidgetConfig({ 
                        ...widgetConfig, 
                        reportId: e.target.value,
                        dataSource: selectedReport?.objectType || '',
                        xAxis: '', 
                        yAxis: '' 
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {availableReports.map(report => (
                      <option key={report.id} value={report.id}>
                        {report.name} ({report.objectType})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      No reports available. Please create a report first in the{' '}
                      <Link href="/reports" className="font-medium underline">Reports</Link> page.
                    </p>
                  </div>
                )}
              </div>

              {/* Chart Configuration (only for chart types) */}
              {!['metric', 'table'].includes(selectedWidgetType) && availableReports.length > 0 && (
                <>
                  {/* X-Axis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis</label>
                    <select
                      value={widgetConfig.xAxis}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, xAxis: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select field...</option>
                      {(() => {
                        const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
                        if (selectedReport?.fields && selectedReport.fields.length > 0) {
                          return selectedReport.fields.map((field: string) => (
                            <option key={field} value={field}>{field}</option>
                          ));
                        }
                        // Fallback to utility fields
                        const fields = getAvailableFields(widgetConfig.dataSource);
                        return fields.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Y-Axis */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis</label>
                    <select
                      value={widgetConfig.yAxis}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxis: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select field...</option>
                      {(() => {
                        const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
                        if (selectedReport?.fields && selectedReport.fields.length > 0) {
                          return selectedReport.fields.map((field: string) => (
                            <option key={field} value={field}>{field}</option>
                          ));
                        }
                        // Fallback to utility fields
                        const fields = getAvailableFields(widgetConfig.dataSource);
                        return fields.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Display Units */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Units</label>
                    <select
                      value={widgetConfig.displayUnits}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, displayUnits: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="actual">Actual</option>
                      <option value="shortened">Shortened Number (K, M, B)</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>

                  {/* Show Values */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="showValues"
                      checked={widgetConfig.showValues}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, showValues: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="showValues" className="text-sm font-medium text-gray-700">Show Values on Chart</label>
                  </div>

                  {/* Aggregation Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Aggregation Type</label>
                    <select
                      value={widgetConfig.aggregationType || 'sum'}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, aggregationType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="avg">Average</option>
                      <option value="max">Maximum</option>
                      <option value="min">Minimum</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">How to combine grouped values</p>
                  </div>

                  {/* Sort Legend Values */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort Legend Values</label>
                    <select
                      value={widgetConfig.sortLegend}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, sortLegend: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                      <option value="alphabetical">Alphabetical</option>
                    </select>
                  </div>

                  {/* Y-Axis Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis Range</label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="rangeAutomatic"
                          name="yAxisRange"
                          value="automatic"
                          checked={widgetConfig.yAxisRange === 'automatic'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxisRange: e.target.value })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="rangeAutomatic" className="text-sm text-gray-700">Automatic</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="rangeCustom"
                          name="yAxisRange"
                          value="custom"
                          checked={widgetConfig.yAxisRange === 'custom'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxisRange: e.target.value })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="rangeCustom" className="text-sm text-gray-700">Custom</label>
                      </div>
                      {widgetConfig.yAxisRange === 'custom' && (
                        <div className="grid grid-cols-2 gap-3 ml-7">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Min</label>
                            <input
                              type="number"
                              value={widgetConfig.yAxisMin}
                              onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxisMin: parseFloat(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Max</label>
                            <input
                              type="number"
                              value={widgetConfig.yAxisMax}
                              onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxisMax: parseFloat(e.target.value) })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Decimal Places */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Decimal Places</label>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="decimalAutomatic"
                          name="decimalPlaces"
                          value="automatic"
                          checked={widgetConfig.decimalPlaces === 'automatic'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, decimalPlaces: e.target.value })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="decimalAutomatic" className="text-sm text-gray-700">Automatic</label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          id="decimalCustom"
                          name="decimalPlaces"
                          value="custom"
                          checked={widgetConfig.decimalPlaces === 'custom'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, decimalPlaces: e.target.value })}
                          className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                        />
                        <label htmlFor="decimalCustom" className="text-sm text-gray-700">Custom</label>
                      </div>
                      {widgetConfig.decimalPlaces === 'custom' && (
                        <div className="ml-7">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            value={widgetConfig.customDecimals}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, customDecimals: parseInt(e.target.value) })}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                    <select
                      value={widgetConfig.sortBy}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, sortBy: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">None</option>
                      {availableReports
                        .find(r => r.id === widgetConfig.reportId)
                        ?.fields?.map((field: string) => (
                          <option key={field} value={field}>{field}</option>
                        )) || FIELD_OPTIONS[widgetConfig.dataSource]?.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                    </select>
                  </div>

                  {/* Legend Position */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Legend Position</label>
                    <select
                      value={widgetConfig.legendPosition}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, legendPosition: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="top">Top</option>
                      <option value="right">Right</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </>
              )}

              {/* Title, Subtitle, Footer */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Labels & Text</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input
                      type="text"
                      value={widgetConfig.title}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Widget title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                    <input
                      type="text"
                      value={widgetConfig.subtitle}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Optional subtitle"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Footer</label>
                    <input
                      type="text"
                      value={widgetConfig.footer}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, footer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Optional footer text"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Link</label>
                    <input
                      type="text"
                      value={widgetConfig.customLink}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, customLink: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
              </div>

              {/* Right Panel - Live Preview */}
              <div className="w-1/2 p-6 bg-gray-50 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Live Preview</h3>
                
                {/* Debug Info */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
                  <div><strong>Widget Type:</strong> {selectedWidgetType || 'None'}</div>
                  <div><strong>X-Axis:</strong> {widgetConfig.xAxis || 'Not set'}</div>
                  <div><strong>Y-Axis:</strong> {widgetConfig.yAxis || 'Not set'}</div>
                  <div><strong>Data Points:</strong> {previewData?.data?.length || 0}</div>
                  {previewData?.data && previewData.data.length > 0 && (
                    <div className="mt-2">
                      <strong>Sample Data:</strong>
                      <pre className="mt-1 text-[10px] overflow-auto max-h-20">
                        {JSON.stringify(previewData.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 min-h-[400px]">
                  {selectedWidgetType ? (
                    (() => {
                      const currentPreviewData = previewData || {
                        data: [
                          { label: 'Sample 1', value: 45 },
                          { label: 'Sample 2', value: 62 },
                          { label: 'Sample 3', value: 38 }
                        ]
                      };

                      const previewWidget: DashboardWidget = {
                        id: `preview-${Date.now()}`,
                        type: selectedWidgetType as any,
                        title: widgetConfig.title || `New ${WIDGET_TYPES.find(t => t.id === selectedWidgetType)?.label}`,
                        reportId: widgetConfig.reportId,
                        dataSource: widgetConfig.dataSource,
                        config: { ...widgetConfig, ...currentPreviewData },
                        position: { x: 0, y: 0, w: 4, h: 2 }
                      };

                      console.log('Preview Widget Config:', previewWidget.config);
                      console.log('Preview Data:', currentPreviewData);

                      return renderWidget(previewWidget);
                    })()
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Select a widget type to see preview</p>
                    </div>
                  )}
                </div>
                {!widgetConfig.reportId && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Select a report to see live data preview
                  </p>
                )}
                {widgetConfig.reportId && (!widgetConfig.xAxis || !widgetConfig.yAxis) && !['metric', 'table'].includes(selectedWidgetType) && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Configure <strong>X-Axis: {widgetConfig.xAxis || 'not set'}</strong> and <strong>Y-Axis: {widgetConfig.yAxis || 'not set'}</strong> to see data visualization
                  </p>
                )}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowWidgetConfig(false);
                  setSelectedWidgetType(null);
                  setEditingWidget(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingWidget ? handleUpdateWidget : handleSaveWidget}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {editingWidget ? 'Update Widget' : 'Add Widget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
