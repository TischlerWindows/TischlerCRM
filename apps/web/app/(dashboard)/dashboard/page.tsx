'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  X,
  CreditCard,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  Cell,
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { aggregateChartData, aggregateStackedChartData, getAvailableFields, setCachedRecords, getCachedRecords, stripFieldPrefix, applyWhereFilters } from '@/lib/chart-data-utils';
import type { WhereFilter } from '@/lib/chart-data-utils';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import { cn } from '@/lib/utils';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';
import { useSchemaStore } from '@/lib/schema-store';
import { usePermissions } from '@/lib/permissions-context';
import { AlertCircle } from 'lucide-react';

// ── API shape mappers ────────────────────────────────────────────────────────
function mapDashboardFromApi(d: any): Dashboard {
  const sw = d.sharedWith || {};
  return {
    id: d.id,
    name: d.name,
    description: d.description || '',
    widgets: (d.widgets || []).map((w: any) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      reportId: w.reportId || undefined,
      dataSource: w.dataSource,
      config: w.config || {},
      position: { x: w.positionX ?? 0, y: w.positionY ?? 0, w: w.width ?? 4, h: w.height ?? 2 },
      sectionId: (w.config as any)?.sectionId || undefined,
    })),
    sections: sw.sections || [],
    createdBy: d.createdBy?.name || '',
    createdAt: (d.createdAt || '').split('T')[0],
    lastModifiedAt: (d.updatedAt || '').split('T')[0],
    isFavorite: d.isFavorite,
    backgroundColor: sw.backgroundColor || undefined,
  };
}

function mapDashboardToApi(d: Dashboard) {
  return {
    name: d.name,
    description: d.description || '',
    isFavorite: d.isFavorite || false,
    sections: d.sections || [],
    backgroundColor: d.backgroundColor || '',
    widgets: d.widgets.map(w => ({
      type: w.type,
      title: w.title,
      dataSource: w.dataSource || '',
      reportId: w.reportId || null,
      config: { ...w.config, sectionId: w.sectionId || undefined },
      position: w.position,
    })),
  };
}

async function persistDashboard(dashboard: Dashboard) {
  try {
    await apiClient.updateDashboard(dashboard.id, mapDashboardToApi(dashboard));
  } catch (err) {
    console.error('Failed to persist dashboard:', err);
  }
}

interface DashboardSection {
  id: string;
  title: string;
  subtitle?: string;
  filterButtons?: Array<{ label: string; field: string; value: string }>;
}

interface DashboardWidget {
  id: string;
  type: 'horizontal-bar' | 'vertical-bar' | 'stacked-horizontal-bar' | 'stacked-vertical-bar' | 'line' | 'donut' | 'metric' | 'gauge' | 'funnel' | 'scatter' | 'table' | 'card';
  title: string;
  reportId?: string;
  dataSource: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
  sectionId?: string;
}

interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  sections?: DashboardSection[];
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
  isFavorite?: boolean;
  backgroundColor?: string;
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
  { id: 'table', label: 'Lightning Table', icon: TableIcon },
  { id: 'card', label: 'Card', icon: CreditCard }
];

const OBJECT_TYPES = [
  { value: 'properties', label: 'Properties' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'products', label: 'Products' },
  { value: 'leads', label: 'Leads' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'projects', label: 'Projects' },
  { value: 'services', label: 'Service' },
  { value: 'quotes', label: 'Quotes' },
  { value: 'installations', label: 'Installations' },
];

// Map plural lowercase OBJECT_TYPES values to PascalCase singular API names
const PLURAL_TO_API_NAME: Record<string, string> = {
  properties: 'Property',
  contacts: 'Contact',
  accounts: 'Account',
  products: 'Product',
  leads: 'Lead',
  opportunities: 'Opportunity',
  projects: 'Project',
  services: 'Service',
  quotes: 'Quote',
  installations: 'Installation',
  workorders: 'WorkOrder',
};

const FIELD_OPTIONS: Record<string, string[]> = {
  accounts: ['Name', 'Industry', 'Revenue', 'Employees', 'Status', 'Type', 'Rating'],
  contacts: ['Name', 'Email', 'Phone', 'Title', 'Department', 'Status'],
  opportunities: ['Name', 'Amount', 'Stage', 'Probability', 'Close Date', 'Owner'],
  leads: ['Name', 'Company', 'Status', 'Source', 'Estimated Value', 'Rating'],
  products: ['Name', 'Category', 'Unit Price', 'Stock Quantity', 'Status'],
  properties: ['Address', 'Type', 'Value', 'Size', 'Status', 'Owner'],
  projects: ['Name', 'Status', 'Budget', 'Start Date', 'End Date', 'Progress'],
  quotes: ['Number', 'Total Amount', 'Status', 'Valid Until', 'Customer'],
  installations: ['Site', 'Scheduled Date', 'Status', 'Team Size', 'Completion Date'],
  services: ['Property', 'Service Type', 'Scheduled Date', 'Status', 'Technician'],
};

const defaultTabs = DEFAULT_TAB_ORDER;

export default function DashboardPage() {
  const { hasAppPermission } = usePermissions();
  const pathname = usePathname();
  const { schema } = useSchemaStore();
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
    dataSourceMode: 'report', // 'report' or 'manual'
    reportId: '',
    dataSource: '',
    xAxis: '',
    yAxis: '',
    stackBy: '',
    manualData: [{ label: 'Item 1', value: 45 }, { label: 'Item 2', value: 62 }, { label: 'Item 3', value: 38 }],
    manualStackKeys: ['Series A', 'Series B'],
    manualMetric: { value: 0, prefix: '', suffix: '', trend: 0 },
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
    cardColor: '#1e3a5f',
    widgetBg: '',
    accentColor: '',
    fontColor: '',
    barColors: {} as Record<string, string>,
    hBarLabelPos: 'left',
    hBarValuePos: 'right',
    hiddenUntilFilter: false,
    filterButtons: [] as Array<{ label: string; field: string; value: string }>,
    whereFilters: [] as WhereFilter[],
    title: '',
    subtitle: '',
    footer: '',
    legendPosition: 'right'
  });
  const [dashEditMode, setDashEditMode] = useState(false);
  const [editingWidget, setEditingWidget] = useState<string | null>(null);
  const [refreshingWidgetId, setRefreshingWidgetId] = useState<string | null>(null);
  const [drillDownWidgetId, setDrillDownWidgetId] = useState<string | null>(null);
  const [drillDownLabel, setDrillDownLabel] = useState<string | null>(null);
  const [activeFilterButtons, setActiveFilterButtons] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [previewKey, setPreviewKey] = useState(0);
  const [resizingWidget, setResizingWidget] = useState<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const lastResizePos = useRef<{ w: number; h: number } | null>(null);
  const resizeRaf = useRef<number | null>(null);
  const [showAddSection, setShowAddSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [draggingWidgetId, setDraggingWidgetId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ sectionId: string | undefined; beforeWidgetId: string | null } | null>(null);
  const [pendingAddSectionId, setPendingAddSectionId] = useState<string | null>(null);
  const [addingFilterBtnSectionId, setAddingFilterBtnSectionId] = useState<string | null>(null);
  const [newFilterBtn, setNewFilterBtn] = useState({ label: '', field: '', value: '', objectType: '' });
  const [colorPickerBarIdx, setColorPickerBarIdx] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
        if (savedTabs) {
          setTabs(savedTabs);
        } else {
          setTabs(defaultTabs);
        }
      } catch (e) {
        setTabs(defaultTabs);
      }

      // Load available objects from schema store
      if (schema?.objects) {
        const builtInRoutes: Record<string, string> = {
          'Property': '/properties',
          'Contact': '/contacts',
          'Account': '/accounts',
          'Product': '/products',
          'Lead': '/leads',
          'Opportunity': '/opportunities',
          'Project': '/projects',
          'Service': '/service',
          'Quote': '/quotes',
          'Installation': '/installations',
        };
        const excludedObjects = new Set(['Home', 'TeamMember']);
        const objectTabs = schema.objects
          .filter(obj => !excludedObjects.has(obj.apiName))
          .map(obj => ({
            name: obj.pluralLabel || obj.label,
            href: builtInRoutes[obj.apiName] || `/objects/${obj.apiName.toLowerCase()}`
          }));
        setAvailableObjects(objectTabs);
      }

      setIsLoaded(true);
    })();
  }, [schema]);

  // Generate preview data based on widget config
  const previewData = useMemo(() => {
    if (!selectedWidgetType) return null;

    // --- Manual data mode: use user-entered data directly ---
    if (widgetConfig.dataSourceMode === 'manual') {
      if (selectedWidgetType === 'metric' || selectedWidgetType === 'card') {
        const m = widgetConfig.manualMetric || {};
        return {
          value: m.value ?? 0,
          prefix: m.prefix || '',
          suffix: m.suffix || '',
          trend: m.trend || 0,
          data: (widgetConfig.manualData || []).map((d: any) => ({ label: d.label || '', value: Number(d.value) || 0, ...(d.color ? { color: d.color } : {}) }))
        };
      }
      if (selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') {
        const keys: string[] = widgetConfig.manualStackKeys || [];
        const rows: any[] = (widgetConfig.manualData || []).map((row: any) => {
          const point: any = { label: row.label || '' };
          keys.forEach((k: string) => { point[k] = Number(row[k]) || 0; });
          return point;
        });
        return { data: rows, stackKeys: keys };
      }
      // bar, line, donut, etc.
      const data = (widgetConfig.manualData || []).map((d: any) => ({
        label: d.label || '',
        value: Number(d.value) || 0,
        ...(d.color ? { color: d.color } : {})
      }));
      return { data };
    }

    // --- From Object mode: aggregate directly from cached records ---
    if (widgetConfig.dataSourceMode === 'object') {
      const objType = widgetConfig.dataSource || '';
      if (!objType) return { data: [{ label: 'Select an object type', value: 30 }, { label: 'to see preview', value: 20 }] };
      const activeFilters: WhereFilter[] = (widgetConfig.whereFilters || []).filter((f: WhereFilter) => f.field && f.operator);

      // Metric/card: return record count or sum of a field
      if (selectedWidgetType === 'metric' || selectedWidgetType === 'card') {
        const allRecords = getCachedRecords(objType);
        const records = applyWhereFilters(allRecords, activeFilters);
        if (widgetConfig.yAxis) {
          const field = stripFieldPrefix(widgetConfig.yAxis);
          const total = records.reduce((sum: number, r: any) => sum + (Number(r[field]) || 0), 0);
          return { value: total, prefix: '', suffix: '', trend: 0, data: records.map((r: any) => ({ label: String(r[field] || r.name || r.id || ''), value: Number(r[field]) || 0 })) };
        }
        return { value: records.length, prefix: '', suffix: '', trend: 0, data: records.slice(0, 50).map((r: any) => ({ label: r.name || r.id || '', value: 1 })) };
      }

      if (!widgetConfig.xAxis || !widgetConfig.yAxis) {
        return { data: [{ label: 'Configure X & Y Axis', value: 30 }, { label: 'to see preview', value: 20 }] };
      }

      // Stacked charts
      if ((selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') && widgetConfig.stackBy) {
        try {
          const { data, stackKeys } = aggregateStackedChartData({
            objectType: objType,
            xAxisField: widgetConfig.xAxis,
            yAxisField: widgetConfig.yAxis,
            stackByField: widgetConfig.stackBy,
            aggregationType: widgetConfig.aggregationType || 'sum',
            whereFilters: activeFilters,
          });
          return data && data.length > 0 ? { data, stackKeys } : { data: [], stackKeys: [] };
        } catch { return { data: [], stackKeys: [] }; }
      }

      // Bar, line, donut
      try {
        const aggregatedData = aggregateChartData({
          objectType: objType,
          xAxisField: widgetConfig.xAxis,
          yAxisField: widgetConfig.yAxis,
          aggregationType: widgetConfig.aggregationType || 'sum',
          whereFilters: activeFilters,
        });
        return aggregatedData && aggregatedData.length > 0 ? { data: aggregatedData } : { data: [] };
      } catch { return { data: [] }; }
    }

    // --- Report mode: aggregate from cached records ---
    const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
    const effectiveObjectType = selectedReport?.objectType || '';

    // For stacked bar charts with real data
    if ((selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') && widgetConfig.reportId && widgetConfig.xAxis && widgetConfig.yAxis && widgetConfig.stackBy) {
      if (effectiveObjectType) {
        try {
          const { data, stackKeys } = aggregateStackedChartData({
            objectType: effectiveObjectType,
            xAxisField: widgetConfig.xAxis,
            yAxisField: widgetConfig.yAxis,
            stackByField: widgetConfig.stackBy,
            aggregationType: widgetConfig.aggregationType || 'sum'
          });
          return data && data.length > 0 ? { data, stackKeys } : { data: [], stackKeys: [] };
        } catch (error) {
          console.error('❌ Error aggregating stacked data:', error);
          return { data: [], stackKeys: [] };
        }
      }
    }
    
    // For line charts with real data
    if (selectedWidgetType === 'line' && widgetConfig.reportId && widgetConfig.xAxis && widgetConfig.yAxis) {
      if (effectiveObjectType) {
        try {
          const aggregatedData = aggregateChartData({
            objectType: effectiveObjectType,
            xAxisField: widgetConfig.xAxis,
            yAxisField: widgetConfig.yAxis,
            aggregationType: widgetConfig.aggregationType || 'sum'
          });
          return aggregatedData && aggregatedData.length > 0 ? { data: aggregatedData } : { data: [] };
        } catch (error) {
          console.error('❌ Error aggregating line data:', error);
          return { data: [] };
        }
      }
    }

    // For bar charts with real data
    if ((selectedWidgetType === 'vertical-bar' || selectedWidgetType === 'horizontal-bar') && widgetConfig.reportId && widgetConfig.xAxis && widgetConfig.yAxis) {
      if (effectiveObjectType) {
        try {
          const aggregatedData = aggregateChartData({
            objectType: effectiveObjectType,
            xAxisField: widgetConfig.xAxis,
            yAxisField: widgetConfig.yAxis,
            aggregationType: widgetConfig.aggregationType || 'sum'
          });
          return aggregatedData && aggregatedData.length > 0 ? { data: aggregatedData } : { data: [] };
        } catch (error) {
          console.error('❌ Error aggregating data:', error);
          return { data: [] };
        }
      }
    } else if (widgetConfig.reportId && (!widgetConfig.xAxis || !widgetConfig.yAxis)) {
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
      } else if (selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') {
        return {
          data: [
            { label: 'Q1', 'Series A': 30, 'Series B': 45, 'Series C': 25 },
            { label: 'Q2', 'Series A': 40, 'Series B': 35, 'Series C': 30 },
            { label: 'Q3', 'Series A': 35, 'Series B': 50, 'Series C': 20 },
            { label: 'Q4', 'Series A': 45, 'Series B': 40, 'Series C': 35 }
          ],
          stackKeys: ['Series A', 'Series B', 'Series C']
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
  }, [selectedWidgetType, widgetConfig, availableReports]);

  const handleResizeStart = (e: React.MouseEvent, widget: DashboardWidget) => {
    if (!dashEditMode) return;
    e.preventDefault();
    e.stopPropagation();
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
    lastResizePos.current = { w: resizingWidget.startW, h: resizingWidget.startH };

    const handleMouseMove = (e: MouseEvent) => {
      if (!selectedDashboard) return;
      if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);

      resizeRaf.current = requestAnimationFrame(() => {
        const deltaX = (e.clientX - resizingWidget.startX) / 100;
        const deltaY = (e.clientY - resizingWidget.startY) / 200;

        const minW = 2;
        const newW = Math.max(minW, Math.min(9, Math.round(resizingWidget.startW + deltaX)));
        const newH = Math.max(1, Math.round(resizingWidget.startH + deltaY));

        // Only update state when grid position actually changes
        if (lastResizePos.current && newW === lastResizePos.current.w && newH === lastResizePos.current.h) return;
        lastResizePos.current = { w: newW, h: newH };

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
      });
    };

    const handleMouseUp = () => {
      if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
      resizeRaf.current = null;
      lastResizePos.current = null;
      setResizingWidget(null);
      if (selectedDashboard) {
        persistDashboard(selectedDashboard);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
    };
  }, [resizingWidget, selectedDashboard, dashboards]);

  useEffect(() => {
    (async () => {
      // Load saved reports for widget data sources
      try {
        const reports = await getSetting<any[]>('customReports');
        setAvailableReports(reports || []);
      } catch (e) {
        console.error('Error loading reports:', e);
        setAvailableReports([]);
      }

      // Load dashboards from API
      try {
        const apiDashboards = await apiClient.getDashboards();
        if (apiDashboards && apiDashboards.length > 0) {
          const mapped = apiDashboards.map(mapDashboardFromApi);
          setDashboards(mapped);
          setSelectedDashboard(mapped[0]);
        } else {
          // Create a default dashboard via API
          const defaultPayload = {
            name: 'Sales Overview',
            description: 'Key sales metrics and performance indicators',
            sections: [
              { id: 's1', title: 'Key Metrics' },
              { id: 's2', title: 'Sales Pipeline' },
              { id: 's3', title: 'Trends' }
            ],
            widgets: [
              { type: 'metric', title: 'Total Opportunities', dataSource: 'opportunities', config: { dataSourceMode: 'object', yAxis: '', aggregationType: 'count', value: 0, prefix: '', suffix: '', trend: 0, sectionId: 's1' }, position: { x: 0, y: 0, w: 3, h: 1 } },
              { type: 'metric', title: 'Total Leads', dataSource: 'leads', config: { dataSourceMode: 'object', yAxis: '', aggregationType: 'count', value: 0, prefix: '', suffix: '', trend: 0, sectionId: 's1' }, position: { x: 3, y: 0, w: 3, h: 1 } },
              { type: 'metric', title: 'Total Properties', dataSource: 'properties', config: { dataSourceMode: 'object', yAxis: '', aggregationType: 'count', value: 0, prefix: '', suffix: '', trend: 0, sectionId: 's1' }, position: { x: 6, y: 0, w: 3, h: 1 } },
            ],
          };
          const created = await apiClient.createDashboard(defaultPayload);
          const mapped = mapDashboardFromApi(created);
          setDashboards([mapped]);
          setSelectedDashboard(mapped);
        }
      } catch (err) {
        console.error('Error loading dashboards from API:', err);
        // Fallback: try legacy settings
        try {
          const savedDashboards = await getSetting<any[]>('dashboards');
          if (savedDashboards && savedDashboards.length > 0) {
            setDashboards(savedDashboards);
            setSelectedDashboard(savedDashboards[0]);
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
  }, []);

  // Load records from API into chart data cache for all report object types
  useEffect(() => {
    if (availableReports.length === 0) return;
    const objectTypes = Array.from(new Set(availableReports.map((r: any) => r.objectType).filter(Boolean)));
    objectTypes.forEach(async (objectType) => {
      try {
        const records = await recordsService.getRecords(objectType);
        const flatRecords = recordsService.flattenRecords(records);
        setCachedRecords(objectType, flatRecords);
      } catch (e) {
        console.error(`Failed to load records for ${objectType}:`, e);
      }
    });
  }, [availableReports]);

  // Load records into cache when user picks an object type in "From Object" mode
  useEffect(() => {
    if (widgetConfig.dataSourceMode !== 'object' || !widgetConfig.dataSource) return;
    const objType = widgetConfig.dataSource;
    const apiName = PLURAL_TO_API_NAME[objType] || objType;
    // Skip if already cached
    if (getCachedRecords(objType).length > 0) return;
    (async () => {
      try {
        const records = await recordsService.getRecords(apiName);
        const flat = recordsService.flattenRecords(records);
        setCachedRecords(objType, flat);
      } catch (e) {
        console.error(`Failed to load records for ${objType}:`, e);
      }
    })();
  }, [widgetConfig.dataSourceMode, widgetConfig.dataSource]);

  // Load records into cache when user picks an object type in the filter button form
  useEffect(() => {
    if (!newFilterBtn.objectType) return;
    if (getCachedRecords(newFilterBtn.objectType).length > 0) return;
    const apiName = PLURAL_TO_API_NAME[newFilterBtn.objectType] || newFilterBtn.objectType;
    (async () => {
      try {
        const records = await recordsService.getRecords(apiName);
        const flat = recordsService.flattenRecords(records);
        setCachedRecords(newFilterBtn.objectType, flat);
      } catch (e) {
        console.error(`Failed to load records for ${apiName}:`, e);
      }
    })();
  }, [newFilterBtn.objectType]);

  // Auto-refresh all object-mode widgets when the selected dashboard changes
  useEffect(() => {
    if (!selectedDashboard || selectedDashboard.widgets.length === 0) return;
    const objectWidgets = selectedDashboard.widgets.filter(
      w => w.config?.dataSourceMode === 'object' && w.dataSource
    );
    if (objectWidgets.length === 0) return;

    // Collect unique object types needed
    const objectTypes = Array.from(new Set(objectWidgets.map(w => w.dataSource).filter(Boolean)));

    (async () => {
      // Fetch records for all needed object types
      for (const objType of objectTypes) {
        const apiName = PLURAL_TO_API_NAME[objType] || objType;
        try {
          const records = await recordsService.getRecords(apiName);
          const flat = recordsService.flattenRecords(records);
          setCachedRecords(objType, flat);
        } catch (e) {
          console.error(`Failed to load records for ${objType}:`, e);
        }
      }

      // Now re-aggregate each widget's data
      let updatedWidgets = [...selectedDashboard.widgets];
      let changed = false;

      for (const widget of objectWidgets) {
        const objType = widget.dataSource;
        const allRecords = getCachedRecords(objType);
        const wFilters: WhereFilter[] = (widget.config?.whereFilters || []).filter((f: WhereFilter) => f.field && f.operator);
        const records = applyWhereFilters(allRecords, wFilters);
        const isMetricWidget = widget.type === 'metric' || widget.type === 'card';
        const xField = widget.config?.xAxis;
        const yField = widget.config?.yAxis;

        if (isMetricWidget) {
          // Metric: record count or field sum
          let value = records.length;
          if (yField) {
            const field = stripFieldPrefix(yField);
            value = records.reduce((sum: number, r: any) => sum + (Number(r[field]) || 0), 0);
          }
          updatedWidgets = updatedWidgets.map(w =>
            w.id === widget.id ? { ...w, config: { ...w.config, value } } : w
          );
          changed = true;
        } else if (xField) {
          // Chart widgets — yField can be empty for count aggregation
          const effectiveYField = yField || xField;
          const stackByField = widget.config?.stackBy;
          if (stackByField && (widget.type === 'stacked-horizontal-bar' || widget.type === 'stacked-vertical-bar')) {
            try {
              const { data, stackKeys } = aggregateStackedChartData({
                objectType: objType,
                xAxisField: xField,
                yAxisField: effectiveYField,
                stackByField,
                aggregationType: widget.config?.aggregationType || 'sum',
                whereFilters: wFilters,
              });
              if (data && data.length > 0) {
                updatedWidgets = updatedWidgets.map(w =>
                  w.id === widget.id ? { ...w, config: { ...w.config, data, stackKeys } } : w
                );
                changed = true;
              }
            } catch { /* skip */ }
          } else {
            try {
              const aggregatedData = aggregateChartData({
                objectType: objType,
                xAxisField: xField,
                yAxisField: effectiveYField,
                aggregationType: widget.config?.aggregationType || 'sum',
                whereFilters: wFilters,
              });
              if (aggregatedData && aggregatedData.length > 0) {
                updatedWidgets = updatedWidgets.map(w =>
                  w.id === widget.id ? { ...w, config: { ...w.config, data: aggregatedData } } : w
                );
                changed = true;
              }
            } catch { /* skip */ }
          }
        }
      }

      if (changed) {
        const updatedDashboard = {
          ...selectedDashboard,
          widgets: updatedWidgets
        };
        setSelectedDashboard(updatedDashboard);
        setDashboards(prev => prev.map(d => d.id === updatedDashboard.id ? updatedDashboard : d));
        persistDashboard(updatedDashboard);
      }
    })();
  }, [selectedDashboard?.id]); // Only re-run when switching dashboards

  const handleCreateDashboard = async (name: string, description: string) => {
    try {
      const created = await apiClient.createDashboard({ name, description, widgets: [] });
      const mapped = mapDashboardFromApi(created);
      setDashboards(prev => [...prev, mapped]);
      setSelectedDashboard(mapped);
    } catch (err) {
      console.error('Failed to create dashboard:', err);
    }
    setShowNewDashboard(false);
  };

  const handleDeleteDashboard = async (id: string) => {
    if (confirm('Are you sure you want to delete this dashboard?')) {
      try {
        await apiClient.deleteDashboard(id);
      } catch (err) {
        console.error('Failed to delete dashboard:', err);
      }
      const updated = dashboards.filter(d => d.id !== id);
      setDashboards(updated);
      if (selectedDashboard?.id === id) {
        setSelectedDashboard(updated[0] || null);
      }
    }
  };

  const handleSelectWidgetType = async (type: string) => {
    // Reload reports to ensure we have the latest
    let reports: any[] = [];
    try {
      reports = (await getSetting<any[]>('customReports')) || [];
      setAvailableReports(reports);
    } catch (e) {
      console.error('Error loading reports:', e);
    }

    setSelectedWidgetType(type);
    const isStacked = type === 'stacked-horizontal-bar' || type === 'stacked-vertical-bar';
    const firstSectionId = pendingAddSectionId || (selectedDashboard?.sections || [])[0]?.id || '';
    setWidgetConfig({
      dataSourceMode: 'object',
      reportId: reports.length > 0 ? reports[0].id : '',
      dataSource: reports.length > 0 ? reports[0].objectType : '',
      xAxis: '',
      yAxis: '',
      stackBy: '',
      manualData: isStacked
        ? [{ label: 'Category 1', 'Series A': 30, 'Series B': 45 }, { label: 'Category 2', 'Series A': 40, 'Series B': 35 }, { label: 'Category 3', 'Series A': 25, 'Series B': 50 }]
        : (type === 'metric' || type === 'card')
          ? [{ label: 'Active', value: 24 }, { label: 'Pending', value: 12 }, { label: 'Closed', value: 8 }]
          : [{ label: 'Item 1', value: 45 }, { label: 'Item 2', value: 62 }, { label: 'Item 3', value: 38 }],
      manualStackKeys: isStacked ? ['Series A', 'Series B'] : [],
      manualMetric: (type === 'metric' || type === 'card') ? { value: 44, prefix: '', suffix: '', trend: 12 } : { value: 0, prefix: '', suffix: '', trend: 0 },
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
      cardColor: '#1e3a5f',
      filterButtons: [],
      title: `New ${WIDGET_TYPES.find(t => t.id === type)?.label}`,
      subtitle: '',
      footer: '',
      legendPosition: 'right',
      sectionId: firstSectionId
    });
    setShowWidgetSelector(false);
    setShowWidgetConfig(true);
    setPendingAddSectionId(null);
  };

  const handleSaveWidget = () => {
    if (!selectedDashboard || !selectedWidgetType) return;

    // Ensure at least one section exists
    let sections = selectedDashboard.sections || [];
    if (sections.length === 0) {
      sections = [{ id: `s${Date.now()}`, title: 'General' }];
    }
    const targetSectionId = widgetConfig.sectionId || sections[0].id;

    // Move filter buttons to the section
    const filterButtons = widgetConfig.filterButtons || [];
    if (filterButtons.length > 0) {
      sections = sections.map(s => {
        if (s.id !== targetSectionId) return s;
        const existing = s.filterButtons || [];
        const merged = [...existing];
        for (const btn of filterButtons) {
          if (!merged.some(b => b.label === btn.label)) merged.push(btn);
        }
        return { ...s, filterButtons: merged };
      });
    }

    // Use the real previewData that was computed with actual aggregation
    let configData: any = { ...widgetConfig, filterButtons: [] };
    if (previewData) {
      if (previewData.data) {
        configData.data = previewData.data;
      }
      if (previewData.stackKeys) {
        configData.stackKeys = previewData.stackKeys;
      }
      if (previewData.value !== undefined) {
        configData.value = previewData.value;
        configData.prefix = previewData.prefix || '$';
        configData.suffix = previewData.suffix || '';
        configData.trend = previewData.trend || 0;
      }
    }

    const defaultSize = (selectedWidgetType === 'card' || selectedWidgetType === 'metric')
      ? { x: 0, y: 0, w: 3, h: 1 }
      : { x: 0, y: 0, w: 4, h: 2 };

    const newWidget: DashboardWidget = {
      id: `w${Date.now()}`,
      type: selectedWidgetType as any,
      title: widgetConfig.title,
      reportId: widgetConfig.reportId,
      dataSource: widgetConfig.dataSource,
      config: configData,
      position: defaultSize,
      sectionId: targetSectionId
    };

    const updatedDashboard = {
      ...selectedDashboard,
      sections,
      widgets: [...selectedDashboard.widgets, newWidget],
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };

    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
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
    persistDashboard(updatedDashboard);
  };

  // ── Section CRUD ─────────────────────────────────────────────────────
  const handleAddSection = (title: string) => {
    if (!selectedDashboard) return;
    const newSection: DashboardSection = { id: `s${Date.now()}`, title };
    const updatedDashboard = {
      ...selectedDashboard,
      sections: [...(selectedDashboard.sections || []), newSection],
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
    setShowAddSection(false);
  };

  const handleDeleteSection = (sectionId: string) => {
    if (!selectedDashboard) return;
    // Unassign widgets in this section
    const updatedDashboard = {
      ...selectedDashboard,
      sections: (selectedDashboard.sections || []).filter(s => s.id !== sectionId),
      widgets: selectedDashboard.widgets.map(w =>
        w.sectionId === sectionId ? { ...w, sectionId: undefined } : w
      ),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
  };

  const handleRenameSection = (sectionId: string, newTitle: string) => {
    if (!selectedDashboard) return;
    const updatedDashboard = {
      ...selectedDashboard,
      sections: (selectedDashboard.sections || []).map(s =>
        s.id === sectionId ? { ...s, title: newTitle } : s
      ),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
    setEditingSectionId(null);
  };

  const handleMoveSection = (sectionId: string, direction: 'up' | 'down') => {
    if (!selectedDashboard) return;
    const sections = [...(selectedDashboard.sections || [])];
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sections.length) return;
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    const updatedDashboard = {
      ...selectedDashboard,
      sections,
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
  };

  const handleMoveWidgetToSection = (widgetId: string, sectionId: string | undefined) => {
    if (!selectedDashboard) return;
    const updatedDashboard = {
      ...selectedDashboard,
      widgets: selectedDashboard.widgets.map(w =>
        w.id === widgetId ? { ...w, sectionId } : w
      ),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
  };

  const handleRefreshWidget = async (widget: DashboardWidget) => {
    if (!selectedDashboard) return;

    // Manual mode widgets use static data — nothing to refresh from server
    if (widget.config?.dataSourceMode === 'manual') {
      setRefreshingWidgetId(widget.id);
      setTimeout(() => setRefreshingWidgetId(null), 300);
      return;
    }

    // Show loading overlay
    setRefreshingWidgetId(widget.id);

    const report = widget.reportId ? availableReports.find(r => r.id === widget.reportId) : null;
    const objectType = widget.config?.dataSourceMode === 'object'
      ? widget.dataSource
      : report?.objectType;
    if (!objectType) {
      console.warn('No object type found for widget refresh');
      setRefreshingWidgetId(null);
      return;
    }

    const xField = widget.config?.xAxis;
    const yField = widget.config?.yAxis;
    const stackByField = widget.config?.stackBy;
    const isMetric = widget.type === 'metric' || widget.type === 'card';
    const isCount = widget.config?.aggregationType === 'count';

    // Metrics/counts just need objectType; charts need xAxis + yAxis
    if (!isMetric && !isCount && (!xField || !yField)) {
      console.warn('Widget missing configuration for refresh');
      setRefreshingWidgetId(null);
      return;
    }

    try {
      // Re-fetch records for this object type
      const apiName = PLURAL_TO_API_NAME[objectType] || objectType;
      const records = await recordsService.getRecords(apiName);
      const flatRecords = recordsService.flattenRecords(records);
      setCachedRecords(objectType, flatRecords);

      const wFilters: WhereFilter[] = (widget.config?.whereFilters || []).filter((f: WhereFilter) => f.field && f.operator);

      // Metric/card widgets: compute value from record count or field sum
      if (isMetric) {
        const filteredRecords = applyWhereFilters(flatRecords, wFilters);
        let value = filteredRecords.length;
        if (yField) {
          const field = stripFieldPrefix(yField);
          value = filteredRecords.reduce((sum: number, r: any) => sum + (Number(r[field]) || 0), 0);
        }
        const updatedWidgets = selectedDashboard.widgets.map(w =>
          w.id === widget.id
            ? { ...w, config: { ...w.config, value, data: flatRecords.slice(0, 50).map((r: any) => ({ label: r.name || r.id || '', value: 1 })) } }
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
        persistDashboard(updatedDashboard);
        setTimeout(() => setRefreshingWidgetId(null), 400);
        return;
      }

      // Check if this is a stacked chart
      if (stackByField && (widget.type === 'stacked-horizontal-bar' || widget.type === 'stacked-vertical-bar')) {
        // Use stacked aggregation
        const { data, stackKeys } = aggregateStackedChartData({
          objectType,
          xAxisField: xField,
          yAxisField: yField,
          stackByField: stackByField,
          aggregationType: widget.config?.aggregationType || 'sum',
          whereFilters: wFilters,
        });

        if (!data || data.length === 0) {
          console.warn('No data available after refresh');
          setRefreshingWidgetId(null);
          return;
        }

        // Update the widget with fresh stacked data
        const updatedWidgets = selectedDashboard.widgets.map(w => 
          w.id === widget.id 
            ? { ...w, config: { ...w.config, data, stackKeys } }
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
        persistDashboard(updatedDashboard);

      } else {
        // Use regular aggregation for non-stacked charts
        const aggregatedData = aggregateChartData({
          objectType,
          xAxisField: xField,
          yAxisField: yField,
          aggregationType: widget.config?.aggregationType || 'sum',
          whereFilters: wFilters,
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
        persistDashboard(updatedDashboard);

      }
      
      // Hide loading overlay after a brief moment
      setTimeout(() => {
        setRefreshingWidgetId(null);
      }, 400);
    } catch (error) {
      console.error('❌ Error refreshing widget:', error);
      setRefreshingWidgetId(null);
    }
  };

  const handleEditWidget = async (widget: DashboardWidget) => {
    if (!widget) return;
    
    const mode = widget.config?.dataSourceMode || (widget.reportId ? 'report' : 'manual');
    
    setEditingWidget(widget.id);
    setSelectedWidgetType(widget.type);
    setWidgetConfig({
      dataSourceMode: mode,
      reportId: widget.reportId || '',
      dataSource: widget.dataSource,
      xAxis: widget.config?.xAxis || '',
      yAxis: widget.config?.yAxis || '',
      stackBy: widget.config?.stackBy || '',
      manualData: widget.config?.manualData || widget.config?.data || [],
      manualStackKeys: widget.config?.manualStackKeys || widget.config?.stackKeys || [],
      manualMetric: widget.config?.manualMetric || { value: widget.config?.value || 0, prefix: widget.config?.prefix || '', suffix: widget.config?.suffix || '', trend: widget.config?.trend || 0 },
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
      cardColor: widget.config?.cardColor || '#1e3a5f',
      widgetBg: widget.config?.widgetBg || '',
      accentColor: widget.config?.accentColor || '',
      fontColor: widget.config?.fontColor || '',
      barColors: widget.config?.barColors || {},
      hBarLabelPos: widget.config?.hBarLabelPos || 'left',
      hBarValuePos: widget.config?.hBarValuePos || 'right',
      hiddenUntilFilter: widget.config?.hiddenUntilFilter || false,
      filterButtons: (() => {
        // Load filter buttons from the section (not the widget)
        const sId = widget.sectionId;
        const sec = sId ? (selectedDashboard?.sections || []).find(s => s.id === sId) : null;
        return sec?.filterButtons || widget.config?.filterButtons || [];
      })(),
      whereFilters: widget.config?.whereFilters || [],
      title: widget.title || '',
      subtitle: widget.config?.subtitle || '',
      footer: widget.config?.footer || '',
      legendPosition: widget.config?.legendPosition || 'right',
      sectionId: widget.sectionId || ''
    });
    setShowWidgetConfig(true);
  };

  const handleUpdateWidget = () => {
    if (!selectedDashboard || !editingWidget || !selectedWidgetType) return;

    // Get the existing widget to preserve its position
    const existingWidget = selectedDashboard.widgets.find(w => w.id === editingWidget);
    const targetSectionId = widgetConfig.sectionId || existingWidget?.sectionId || (selectedDashboard.sections || [])[0]?.id;

    // Move filter buttons to the section
    let sections = [...(selectedDashboard.sections || [])];
    const filterButtons = widgetConfig.filterButtons || [];
    if (filterButtons.length > 0 && targetSectionId) {
      sections = sections.map(s => {
        if (s.id !== targetSectionId) return s;
        const existing = s.filterButtons || [];
        const merged = [...existing];
        for (const btn of filterButtons) {
          if (!merged.some(b => b.label === btn.label)) merged.push(btn);
        }
        return { ...s, filterButtons: merged };
      });
    }

    // Use the real previewData that was computed with actual aggregation
    let configData: any = { ...widgetConfig, filterButtons: [] };
    if (previewData) {
      if (previewData.data) {
        configData.data = previewData.data;
      }
      if (previewData.stackKeys) {
        configData.stackKeys = previewData.stackKeys;
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
      position: existingWidget?.position || { x: 0, y: 0, w: 4, h: 2 },
      sectionId: widgetConfig.sectionId || (selectedDashboard.sections || [])[0]?.id || undefined
    };

    const updatedDashboard = {
      ...selectedDashboard,
      sections,
      widgets: selectedDashboard.widgets.map(w => w.id === editingWidget ? updatedWidget : w),
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };

    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
    setShowWidgetConfig(false);
    setSelectedWidgetType(null);
    setEditingWidget(null);
  };

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    setSetting('tabConfiguration', newTabs);
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

  // ── Widget drag-and-drop ─────────────────────────────────────────────
  const handleWidgetDragStart = (e: React.DragEvent, widgetId: string) => {
    setDraggingWidgetId(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    // Make the drag image slightly transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleWidgetDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggingWidgetId(null);
    setDropTarget(null);
  };

  const handleWidgetDrop = (targetSectionId: string | undefined, beforeWidgetId: string | null) => {
    if (!selectedDashboard || !draggingWidgetId) return;

    const widgets = [...selectedDashboard.widgets];
    const dragIdx = widgets.findIndex(w => w.id === draggingWidgetId);
    if (dragIdx < 0) return;

    // Remove from old position
    const [draggedWidget] = widgets.splice(dragIdx, 1);
    // Update section
    draggedWidget.sectionId = targetSectionId;

    if (beforeWidgetId) {
      // Insert before the target widget
      const targetIdx = widgets.findIndex(w => w.id === beforeWidgetId);
      if (targetIdx >= 0) {
        widgets.splice(targetIdx, 0, draggedWidget);
      } else {
        widgets.push(draggedWidget);
      }
    } else {
      // Append to end of section — find last widget in this section and insert after it
      const sectionIds = new Set((selectedDashboard.sections || []).map(s => s.id));
      let insertIdx = widgets.length;
      for (let i = widgets.length - 1; i >= 0; i--) {
        const wSection = widgets[i].sectionId;
        const wInTarget = targetSectionId
          ? wSection === targetSectionId
          : (!wSection || !sectionIds.has(wSection));
        if (wInTarget) {
          insertIdx = i + 1;
          break;
        }
      }
      widgets.splice(insertIdx, 0, draggedWidget);
    }

    const updatedDashboard = {
      ...selectedDashboard,
      widgets,
      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
    };
    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
    setDashboards(updated);
    setSelectedDashboard(updatedDashboard);
    persistDashboard(updatedDashboard);
    setDraggingWidgetId(null);
    setDropTarget(null);
  };

  // --- Drill-down helpers ---
  const handleChartDrillDown = (widget: DashboardWidget, label: string, barIndex?: number) => {
    // In preview mode, open color picker instead of drill-down
    if (widget.id.startsWith('preview-')) {
      setColorPickerBarIdx(barIndex ?? null);
      return;
    }
    if (drillDownWidgetId === widget.id && drillDownLabel === label) {
      setDrillDownWidgetId(null);
      setDrillDownLabel(null);
    } else {
      setDrillDownWidgetId(widget.id);
      setDrillDownLabel(label);
    }
  };

  const closeDrillDown = () => {
    setDrillDownWidgetId(null);
    setDrillDownLabel(null);
  };

  const getDrillDownRecords = (widget: DashboardWidget, label: string): any[] => {
    if (widget.config?.dataSourceMode === 'report' && widget.reportId) {
      const report = availableReports.find((r: any) => r.id === widget.reportId);
      if (!report) return [];
      const records = getCachedRecords(report.objectType);
      const xAxisField = widget.config.xAxis || '';
      const xField = stripFieldPrefix(xAxisField);
      return records.filter((r: any) => {
        let val = r[xAxisField] || r[xField];
        if (val === null || val === undefined || val === '') val = 'Unspecified';
        else val = String(val).substring(0, 50);
        return val === label;
      });
    }
    // Manual data — return matching entries
    const data = widget.config?.data || widget.config?.manualData || [];
    return data.filter((d: any) => d.label === label);
  };

  const renderWidget = (widget: DashboardWidget, overrideStyle?: React.CSSProperties, sectionFilter?: { field: string; value: string } | null) => {
    // Apply section-level filter to widget data
    if (sectionFilter && sectionFilter.field && sectionFilter.value) {
      const originalData = widget.config?.data || [];
      const filterVal = sectionFilter.value.toLowerCase();
      const isChartType = ['vertical-bar', 'horizontal-bar', 'line', 'donut', 'stacked-horizontal-bar', 'stacked-vertical-bar'].includes(widget.type);
      const xAxis = widget.config?.xAxis || '';
      // For chart widgets whose X-axis matches the filter field, the aggregated
      // data has { label, value } — match against "label" instead of the raw field key.
      const filterMatchesXAxis = isChartType && xAxis && (
        xAxis === sectionFilter.field ||
        stripFieldPrefix(xAxis) === stripFieldPrefix(sectionFilter.field)
      );
      const filtered = originalData.filter((row: any) => {
        if (filterMatchesXAxis) {
          return String(row.label ?? '').toLowerCase() === filterVal;
        }
        // Fallback: try raw field key on the row (e.g. for table/card data)
        const fieldVal = String(row[sectionFilter.field] ?? row[stripFieldPrefix(sectionFilter.field)] ?? '').toLowerCase();
        return fieldVal === filterVal;
      });
      widget = { ...widget, config: { ...widget.config, data: filtered } };
    }

    const widgetStyle: React.CSSProperties = overrideStyle || {
      gridColumn: `span ${widget.position.w}`,
      gridRow: `span ${widget.position.h}`
    };

    const widgetAccent = widget.config?.accentColor || '#151f6d';
    const widgetBg = widget.config?.widgetBg || '';
    const widgetFontColor = widget.config?.fontColor || '';
    const fc = widgetFontColor; // shorthand for inline usage
    const bgClass = widgetBg ? 'rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200' : 'bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow duration-200';
    const isDrillTarget = drillDownWidgetId === widget.id && (drillDownLabel || widget.type === 'card');
    const drillRing = isDrillTarget ? ' ring-2 ring-red-500' : '';
    const bgStyle = { ...widgetStyle, ...(widgetBg ? { backgroundColor: widgetBg } : {}), ...(fc ? { color: fc } : {}) };
    const tickStyle = fc ? { fontSize: 12, fill: fc } : { fontSize: 12 };
    const tickStyle11 = fc ? { fontSize: 11, fill: fc } : { fontSize: 11 };
    const titleColorClass = fc ? '' : 'text-gray-900';
    const labelColorClass = fc ? '' : 'text-gray-600';
    const valueColorClass = fc ? '' : 'text-gray-700';
    const filterBar = null; // Filter bar is now rendered at section level

    switch (widget.type) {
      case 'metric':
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass} p-6 relative group`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
            <div className={`text-sm ${labelColorClass} mb-2`}>{widget.title}</div>
            {filterBar}
            <div className="flex items-baseline gap-2">
              <div className={`text-3xl font-bold ${titleColorClass}`}>
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

      case 'vertical-bar': {
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative flex flex-col group`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            
            {widget.config.data && widget.config.data.length > 0 ? (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%" debounce={0}>
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
                      tick={tickStyle}
                    />
                    <YAxis 
                      label={{ value: widget.config.yAxis || 'Value', angle: -90, position: 'insideLeft', ...(fc ? { fill: fc } : {}) }}
                      tick={tickStyle}
                    />
                    <Tooltip 
                      cursor={false}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                      formatter={(value: any) => [Number(value).toLocaleString(), 'Count']}
                    />
                    {widget.config.showLegend && <Legend />}
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(data: any, idx: number) => handleChartDrillDown(widget, data.label, idx)}>
                      {widget.config.data.map((entry: any, idx: number) => (
                        <Cell key={idx} fill={entry.color || widget.config.barColors?.[entry.label] || widget.config.barColor || widgetAccent} />
                      ))}
                    </Bar>
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
      }

      case 'horizontal-bar': {
        const hLabelPos = widget.config?.hBarLabelPos || 'left';
        const hValuePos = widget.config?.hBarValuePos || 'right';
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative group flex flex-col`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            <div className={`flex flex-col gap-2 flex-1 min-h-0`}>
              {widget.config.data?.map((item: any, idx: number) => {
                const maxValue = Math.max(...widget.config.data.map((d: any) => d.value));
                const widthPercent = (item.value / maxValue) * 100;
                const barHeight = Math.max(24, Math.min(32, 100 / Math.max(1, (widget.config.data?.length || 1))));
                const isActive = drillDownLabel === item.label && drillDownWidgetId === widget.id;
                return (
                  <div key={idx} className={`flex items-center gap-3 flex-1 min-h-0 cursor-pointer hover:bg-gray-50 rounded-lg px-1 -mx-1 transition-colors ${isActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`} onClick={() => handleChartDrillDown(widget, item.label, idx)}>
                    {hLabelPos === 'left' && <div className={`text-xs ${labelColorClass} w-20 text-right truncate`}>{item.label}</div>}
                    {hValuePos === 'left' && <div className={`text-xs ${valueColorClass} font-medium w-12`}>{item.value}</div>}
                    <div className="flex-1 rounded-full flex items-center" style={{ height: `${barHeight}px`, backgroundColor: widgetBg ? `${widgetBg}80` : '#f3f4f6' }}>
                      <div
                        className="rounded-full h-full transition-all hover:opacity-80"
                        style={{ width: `${widthPercent}%`, minWidth: '2px', backgroundColor: item.color || widget.config.barColors?.[item.label] || widgetAccent }}
                        title={`${item.label}: ${item.value}`}
                      />
                    </div>
                    {hLabelPos === 'right' && <div className={`text-xs ${labelColorClass} w-20 truncate`}>{item.label}</div>}
                    {hValuePos === 'right' && <div className={`text-xs ${valueColorClass} font-medium w-12 text-right`}>{item.value}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'stacked-vertical-bar': {
        const svStackKeys = widget.config.stackKeys || [];
        const svColors = [widgetAccent, '#da291c', '#9f9fa2', '#293241', '#1e2a7a', '#10b981', '#f59e0b', '#06b6d4'];
        
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative group flex flex-col`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            
            {widget.config.data && widget.config.data.length > 0 && svStackKeys.length > 0 ? (
              <div className="flex-1 min-h-0">                <ResponsiveContainer width="100%" height="100%" debounce={0}>
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
                      tick={tickStyle11}
                    />
                    <YAxis tick={tickStyle11} />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                    />
                    <Legend />
                    {svStackKeys.map((key: string, idx: number) => (
                      <Bar
                        key={key}
                        dataKey={key}
                        stackId="stack"
                        fill={svColors[idx % svColors.length]}
                        radius={idx === svStackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        cursor="pointer"
                        onClick={(data: any, barIdx: number) => handleChartDrillDown(widget, data.label, barIdx)}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400 text-sm flex-1">
                {widget.config.xAxis && widget.config.yAxis && widget.config.stackBy ? 'No data available' : 'Configure X-Axis, Y-Axis, and Stack By field'}
              </div>
            )}
          </div>
        );
      }

      case 'stacked-horizontal-bar': {
        const stackKeys = widget.config.stackKeys || [];
        const colors = [widgetAccent, '#da291c', '#9f9fa2', '#293241', '#1e2a7a', '#10b981', '#f59e0b', '#06b6d4'];
        
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative group flex flex-col`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            
            {widget.config.data && widget.config.data.length > 0 && stackKeys.length > 0 ? (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                {/* Legend */}
                <div className="flex flex-wrap gap-3 justify-center pb-2 border-b">
                  {stackKeys.map((key: string, idx: number) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div 
                        className="w-3 h-3 rounded" 
                        style={{ backgroundColor: colors[idx % colors.length] }}
                      />
                      <span className={`text-xs ${labelColorClass}`}>{key}</span>
                    </div>
                  ))}
                </div>

                {/* Stacked Bars */}
                <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
                  {widget.config.data.map((item: any, idx: number) => {
                    const total = stackKeys.reduce((sum: number, key: string) => {
                      return sum + (Number(item[key]) || 0);
                    }, 0);
                    
                    const barHeight = Math.max(24, Math.min(32, 100 / Math.max(1, (widget.config.data?.length || 1))));
                    const isActive = drillDownLabel === item.label && drillDownWidgetId === widget.id;
                    
                    return (
                      <div key={idx} className={`flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-lg px-1 -mx-1 transition-colors ${isActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`} onClick={() => handleChartDrillDown(widget, item.label, idx)}>
                        <div className={`text-xs ${labelColorClass} w-24 text-right truncate flex-shrink-0`} title={item.label}>
                          {item.label}
                        </div>
                        <div className="flex-1 rounded-full flex items-center overflow-hidden" style={{ height: `${barHeight}px`, backgroundColor: widgetBg ? `${widgetBg}80` : '#f3f4f6' }}>
                          {stackKeys.map((key: string, stackIdx: number) => {
                            const value = Number(item[key]) || 0;
                            const widthPercent = total > 0 ? (value / total) * 100 : 0;
                            
                            if (widthPercent === 0) return null;
                            
                            return (
                              <div
                                key={key}
                                className="h-full transition-all hover:opacity-80 flex items-center justify-center"
                                style={{ 
                                  width: `${widthPercent}%`,
                                  backgroundColor: colors[stackIdx % colors.length],
                                  minWidth: widthPercent > 5 ? 'auto' : '2px'
                                }}
                                title={`${key}: ${value}`}
                              >
                                {widthPercent > 8 && (
                                  <span className="text-xs text-white font-medium px-1">
                                    {value}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        <div className={`text-xs ${valueColorClass} font-medium w-12 text-right flex-shrink-0`}>
                          {total.toFixed(0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400 text-sm flex-1">
                {widget.config.xAxis && widget.config.yAxis && widget.config.stackBy ? 'No data available' : 'Configure X-Axis, Y-Axis, and Stack By field'}
              </div>
            )}
          </div>
        );
      }

      case 'line': {
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative group flex flex-col`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            
            {widget.config.data && widget.config.data.length > 0 ? (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%" debounce={0}>
                  <LineChart
                    data={widget.config.data}
                    margin={{ top: 20, right: 30, left: 0, bottom: Math.max(40, Math.min(80, (widget.config.data?.length || 1) * 8)) }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="label"
                      angle={-45}
                      textAnchor="end"
                      height={Math.max(40, Math.min(80, (widget.config.data?.length || 1) * 8))}
                      tick={tickStyle11}
                    />
                    <YAxis tick={tickStyle11} />
                    <Tooltip
                      cursor={false}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                      formatter={(value: any) => [Number(value).toLocaleString(), 'Value']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={widgetAccent}
                      strokeWidth={2}
                      dot={{ r: 4, fill: widgetAccent, cursor: 'pointer' }}
                      activeDot={{ r: 6, fill: '#da291c', cursor: 'pointer', onClick: (_e: any, payload: any) => handleChartDrillDown(widget, payload?.payload?.label, payload?.index) }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center text-gray-400 text-sm flex-1">
                {widget.config.xAxis && widget.config.yAxis ? 'No data available' : 'Configure axes to see data'}
              </div>
            )}
          </div>
        );
      }

      case 'donut': {
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass}${drillRing} p-6 relative flex flex-col`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                  {widget.config.data?.reduce((acc: any[], item: any, idx: number) => {
                    const total = widget.config.data.reduce((sum: number, d: any) => sum + d.value, 0);
                    const percentage = (item.value / total) * 100;
                    const defaultColors = [widgetAccent, '#da291c', '#9f9fa2', '#293241'];
                    const offset = acc.length > 0 ? acc[acc.length - 1].offset : 0;
                    
                    acc.push({
                      percentage,
                      offset,
                      color: item.color || widget.config.barColors?.[item.label] || defaultColors[idx % defaultColors.length],
                      label: item.label
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
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => handleChartDrillDown(widget, segment.label, idx)}
                    />
                  ))}
                </svg>
              </div>
              <div className="mt-4 space-y-2 w-full">
                {widget.config.data?.map((item: any, idx: number) => {
                  const isActive = drillDownLabel === item.label && drillDownWidgetId === widget.id;
                  return (
                    <div key={idx} className={`flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors ${isActive ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`} onClick={() => handleChartDrillDown(widget, item.label, idx)}>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || widget.config.barColors?.[item.label] || [widgetAccent, '#da291c', '#9f9fa2', '#293241'][idx % 4] }} />
                      <span className={valueColorClass}>{item.label}</span>
                      <span className={`${labelColorClass} ml-auto`}>{item.value}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      }

      case 'gauge':
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass} p-6 relative`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
            <div className="flex flex-col items-center justify-center h-[calc(100%-2rem)]">
              <Gauge className="w-24 h-24 text-brand-navy" />
              <div className="text-2xl font-bold text-gray-900 mt-4">75%</div>
              <div className="text-sm text-gray-600">Goal Achievement</div>
            </div>
          </div>
        );

      case 'table':
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass} p-6 relative overflow-auto`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
            <div className={`text-[13px] font-semibold tracking-tight ${titleColorClass} mb-3`}>{widget.title}</div>
            {filterBar}
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

      case 'card': {
        const isExpanded = drillDownWidgetId === widget.id;
        const cardData = widget.config?.data || widget.config?.manualData || [];
        const cardColor = widget.config?.cardColor || widgetAccent;
        const cardIcon = widget.config?.cardIcon || 'default';
        const cardValue = widget.config?.value ?? widget.config?.manualMetric?.value ?? cardData.reduce((sum: number, d: any) => sum + (Number(d.value) || 0), 0);
        const cardPrefix = widget.config?.prefix ?? widget.config?.manualMetric?.prefix ?? '';
        const cardSuffix = widget.config?.suffix ?? widget.config?.manualMetric?.suffix ?? '';
        const cardTrend = widget.config?.trend ?? widget.config?.manualMetric?.trend ?? null;

        return (
          <div
            key={widget.id}
            style={bgStyle}
            className={`${bgClass}${drillRing} relative group flex flex-col`}
          >
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            {/* Toolbar */}
            <div className={`absolute top-1 right-1 flex gap-0.5 z-10 ${widget.position.w <= 2 && widget.position.h <= 1 ? 'opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-md p-0.5 shadow-sm' : ''}`}>
              <button
                onClick={() => { setDrillDownWidgetId(isExpanded ? null : widget.id); setDrillDownLabel(null); }}
                className="p-0.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title={isExpanded ? 'Collapse' : 'Drill down to data'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleRefreshWidget(widget)}
                className="p-0.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                title="Refresh widget"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {dashEditMode && (
                <>
                  <button
                    onClick={() => handleEditWidget(widget)}
                    className="p-1 text-brand-navy hover:bg-[#f0f1fa] rounded"
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
                className="absolute bottom-0 right-0 w-4 h-4 bg-brand-navy rounded-tl cursor-se-resize hover:bg-brand-navy-light z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to resize"
              />
            )}

            {filterBar}
            {/* Card summary */}
            {(() => {
              const w = widget.position.w;
              const h = widget.position.h;
              const scale = Math.min(w, h * 2);
              const isCompact = w <= 1 || h <= 1;
              const isTiny = w <= 1 && h <= 1;
              const valueSizeClass = isTiny ? 'text-lg' : isCompact ? 'text-2xl' : scale >= 8 ? 'text-7xl' : scale >= 6 ? 'text-6xl' : scale >= 4 ? 'text-5xl' : scale >= 3 ? 'text-4xl' : 'text-3xl';
              const titleSizeClass = isTiny ? 'text-[10px] leading-tight' : isCompact ? 'text-xs' : scale >= 6 ? 'text-lg' : scale >= 4 ? 'text-base' : 'text-base';
              const trendSizeClass = isTiny ? 'text-[10px]' : isCompact ? 'text-xs' : scale >= 6 ? 'text-lg' : scale >= 4 ? 'text-base' : 'text-base';
              const subtitleSizeClass = isTiny ? 'text-[10px]' : isCompact ? 'text-xs' : scale >= 6 ? 'text-base' : 'text-sm';
              const showChevron = !isCompact;
              return (
                <div
                  className={`flex-1 flex items-center justify-center ${isCompact ? 'gap-1 px-2' : 'gap-5 px-6'} cursor-pointer select-none ${isExpanded ? 'py-5' : ''}`}
                  onClick={() => { setDrillDownWidgetId(isExpanded ? null : widget.id); setDrillDownLabel(null); }}
                >
                  <div className={`text-center ${isCompact ? 'min-w-0 overflow-hidden' : ''}`}>
                    <div className={`${titleSizeClass} ${labelColorClass} font-medium ${isCompact ? 'truncate' : ''}`}>{widget.title}</div>
                    <div className={`flex items-baseline justify-center ${isTiny ? 'gap-1' : 'gap-2'}`}>
                      <div className={`${valueSizeClass} font-bold ${titleColorClass} ${isCompact ? 'truncate' : ''}`}>
                        {cardPrefix}{typeof cardValue === 'number' ? cardValue.toLocaleString() : cardValue}{cardSuffix}
                      </div>
                      {cardTrend != null && cardTrend !== 0 && (
                        <div className={`${trendSizeClass} font-semibold ${cardTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {cardTrend > 0 ? '+' : ''}{cardTrend}%
                        </div>
                      )}
                    </div>
                    {widget.config?.subtitle && !isTiny && (
                      <div className={`${subtitleSizeClass} text-gray-500 mt-1 ${isCompact ? 'truncate' : ''}`}>{widget.config.subtitle}</div>
                    )}
                  </div>
                  {showChevron && <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />}
                </div>
              );
            })()}

          </div>
        );
      }

      default:
        return (
          <div key={widget.id} style={bgStyle} className={`${bgClass} p-6 flex items-center justify-center text-gray-400 relative`}>
            {refreshingWidgetId === widget.id && (
              <div className="absolute inset-0 bg-gray-400 opacity-30 rounded-lg animate-pulse z-20" />
            )}
            <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg px-1 py-0.5">
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

  /** Wrap a widget with drag-and-drop behavior + drop indicator */
  const renderWidgetWithDrag = (widget: DashboardWidget, sectionId: string | undefined, sectionFilter?: { field: string; value: string } | null) => {
    // Hidden until a filter button is active
    if (widget.config?.hiddenUntilFilter && !dashEditMode) {
      const sectionActive = sectionId ? activeFilterButtons[sectionId] : null;
      if (!sectionActive) return null;
    }

    if (!dashEditMode) {
      return renderWidget(widget, undefined, sectionFilter);
    }

    const isDragging = draggingWidgetId === widget.id;
    const isDropBefore = dropTarget?.beforeWidgetId === widget.id && dropTarget?.sectionId === sectionId;

    return (
      <div
        key={`drag-${widget.id}`}
        draggable
        onDragStart={(e) => handleWidgetDragStart(e, widget.id)}
        onDragEnd={handleWidgetDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDropTarget({ sectionId, beforeWidgetId: widget.id });
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleWidgetDrop(sectionId, widget.id);
        }}
        style={{
          gridColumn: `span ${widget.position.w}`,
          gridRow: `span ${widget.position.h}`,
          opacity: isDragging ? 0.4 : 1,
          position: 'relative'
        }}
        className={`transition-opacity group ${isDragging ? 'ring-2 ring-blue-400 rounded-lg' : ''} ${isDropBefore ? 'ring-2 ring-blue-500 ring-offset-2 rounded-lg' : ''}`}
      >
        {/* Drop indicator line */}
        {isDropBefore && (
          <div className="absolute -top-2 left-0 right-0 h-1 bg-blue-500 rounded-full z-30" />
        )}
        {/* Drag handle */}
        <div
          className="absolute top-1 left-1 z-20 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <div className="bg-white/90 border border-gray-200 rounded p-0.5 shadow-sm hover:bg-gray-50">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        {renderWidget(widget, { width: '100%', height: '100%' }, sectionFilter)}
      </div>
    );
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
    const target = dashboards.find(d => d.id === id);
    const toggled = target ? { ...target, isFavorite: !target.isFavorite } : null;
    const updated = dashboards.map(d => 
      d.id === id ? { ...d, isFavorite: !d.isFavorite } : d
    );
    setDashboards(updated);
    if (toggled) persistDashboard(toggled);
  };

  const handleDuplicateDashboard = async (dashboard: Dashboard) => {
    try {
      const payload = mapDashboardToApi({ ...dashboard, name: `${dashboard.name} (Copy)` });
      const created = await apiClient.createDashboard(payload);
      const mapped = mapDashboardFromApi(created);
      setDashboards(prev => [...prev, mapped]);
    } catch (err) {
      console.error('Failed to duplicate dashboard:', err);
    }
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

  if (!hasAppPermission('manageDashboards')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Dashboards.</p>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-1 bg-gray-50 h-screen">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-100 p-6 overflow-y-auto flex-shrink-0">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-brand-navy" />
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
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
                            className="mt-4 text-brand-navy hover:text-brand-dark font-medium"
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
                                className="text-sm font-medium text-brand-navy hover:text-brand-dark"
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
                          ? 'bg-brand-navy text-white hover:bg-brand-navy-dark' 
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Settings className="w-5 h-5 mr-2" />
                      {dashEditMode ? 'Done Editing' : 'Edit Dashboard'}
                    </button>
                    {dashEditMode && (
                      <>
                      <button
                        onClick={() => setShowAddSection(true)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        <Layers className="w-5 h-5 mr-2" />
                        Add Section
                      </button>
                      <button
                        onClick={() => setShowWidgetSelector(true)}
                        className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Add Widget
                      </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Dashboard Colors (edit mode) */}
                {dashEditMode && (
                  <div className="mb-4 flex items-center gap-6 bg-white border border-gray-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">Dashboard Background</label>
                      <input
                        type="color"
                        value={selectedDashboard.backgroundColor || '#f3f4f6'}
                        onChange={(e) => {
                          const updated = { ...selectedDashboard, backgroundColor: e.target.value };
                          setSelectedDashboard(updated);
                          const all = dashboards.map(d => d.id === updated.id ? updated : d);
                          setDashboards(all);
                          persistDashboard(updated);
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                      />
                      {selectedDashboard.backgroundColor && (
                        <button
                          onClick={() => {
                            const updated = { ...selectedDashboard, backgroundColor: undefined };
                            setSelectedDashboard(updated);
                            const all = dashboards.map(d => d.id === updated.id ? updated : d);
                            setDashboards(all);
                            persistDashboard(updated);
                          }}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >Reset</button>
                      )}
                    </div>
                  </div>
                )}

                {selectedDashboard.widgets.length > 0 || (selectedDashboard.sections || []).length > 0 ? (
                  <div className="pb-[600px] space-y-5 rounded-xl p-5" style={selectedDashboard.backgroundColor ? { backgroundColor: selectedDashboard.backgroundColor } : undefined}>
                    {/* Auto-migrate unsectioned widgets to first section */}
                    {(() => {
                      const sectionIds = new Set((selectedDashboard.sections || []).map(s => s.id));
                      const unsectioned = selectedDashboard.widgets.filter(w => !w.sectionId || !sectionIds.has(w.sectionId));
                      if (unsectioned.length > 0 && (selectedDashboard.sections || []).length > 0) {
                        const firstSectionId = selectedDashboard.sections![0].id;
                        const migratedWidgets = selectedDashboard.widgets.map(w =>
                          (!w.sectionId || !sectionIds.has(w.sectionId)) ? { ...w, sectionId: firstSectionId } : w
                        );
                        const updated = { ...selectedDashboard, widgets: migratedWidgets };
                        const all = dashboards.map(d => d.id === updated.id ? updated : d);
                        // Use setTimeout to avoid state update during render
                        setTimeout(() => {
                          setSelectedDashboard(updated);
                          setDashboards(all);
                          persistDashboard(updated);
                        }, 0);
                      }
                      return null;
                    })()}
                    {/* Section-grouped widgets */}
                    {(selectedDashboard.sections || []).map((section, sIdx) => {
                      const sectionWidgets = selectedDashboard.widgets.filter(w => w.sectionId === section.id);
                      const isSectionDropTarget = dashEditMode && draggingWidgetId && dropTarget?.sectionId === section.id && dropTarget?.beforeWidgetId === null;
                      return (
                        <div key={section.id} className="bg-gradient-to-b from-white to-gray-50/80 border border-gray-200/60 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                          <div
                            className={`flex items-center justify-between mb-4 pb-3 border-b border-gray-100 transition-colors ${
                              dashEditMode && draggingWidgetId ? 'border-2 border-dashed border-transparent hover:border-blue-300 rounded px-2 py-1' : ''
                            }`}
                            onDragOver={(e) => {
                              if (!dashEditMode) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              setDropTarget({ sectionId: section.id, beforeWidgetId: null });
                            }}
                            onDrop={(e) => {
                              if (!dashEditMode) return;
                              e.preventDefault();
                              handleWidgetDrop(section.id, null);
                            }}
                          >
                            {editingSectionId === section.id ? (
                              <form
                                className="flex items-center gap-2"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleRenameSection(section.id, editingSectionTitle);
                                }}
                              >
                                <input
                                  autoFocus
                                  value={editingSectionTitle}
                                  onChange={(e) => setEditingSectionTitle(e.target.value)}
                                  className="px-2 py-1 border border-gray-300 rounded text-sm font-semibold text-gray-900"
                                />
                                <button type="submit" className="text-sm text-brand-navy hover:underline">Save</button>
                                <button type="button" onClick={() => setEditingSectionId(null)} className="text-sm text-gray-500 hover:underline">Cancel</button>
                              </form>
                            ) : (
                              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-[0.08em] flex items-center gap-2"><span className="w-1 h-4 bg-brand-navy rounded-full inline-block"></span>{section.title}</h3>
                            )}
                            {dashEditMode && editingSectionId !== section.id && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveSection(section.id, 'up')}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                  title="Move up"
                                  disabled={sIdx === 0}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveSection(section.id, 'down')}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                  title="Move down"
                                  disabled={sIdx === (selectedDashboard.sections || []).length - 1}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { setEditingSectionId(section.id); setEditingSectionTitle(section.title); }}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                  title="Rename section"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSection(section.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                  title="Delete section"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => { setAddingFilterBtnSectionId(addingFilterBtnSectionId === section.id ? null : section.id); setNewFilterBtn({ label: '', field: '', value: '', objectType: '' }); }}
                                  className="ml-1 px-2 py-1 text-xs text-brand-navy font-medium hover:bg-[#f0f1fa] rounded transition-colors"
                                  title="Add filter button to section"
                                >
                                  + Add Button
                                </button>
                              </div>
                            )}
                          </div>
                          {section.subtitle && (
                            <p className="text-xs text-gray-400 -mt-2 mb-3 ml-3">{section.subtitle}</p>
                          )}
                          {/* Inline add filter button form */}
                          {dashEditMode && addingFilterBtnSectionId === section.id && (() => {
                            // Get fields from schema first, fall back to hardcoded
                            const apiName = newFilterBtn.objectType ? PLURAL_TO_API_NAME[newFilterBtn.objectType] : '';
                            const schemaDef = apiName && schema ? schema.objects.find((o: any) => o.apiName === apiName) : null;
                            const objFields = schemaDef
                              ? schemaDef.fields.map((f: any) => f.apiName).filter((a: string) => !['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(a))
                              : (newFilterBtn.objectType ? getAvailableFields(newFilterBtn.objectType) : []);
                            const fieldValues: string[] = [];
                            if (newFilterBtn.objectType && newFilterBtn.field) {
                              const records = getCachedRecords(newFilterBtn.objectType);
                              const rawField = stripFieldPrefix(newFilterBtn.field);
                              records.forEach((rec: any) => {
                                const raw = rec[rawField] ?? rec[newFilterBtn.field];
                                if (raw == null) return;
                                const v = typeof raw === 'object' ? JSON.stringify(raw) : String(raw).trim();
                                if (v && v !== '{}' && v !== '[]' && !fieldValues.includes(v)) fieldValues.push(v);
                              });
                              fieldValues.sort();
                            }
                            return (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Add Filter Button</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="text"
                                  value={newFilterBtn.label}
                                  onChange={(e) => setNewFilterBtn({ ...newFilterBtn, label: e.target.value })}
                                  placeholder="Label (e.g. Open)"
                                  className="flex-1 min-w-[100px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40"
                                />
                                <select
                                  value={newFilterBtn.objectType}
                                  onChange={(e) => setNewFilterBtn({ ...newFilterBtn, objectType: e.target.value, field: '', value: '' })}
                                  className="flex-1 min-w-[110px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40 bg-white"
                                >
                                  <option value="">Object type...</option>
                                  {OBJECT_TYPES.map(ot => <option key={ot.value} value={ot.value}>{ot.label}</option>)}
                                </select>
                                <select
                                  value={newFilterBtn.field}
                                  onChange={(e) => setNewFilterBtn({ ...newFilterBtn, field: e.target.value, value: '' })}
                                  disabled={!newFilterBtn.objectType}
                                  className="flex-1 min-w-[110px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40 bg-white disabled:opacity-50"
                                >
                                  <option value="">Select field...</option>
                                  {objFields.map((f: string) => {
                                    const fieldDef = schemaDef?.fields.find((fd: any) => fd.apiName === f);
                                    return <option key={f} value={f}>{fieldDef?.label || stripFieldPrefix(f)}</option>;
                                  })}
                                </select>
                                <select
                                  value={newFilterBtn.value}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setNewFilterBtn({ ...newFilterBtn, value: val, label: newFilterBtn.label || val });
                                  }}
                                  disabled={!newFilterBtn.field}
                                  className="flex-1 min-w-[110px] px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40 bg-white disabled:opacity-50"
                                >
                                  <option value="">Select value...</option>
                                  {fieldValues.map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newFilterBtn.label.trim() || !newFilterBtn.field.trim() || !newFilterBtn.value.trim() || !selectedDashboard) return;
                                    const updatedDashboard = {
                                      ...selectedDashboard,
                                      sections: (selectedDashboard.sections || []).map(s =>
                                        s.id === section.id ? { ...s, filterButtons: [...(s.filterButtons || []), { label: newFilterBtn.label.trim(), field: stripFieldPrefix(newFilterBtn.field.trim()), value: newFilterBtn.value.trim() }] } : s
                                      ),
                                      lastModifiedAt: new Date().toISOString().split('T')[0] || ''
                                    };
                                    const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
                                    setDashboards(updated);
                                    setSelectedDashboard(updatedDashboard);
                                    persistDashboard(updatedDashboard);
                                    setNewFilterBtn({ label: '', field: '', value: '', objectType: '' });
                                  }}
                                  className="px-3 py-1.5 bg-brand-navy text-white text-xs rounded font-medium hover:bg-brand-navy-dark transition-colors"
                                >
                                  Add
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAddingFilterBtnSectionId(null)}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            );
                          })()}
                          {/* Section-level filter buttons */}
                          {(() => {
                            const sectionFilterBtns = section.filterButtons || [];
                            // Also collect from widgets for backwards compat
                            const widgetFilterBtns = sectionWidgets.flatMap(w => w.config?.filterButtons || []);
                            const allBtns = [...sectionFilterBtns, ...widgetFilterBtns];
                            // Deduplicate by label
                            const uniqueBtns = allBtns.filter((btn, idx, arr) => arr.findIndex(b => b.label === btn.label) === idx);
                            const activeBtn = activeFilterButtons[section.id] || null;
                            if (uniqueBtns.length === 0) return null;
                            return (
                              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-0.5">
                                <button
                                  onClick={() => setActiveFilterButtons(prev => ({ ...prev, [section.id]: null }))}
                                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                                    !activeBtn ? 'bg-brand-navy text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                  }`}
                                >
                                  All
                                </button>
                                {uniqueBtns.map((btn) => (
                                  <div key={btn.label} className="relative flex items-center">
                                    <button
                                      onClick={() => setActiveFilterButtons(prev => ({
                                        ...prev,
                                        [section.id]: prev[section.id] === btn.label ? null : btn.label
                                      }))}
                                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                                        activeBtn === btn.label ? 'bg-brand-navy text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                      } ${dashEditMode ? 'pr-6' : ''}`}
                                    >
                                      {btn.label}
                                    </button>
                                    {dashEditMode && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!selectedDashboard) return;
                                          const updatedDashboard = {
                                            ...selectedDashboard,
                                            sections: (selectedDashboard.sections || []).map(s =>
                                              s.id === section.id ? { ...s, filterButtons: (s.filterButtons || []).filter(b => b.label !== btn.label) } : s
                                            ),
                                            lastModifiedAt: new Date().toISOString().split('T')[0] || ''
                                          };
                                          const updated = dashboards.map(d => d.id === updatedDashboard.id ? updatedDashboard : d);
                                          setDashboards(updated);
                                          setSelectedDashboard(updatedDashboard);
                                          persistDashboard(updatedDashboard);
                                          if (activeFilterButtons[section.id] === btn.label) {
                                            setActiveFilterButtons(prev => ({ ...prev, [section.id]: null }));
                                          }
                                        }}
                                        className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 text-red-400 hover:text-red-600 rounded-full"
                                        title="Remove button"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                          {(() => {
                            // Compute the active section filter to pass to each widget
                            const sectionFilterBtns = section.filterButtons || [];
                            const widgetFilterBtns = sectionWidgets.flatMap(w => w.config?.filterButtons || []);
                            const allBtns = [...sectionFilterBtns, ...widgetFilterBtns];
                            const uniqueBtns = allBtns.filter((btn, idx, arr) => arr.findIndex(b => b.label === btn.label) === idx);
                            const activeBtn = activeFilterButtons[section.id] || null;
                            const activeBtnObj = activeBtn ? uniqueBtns.find(b => b.label === activeBtn) : null;
                            const sectionFilter = activeBtnObj ? { field: activeBtnObj.field, value: activeBtnObj.value } : null;
                            return (sectionWidgets.length > 0 || (dashEditMode && draggingWidgetId)) ? (
                            <>
                            <div
                              className={`grid grid-cols-9 gap-5 auto-rows-[200px] ${dashEditMode && draggingWidgetId && sectionWidgets.length === 0 ? 'min-h-[100px]' : ''}`}
                              onDragOver={(e) => {
                                if (!dashEditMode) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                const target = e.target as HTMLElement;
                                if (target === e.currentTarget) {
                                  setDropTarget({ sectionId: section.id, beforeWidgetId: null });
                                }
                              }}
                              onDrop={(e) => {
                                if (!dashEditMode) return;
                                e.preventDefault();
                                handleWidgetDrop(section.id, null);
                              }}
                            >
                              {sectionWidgets.map(widget => renderWidgetWithDrag(widget, section.id, sectionFilter))}
                              {/* End-of-section drop indicator */}
                              {isSectionDropTarget && (
                                <div style={{ gridColumn: 'span 9', height: '4px', gridRow: 'span 1' }} className="flex items-center self-start">
                                  <div className="w-full h-1 bg-blue-500 rounded-full" />
                                </div>
                              )}
                            </div>
                            {/* Standalone drill-down table below grid */}
                            {(() => {
                              const drillWidget = sectionWidgets.find(w => w.id === drillDownWidgetId);
                              if (!drillWidget) return null;
                              const isCard = drillWidget.type === 'card';
                              const isChart = !isCard && !!drillDownLabel;
                              if (!isCard && !isChart) return null;
                              const records = isChart ? getDrillDownRecords(drillWidget, drillDownLabel!) : (drillWidget.config?.data || drillWidget.config?.manualData || []);
                              const columns = records.length > 0 ? Object.keys(records[0]).filter(k => k !== 'id' && !k.startsWith('_')) : [];
                              return (
                                <div className="mt-4 ring-2 ring-red-500 rounded-xl bg-white overflow-hidden shadow-sm">
                                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                                    <p className="text-sm text-gray-700">
                                      <span className="font-semibold">{drillWidget.title}</span>
                                      {isChart && <> &mdash; {records.length} record{records.length !== 1 ? 's' : ''} for <span className="font-medium text-red-600">&quot;{drillDownLabel}&quot;</span></>}
                                      {isCard && <> &mdash; {records.length} record{records.length !== 1 ? 's' : ''}</>}
                                    </p>
                                    <button onClick={closeDrillDown} className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1">
                                      <X className="w-3.5 h-3.5" /> Close
                                    </button>
                                  </div>
                                  {records.length > 0 ? (
                                    <div className="overflow-auto max-h-[400px]">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-gray-50 border-b border-gray-200">
                                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider w-10">#</th>
                                            {columns.map(col => (
                                              <th key={col} className="text-left py-2.5 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                                {stripFieldPrefix(col)}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {records.map((row: any, rIdx: number) => (
                                            <tr key={rIdx} className="hover:bg-gray-50 transition-colors">
                                              <td className="py-2 px-4 text-gray-400 text-xs">{rIdx + 1}</td>
                                              {columns.map(col => (
                                                <td key={col} className="py-2 px-4 text-gray-700">
                                                  {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '')}
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-gray-400 text-sm">No records found</div>
                                  )}
                                </div>
                              );
                            })()}
                            {dashEditMode && (
                              <button
                                onClick={() => { setPendingAddSectionId(section.id); setShowWidgetSelector(true); }}
                                className="mt-3 w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-medium text-gray-400 hover:border-brand-navy/40 hover:text-brand-navy hover:bg-brand-navy/[0.02] transition-all duration-200 flex items-center justify-center gap-2"
                              >
                                <Plus className="w-4 h-4" /> Add Widget to {section.title}
                              </button>
                            )}
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setPendingAddSectionId(section.id);
                                setShowWidgetSelector(true);
                              }}
                              className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-brand-navy/40 hover:text-brand-navy hover:bg-brand-navy/[0.02] transition-all duration-200 flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Add Widget
                            </button>
                          );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <LayoutDashboard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Widgets Yet</h3>
                    <p className="text-gray-600 mb-4">Add widgets to start building your dashboard</p>
                    <button
                      onClick={() => {
                        setEditMode(true);
                        setShowWidgetSelector(true);
                      }}
                      className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
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

      {/* Add Section Dialog */}
      {showAddSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Section</h2>
            </div>
            <div className="p-6">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const title = (formData.get('title') as string)?.trim();
                if (title) handleAddSection(title);
              }}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section Title</label>
                <input
                  name="title"
                  autoFocus
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy text-sm"
                  placeholder="e.g. Estimating Overview"
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button type="button" onClick={() => setShowAddSection(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Add Section</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                    placeholder="Sales Dashboard"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
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
                    className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
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
                  className="flex flex-col items-center gap-3 p-6 border border-gray-200 rounded-lg hover:border-brand-navy hover:bg-[#f0f1fa] transition-colors"
                >
                  <type.icon className="w-8 h-8 text-brand-navy" />
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
              {/* Data Source Mode Toggle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Source</label>
                <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setWidgetConfig({ ...widgetConfig, dataSourceMode: 'object', reportId: '', xAxis: '', yAxis: '', stackBy: '' })}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      widgetConfig.dataSourceMode === 'object'
                        ? 'bg-brand-navy text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    From Object
                  </button>
                  <button
                    type="button"
                    onClick={() => setWidgetConfig({ ...widgetConfig, dataSourceMode: 'report', xAxis: '', yAxis: '', stackBy: '' })}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      widgetConfig.dataSourceMode === 'report'
                        ? 'bg-brand-navy text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    From Report
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const isStacked = selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar';
                      const isMetric = selectedWidgetType === 'metric';
                      setWidgetConfig({
                        ...widgetConfig,
                        dataSourceMode: 'manual',
                        reportId: '',
                        manualData: isStacked
                          ? (widgetConfig.manualData?.length > 0 && widgetConfig.manualStackKeys?.length > 0 ? widgetConfig.manualData : [{ label: 'Category 1', 'Series A': 30, 'Series B': 45 }, { label: 'Category 2', 'Series A': 40, 'Series B': 35 }])
                          : isMetric
                            ? []
                            : (widgetConfig.manualData?.length > 0 ? widgetConfig.manualData : [{ label: 'Item 1', value: 45 }, { label: 'Item 2', value: 62 }, { label: 'Item 3', value: 38 }]),
                        manualStackKeys: isStacked ? (widgetConfig.manualStackKeys?.length > 0 ? widgetConfig.manualStackKeys : ['Series A', 'Series B']) : [],
                        manualMetric: widgetConfig.manualMetric || { value: 0, prefix: '', suffix: '', trend: 0 },
                      });
                    }}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      widgetConfig.dataSourceMode === 'manual'
                        ? 'bg-brand-navy text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Manual Entry
                  </button>
                </div>
              </div>

              {/* ===== FROM OBJECT MODE ===== */}
              {widgetConfig.dataSourceMode === 'object' && (() => {
                const objApiName = widgetConfig.dataSource ? PLURAL_TO_API_NAME[widgetConfig.dataSource] : '';
                const objSchemaDef = objApiName && schema ? schema.objects.find((o: any) => o.apiName === objApiName) : null;
                const EXCLUDED = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'];
                const objectFields: { value: string; label: string }[] = objSchemaDef
                  ? objSchemaDef.fields
                      .filter((f: any) => !EXCLUDED.includes(f.apiName))
                      .map((f: any) => ({ value: f.apiName, label: f.label || stripFieldPrefix(f.apiName) }))
                  : getAvailableFields(widgetConfig.dataSource || '').map(f => ({ value: f, label: stripFieldPrefix(f) }));
                return (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Object Type</label>
                    <select
                      value={widgetConfig.dataSource || ''}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, dataSource: e.target.value, xAxis: '', yAxis: '', stackBy: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                    >
                      <option value="">Select object…</option>
                      {OBJECT_TYPES.map(ot => <option key={ot.value} value={ot.value}>{ot.label}</option>)}
                    </select>
                  </div>

                  {widgetConfig.dataSource && !['metric', 'table', 'card'].includes(selectedWidgetType) && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis (Group By)</label>
                        <select
                          value={widgetConfig.xAxis}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, xAxis: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="">Select field…</option>
                          {objectFields.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis (Measure)</label>
                        <select
                          value={widgetConfig.yAxis}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxis: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="">Select field…</option>
                          {objectFields.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </div>

                      {(selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stack By
                            <span className="text-xs text-gray-500 ml-2">(Group data by this field)</span>
                          </label>
                          <select
                            value={widgetConfig.stackBy}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, stackBy: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                          >
                            <option value="">Select field…</option>
                            {objectFields.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Aggregation Type</label>
                        <select
                          value={widgetConfig.aggregationType || 'sum'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aggregationType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="sum">Sum</option>
                          <option value="count">Count</option>
                          <option value="avg">Average</option>
                          <option value="max">Maximum</option>
                          <option value="min">Minimum</option>
                        </select>
                      </div>

                      {/* WHERE Filters */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filters (WHERE)
                          <span className="text-xs text-gray-500 ml-2">Narrow down records</span>
                        </label>
                        {(widgetConfig.whereFilters || []).map((wf: WhereFilter, idx: number) => (
                          <div key={idx} className="flex gap-1.5 mb-2 items-center">
                            <select
                              value={wf.field}
                              onChange={(e) => {
                                const updated = [...(widgetConfig.whereFilters || [])];
                                updated[idx] = { ...wf, field: e.target.value };
                                setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                              }}
                              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                            >
                              <option value="">Field…</option>
                              {objectFields.map(f => (
                                <option key={f.value} value={f.value}>{f.label}</option>
                              ))}
                            </select>
                            <select
                              value={wf.operator}
                              onChange={(e) => {
                                const updated = [...(widgetConfig.whereFilters || [])];
                                updated[idx] = { ...wf, operator: e.target.value as WhereFilter['operator'] };
                                setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                              }}
                              className="w-[100px] px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                            >
                              <option value="equals">=</option>
                              <option value="not_equals">≠</option>
                              <option value="greater_than">&gt;</option>
                              <option value="less_than">&lt;</option>
                              <option value="greater_equal">≥</option>
                              <option value="less_equal">≤</option>
                              <option value="contains">contains</option>
                              <option value="not_contains">excludes</option>
                              <option value="starts_with">starts with</option>
                              <option value="is_empty">is empty</option>
                              <option value="is_not_empty">has value</option>
                            </select>
                            {wf.operator !== 'is_empty' && wf.operator !== 'is_not_empty' && (
                              <input
                                type="text"
                                value={wf.value}
                                onChange={(e) => {
                                  const updated = [...(widgetConfig.whereFilters || [])];
                                  updated[idx] = { ...wf, value: e.target.value };
                                  setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                                }}
                                placeholder="Value…"
                                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (widgetConfig.whereFilters || []).filter((_: any, i: number) => i !== idx);
                                setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                              }}
                              className="p-1 text-red-400 hover:text-red-600 rounded"
                              title="Remove filter"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setWidgetConfig({
                              ...widgetConfig,
                              whereFilters: [...(widgetConfig.whereFilters || []), { field: '', operator: 'equals', value: '' }]
                            });
                          }}
                          className="text-xs text-brand-navy hover:underline font-medium"
                        >
                          + Add Filter
                        </button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Legend Position</label>
                        <select
                          value={widgetConfig.legendPosition}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, legendPosition: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
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

                  {widgetConfig.dataSource && ['metric', 'card'].includes(selectedWidgetType) && (
                    <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Count Field</label>
                      <select
                        value={widgetConfig.yAxis}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxis: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                      >
                        <option value="">Total record count</option>
                        {objectFields.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    {/* WHERE Filters for metric/card */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filters (WHERE)
                        <span className="text-xs text-gray-500 ml-2">Narrow down records</span>
                      </label>
                      {(widgetConfig.whereFilters || []).map((wf: WhereFilter, idx: number) => (
                        <div key={idx} className="flex gap-1.5 mb-2 items-center">
                          <select
                            value={wf.field}
                            onChange={(e) => {
                              const updated = [...(widgetConfig.whereFilters || [])];
                              updated[idx] = { ...wf, field: e.target.value };
                              setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                            }}
                            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                          >
                            <option value="">Field…</option>
                            {objectFields.map(f => (
                              <option key={f.value} value={f.value}>{f.label}</option>
                            ))}
                          </select>
                          <select
                            value={wf.operator}
                            onChange={(e) => {
                              const updated = [...(widgetConfig.whereFilters || [])];
                              updated[idx] = { ...wf, operator: e.target.value as WhereFilter['operator'] };
                              setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                            }}
                            className="w-[100px] px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                          >
                            <option value="equals">=</option>
                            <option value="not_equals">≠</option>
                            <option value="greater_than">&gt;</option>
                            <option value="less_than">&lt;</option>
                            <option value="greater_equal">≥</option>
                            <option value="less_equal">≤</option>
                            <option value="contains">contains</option>
                            <option value="not_contains">excludes</option>
                            <option value="starts_with">starts with</option>
                            <option value="is_empty">is empty</option>
                            <option value="is_not_empty">has value</option>
                          </select>
                          {wf.operator !== 'is_empty' && wf.operator !== 'is_not_empty' && (
                            <input
                              type="text"
                              value={wf.value}
                              onChange={(e) => {
                                const updated = [...(widgetConfig.whereFilters || [])];
                                updated[idx] = { ...wf, value: e.target.value };
                                setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                              }}
                              placeholder="Value…"
                              className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-brand-navy/40"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (widgetConfig.whereFilters || []).filter((_: any, i: number) => i !== idx);
                              setWidgetConfig({ ...widgetConfig, whereFilters: updated });
                            }}
                            className="p-1 text-red-400 hover:text-red-600 rounded"
                            title="Remove filter"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setWidgetConfig({
                            ...widgetConfig,
                            whereFilters: [...(widgetConfig.whereFilters || []), { field: '', operator: 'equals', value: '' }]
                          });
                        }}
                        className="text-xs text-brand-navy hover:underline font-medium"
                      >
                        + Add Filter
                      </button>
                    </div>
                    </>
                  )}
                </>
                );
              })()}

              {/* ===== REPORT MODE ===== */}
              {widgetConfig.dataSourceMode === 'report' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Report</label>
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
                            yAxis: '',
                            stackBy: ''
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
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
                          No reports available. Create a report in{' '}
                          <Link href="/reports" className="font-medium underline">Reports</Link>, or switch to &quot;Manual Entry&quot;.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Chart Configuration (only for chart types in report mode) */}
                  {!['metric', 'table', 'card'].includes(selectedWidgetType) && availableReports.length > 0 && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">X-Axis</label>
                        <select
                          value={widgetConfig.xAxis}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, xAxis: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="">Select field...</option>
                          {(() => {
                            const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
                            if (selectedReport?.fields && selectedReport.fields.length > 0) {
                              return selectedReport.fields.map((field: string) => (
                                <option key={field} value={field}>{field}</option>
                              ));
                            }
                            const fields = getAvailableFields(widgetConfig.dataSource);
                            return fields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ));
                          })()}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Y-Axis</label>
                        <select
                          value={widgetConfig.yAxis}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, yAxis: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="">Select field...</option>
                          {(() => {
                            const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
                            if (selectedReport?.fields && selectedReport.fields.length > 0) {
                              return selectedReport.fields.map((field: string) => (
                                <option key={field} value={field}>{field}</option>
                              ));
                            }
                            const fields = getAvailableFields(widgetConfig.dataSource);
                            return fields.map(field => (
                              <option key={field} value={field}>{field}</option>
                            ));
                          })()}
                        </select>
                      </div>

                      {(selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stack By
                            <span className="text-xs text-gray-500 ml-2">(Group data by this field)</span>
                          </label>
                          <select
                            value={widgetConfig.stackBy}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, stackBy: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                          >
                            <option value="">Select field...</option>
                            {(() => {
                              const selectedReport = availableReports.find(r => r.id === widgetConfig.reportId);
                              if (selectedReport?.fields && selectedReport.fields.length > 0) {
                                return selectedReport.fields.map((field: string) => (
                                  <option key={field} value={field}>{field}</option>
                                ));
                              }
                              const fields = getAvailableFields(widgetConfig.dataSource);
                              return fields.map(field => (
                                <option key={field} value={field}>{field}</option>
                              ));
                            })()}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Aggregation Type</label>
                        <select
                          value={widgetConfig.aggregationType || 'sum'}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, aggregationType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                        >
                          <option value="sum">Sum</option>
                          <option value="count">Count</option>
                          <option value="avg">Average</option>
                          <option value="max">Maximum</option>
                          <option value="min">Minimum</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Legend Position</label>
                        <select
                          value={widgetConfig.legendPosition}
                          onChange={(e) => setWidgetConfig({ ...widgetConfig, legendPosition: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
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
                </>
              )}

              {/* ===== MANUAL MODE ===== */}
              {widgetConfig.dataSourceMode === 'manual' && (
                <div className="space-y-4">
                  {/* Metric / Card widget manual entry */}
                  {(selectedWidgetType === 'metric' || selectedWidgetType === 'card') && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Metric Value</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Value</label>
                          <input
                            type="number"
                            value={widgetConfig.manualMetric?.value ?? 0}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, manualMetric: { ...widgetConfig.manualMetric, value: parseFloat(e.target.value) || 0 } })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Trend %</label>
                          <input
                            type="number"
                            step="0.1"
                            value={widgetConfig.manualMetric?.trend ?? 0}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, manualMetric: { ...widgetConfig.manualMetric, trend: parseFloat(e.target.value) || 0 } })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Prefix (e.g. $)</label>
                          <input
                            type="text"
                            value={widgetConfig.manualMetric?.prefix ?? ''}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, manualMetric: { ...widgetConfig.manualMetric, prefix: e.target.value } })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                            placeholder="$"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Suffix (e.g. %)</label>
                          <input
                            type="text"
                            value={widgetConfig.manualMetric?.suffix ?? ''}
                            onChange={(e) => setWidgetConfig({ ...widgetConfig, manualMetric: { ...widgetConfig.manualMetric, suffix: e.target.value } })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                            placeholder="%"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card drill-down data rows */}
                  {selectedWidgetType === 'card' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">Drill-Down Data</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const newData = [...(widgetConfig.manualData || []), { label: `Row ${(widgetConfig.manualData?.length || 0) + 1}`, value: 0 }];
                            setWidgetConfig({ ...widgetConfig, manualData: newData });
                          }}
                          className="text-xs text-brand-navy font-medium hover:text-brand-navy-dark"
                        >
                          + Add Row
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">These rows appear when users click to drill down into the card</p>
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {(widgetConfig.manualData || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.label || ''}
                              onChange={(e) => {
                                const newData = [...widgetConfig.manualData];
                                newData[idx] = { ...newData[idx], label: e.target.value };
                                setWidgetConfig({ ...widgetConfig, manualData: newData });
                              }}
                              placeholder="Label"
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                            />
                            <input
                              type="number"
                              value={item.value ?? 0}
                              onChange={(e) => {
                                const newData = [...widgetConfig.manualData];
                                newData[idx] = { ...newData[idx], value: parseFloat(e.target.value) || 0 };
                                setWidgetConfig({ ...widgetConfig, manualData: newData });
                              }}
                              placeholder="Value"
                              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                            />
                            {(widgetConfig.manualData || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newData = widgetConfig.manualData.filter((_: any, i: number) => i !== idx);
                                  setWidgetConfig({ ...widgetConfig, manualData: newData });
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stacked chart manual entry */}}
                  {(selectedWidgetType === 'stacked-horizontal-bar' || selectedWidgetType === 'stacked-vertical-bar') && (
                    <div className="space-y-3">
                      {/* Series (stack keys) management */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">Series</h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newKey = `Series ${String.fromCharCode(65 + (widgetConfig.manualStackKeys?.length || 0))}`;
                              const newKeys = [...(widgetConfig.manualStackKeys || []), newKey];
                              const newData = (widgetConfig.manualData || []).map((row: any) => ({ ...row, [newKey]: 0 }));
                              setWidgetConfig({ ...widgetConfig, manualStackKeys: newKeys, manualData: newData });
                            }}
                            className="text-xs text-brand-navy font-medium hover:text-brand-navy-dark"
                          >
                            + Add Series
                          </button>
                        </div>
                        <div className="space-y-2">
                          {(widgetConfig.manualStackKeys || []).map((key: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => {
                                  const oldKey = widgetConfig.manualStackKeys[idx];
                                  const newKeys = [...widgetConfig.manualStackKeys];
                                  newKeys[idx] = e.target.value;
                                  const newData = (widgetConfig.manualData || []).map((row: any) => {
                                    const newRow = { ...row };
                                    newRow[e.target.value] = newRow[oldKey] || 0;
                                    if (oldKey !== e.target.value) delete newRow[oldKey];
                                    return newRow;
                                  });
                                  setWidgetConfig({ ...widgetConfig, manualStackKeys: newKeys, manualData: newData });
                                }}
                                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                              />
                              {(widgetConfig.manualStackKeys || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const removedKey = widgetConfig.manualStackKeys[idx];
                                    const newKeys = widgetConfig.manualStackKeys.filter((_: any, i: number) => i !== idx);
                                    const newData = (widgetConfig.manualData || []).map((row: any) => {
                                      const newRow = { ...row };
                                      delete newRow[removedKey];
                                      return newRow;
                                    });
                                    setWidgetConfig({ ...widgetConfig, manualStackKeys: newKeys, manualData: newData });
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Data rows for stacked */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-900">Data Points</h4>
                          <button
                            type="button"
                            onClick={() => {
                              const newRow: any = { label: `Category ${(widgetConfig.manualData?.length || 0) + 1}` };
                              (widgetConfig.manualStackKeys || []).forEach((k: string) => { newRow[k] = 0; });
                              setWidgetConfig({ ...widgetConfig, manualData: [...(widgetConfig.manualData || []), newRow] });
                            }}
                            className="text-xs text-brand-navy font-medium hover:text-brand-navy-dark"
                          >
                            + Add Row
                          </button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {(widgetConfig.manualData || []).map((row: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                              <div className="flex-1 space-y-1.5">
                                <input
                                  type="text"
                                  value={row.label || ''}
                                  onChange={(e) => {
                                    const newData = [...widgetConfig.manualData];
                                    newData[idx] = { ...newData[idx], label: e.target.value };
                                    setWidgetConfig({ ...widgetConfig, manualData: newData });
                                  }}
                                  placeholder="Label"
                                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium focus:ring-2 focus:ring-brand-navy/40"
                                />
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(widgetConfig.manualStackKeys || []).map((key: string) => (
                                    <div key={key} className="flex items-center gap-1">
                                      <span className="text-[10px] text-gray-500 w-14 truncate" title={key}>{key}</span>
                                      <input
                                        type="number"
                                        value={row[key] ?? 0}
                                        onChange={(e) => {
                                          const newData = [...widgetConfig.manualData];
                                          newData[idx] = { ...newData[idx], [key]: parseFloat(e.target.value) || 0 };
                                          setWidgetConfig({ ...widgetConfig, manualData: newData });
                                        }}
                                        className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                              {(widgetConfig.manualData || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newData = widgetConfig.manualData.filter((_: any, i: number) => i !== idx);
                                    setWidgetConfig({ ...widgetConfig, manualData: newData });
                                  }}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded mt-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Standard chart manual entry (bar, line, donut) */}
                  {!['metric', 'table', 'card', 'stacked-horizontal-bar', 'stacked-vertical-bar'].includes(selectedWidgetType || '') && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">Data Points</h4>
                        <button
                          type="button"
                          onClick={() => {
                            const newData = [...(widgetConfig.manualData || []), { label: `Item ${(widgetConfig.manualData?.length || 0) + 1}`, value: 0 }];
                            setWidgetConfig({ ...widgetConfig, manualData: newData });
                          }}
                          className="text-xs text-brand-navy font-medium hover:text-brand-navy-dark"
                        >
                          + Add Data Point
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-2">
                        Click any bar in the preview to change its color
                      </p>
                      <div className="space-y-2 max-h-[350px] overflow-y-auto">
                        {(widgetConfig.manualData || []).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                            <div
                              className="w-4 h-4 rounded flex-shrink-0 border border-gray-300"
                              style={{ backgroundColor: item.color || widgetConfig.accentColor || '#151f6d' }}
                            />
                            <input
                              type="text"
                              value={item.label || ''}
                              onChange={(e) => {
                                const newData = [...widgetConfig.manualData];
                                newData[idx] = { ...newData[idx], label: e.target.value };
                                setWidgetConfig({ ...widgetConfig, manualData: newData });
                              }}
                              placeholder="Label"
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                            />
                            <input
                              type="number"
                              value={item.value ?? 0}
                              onChange={(e) => {
                                const newData = [...widgetConfig.manualData];
                                newData[idx] = { ...newData[idx], value: parseFloat(e.target.value) || 0 };
                                setWidgetConfig({ ...widgetConfig, manualData: newData });
                              }}
                              placeholder="Value"
                              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-navy/40"
                            />
                            {(widgetConfig.manualData || []).length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newData = widgetConfig.manualData.filter((_: any, i: number) => i !== idx);
                                  setWidgetConfig({ ...widgetConfig, manualData: newData });
                                }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Enter labels and values — the chart preview updates live</p>
                    </div>
                  )}
                </div>
              )}

              {/* Widget Colors */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Widget Colors</h3>
                <div className="space-y-3">
                  {/* Widget Background */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600 w-28">Background</label>
                    <input
                      type="color"
                      value={widgetConfig.widgetBg || '#ffffff'}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, widgetBg: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    {widgetConfig.widgetBg && (
                      <button type="button" onClick={() => setWidgetConfig({ ...widgetConfig, widgetBg: '' })} className="text-xs text-gray-500 hover:text-gray-700">Reset</button>
                    )}
                  </div>
                  {/* Accent / Bar Color */}
                  {selectedWidgetType !== 'card' && (
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600 w-28">
                      {selectedWidgetType === 'line' ? 'Line Color' : 'Bar / Accent'}
                    </label>
                    <input
                      type="color"
                      value={widgetConfig.accentColor || '#151f6d'}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, accentColor: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    <div className="flex gap-1">
                      {['#151f6d', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setWidgetConfig({ ...widgetConfig, accentColor: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            widgetConfig.accentColor === c
                              ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  )}
                  {/* Font Color */}
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-600 w-28">Font Color</label>
                    <input
                      type="color"
                      value={widgetConfig.fontColor || '#111827'}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, fontColor: e.target.value })}
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                    />
                    <div className="flex gap-1">
                      {['#111827', '#ffffff', '#6b7280', '#1e3a5f', '#dc2626', '#059669'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setWidgetConfig({ ...widgetConfig, fontColor: c })}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            widgetConfig.fontColor === c
                              ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    {widgetConfig.fontColor && (
                      <button type="button" onClick={() => setWidgetConfig({ ...widgetConfig, fontColor: '' })} className="text-xs text-gray-500 hover:text-gray-700">Reset</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Horizontal Bar Layout (only for horizontal-bar) */}
              {selectedWidgetType === 'horizontal-bar' && (
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Bar Layout</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-600 w-28">Label Position</label>
                      <select
                        value={widgetConfig.hBarLabelPos || 'left'}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, hBarLabelPos: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                      >
                        <option value="left">Left of bar</option>
                        <option value="right">Right of bar</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-600 w-28">Value Position</label>
                      <select
                        value={widgetConfig.hBarValuePos || 'right'}
                        onChange={(e) => setWidgetConfig({ ...widgetConfig, hBarValuePos: e.target.value })}
                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/40"
                      >
                        <option value="left">Left of bar</option>
                        <option value="right">Right of bar</option>
                      </select>
                    </div>
                  </div>
                </div>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                      placeholder="Widget title"
                    />
                  </div>

                  {(selectedDashboard?.sections || []).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                    <select
                      value={widgetConfig.sectionId || ''}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, sectionId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 text-sm"
                    >
                      {(selectedDashboard?.sections || []).map(s => (
                        <option key={s.id} value={s.id}>{s.title}</option>
                      ))}
                    </select>
                  </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subtitle</label>
                    <input
                      type="text"
                      value={widgetConfig.subtitle}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, subtitle: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                      placeholder="Optional subtitle"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Footer</label>
                    <input
                      type="text"
                      value={widgetConfig.footer}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, footer: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                      placeholder="Optional footer text"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Custom Link</label>
                    <input
                      type="text"
                      value={widgetConfig.customLink}
                      onChange={(e) => setWidgetConfig({ ...widgetConfig, customLink: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              {/* Section Filter Buttons */}
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Section Filter Buttons</h3>
                  {(widgetConfig.filterButtons?.length || 0) < 10 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newBtns = [...(widgetConfig.filterButtons || []), { label: `Button ${(widgetConfig.filterButtons?.length || 0) + 1}`, field: '', value: '' }];
                        setWidgetConfig({ ...widgetConfig, filterButtons: newBtns });
                      }}
                      className="text-xs text-brand-navy font-medium hover:text-brand-navy-dark"
                    >
                      + Add Button
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer p-2 mb-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input
                    type="checkbox"
                    checked={widgetConfig.hiddenUntilFilter || false}
                    onChange={(e) => setWidgetConfig({ ...widgetConfig, hiddenUntilFilter: e.target.checked })}
                    className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                  />
                  <span className="text-xs font-medium text-gray-800">Only visible when a section filter is active</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">Add buttons that filter all widgets in this section. Each button filters by matching a data field to a value.</p>
                {(widgetConfig.filterButtons || []).length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {(widgetConfig.filterButtons || []).map((btn: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={btn.label || ''}
                            onChange={(e) => {
                              const newBtns = [...widgetConfig.filterButtons];
                              newBtns[idx] = { ...newBtns[idx], label: e.target.value };
                              setWidgetConfig({ ...widgetConfig, filterButtons: newBtns });
                            }}
                            placeholder="Label"
                            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40"
                          />
                          <input
                            type="text"
                            value={btn.field || ''}
                            onChange={(e) => {
                              const newBtns = [...widgetConfig.filterButtons];
                              newBtns[idx] = { ...newBtns[idx], field: e.target.value };
                              setWidgetConfig({ ...widgetConfig, filterButtons: newBtns });
                            }}
                            placeholder="Field name"
                            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40"
                          />
                          <input
                            type="text"
                            value={btn.value || ''}
                            onChange={(e) => {
                              const newBtns = [...widgetConfig.filterButtons];
                              newBtns[idx] = { ...newBtns[idx], value: e.target.value };
                              setWidgetConfig({ ...widgetConfig, filterButtons: newBtns });
                            }}
                            placeholder="Filter value"
                            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-brand-navy/40"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newBtns = widgetConfig.filterButtons.filter((_: any, i: number) => i !== idx);
                            setWidgetConfig({ ...widgetConfig, filterButtons: newBtns });
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
                    No filter buttons configured
                  </div>
                )}
              </div>
              </div>

              {/* Right Panel - Live Preview */}
              <div className="w-1/2 p-6 bg-gray-50 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Live Preview</h3>
                


                <div className="bg-white rounded-lg border border-gray-200 p-4 h-[450px] relative">
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
                        id: `preview-${previewKey}`,
                        type: selectedWidgetType as any,
                        title: widgetConfig.title || `New ${WIDGET_TYPES.find(t => t.id === selectedWidgetType)?.label}`,
                        reportId: widgetConfig.reportId,
                        dataSource: widgetConfig.dataSource,
                        config: { ...widgetConfig, ...currentPreviewData },
                        position: { x: 0, y: 0, w: 4, h: 2 }
                      };

                      return renderWidget(previewWidget, { width: '100%', height: '100%' });
                    })()
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <p>Select a widget type to see preview</p>
                    </div>
                  )}
                </div>
                {/* Color picker popup when a bar is clicked in preview */}
                {colorPickerBarIdx !== null && (() => {
                  const isManual = widgetConfig.dataSourceMode === 'manual';
                  const dataArr = isManual ? (widgetConfig.manualData || []) : (previewData?.data || []);
                  const item = dataArr[colorPickerBarIdx];
                  if (!item) return null;
                  const currentColor = item.color || widgetConfig.barColors?.[item.label] || widgetConfig.accentColor || '#151f6d';
                  return (
                    <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 shadow-lg flex items-center gap-3">
                      <span className="text-xs text-gray-600 font-medium truncate max-w-[100px]">{item.label || `Bar ${colorPickerBarIdx + 1}`}</span>
                      <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => {
                          const newColor = e.target.value;
                          if (isManual) {
                            const newData = [...(widgetConfig.manualData || [])];
                            newData[colorPickerBarIdx] = { ...newData[colorPickerBarIdx], color: newColor };
                            setWidgetConfig({ ...widgetConfig, manualData: newData });
                          } else {
                            const barColors = { ...(widgetConfig.barColors || {}) };
                            barColors[item.label] = newColor;
                            setWidgetConfig({ ...widgetConfig, barColors });
                          }
                        }}
                        className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                      />
                      <div className="flex gap-1">
                        {['#151f6d', '#da291c', '#059669', '#7c3aed', '#d97706', '#0891b2'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              if (isManual) {
                                const newData = [...(widgetConfig.manualData || [])];
                                newData[colorPickerBarIdx] = { ...newData[colorPickerBarIdx], color: c };
                                setWidgetConfig({ ...widgetConfig, manualData: newData });
                              } else {
                                const barColors = { ...(widgetConfig.barColors || {}) };
                                barColors[item.label] = c;
                                setWidgetConfig({ ...widgetConfig, barColors });
                              }
                            }}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${currentColor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-400'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isManual) {
                            const newData = [...(widgetConfig.manualData || [])];
                            const { color: _, ...rest } = newData[colorPickerBarIdx];
                            newData[colorPickerBarIdx] = rest;
                            setWidgetConfig({ ...widgetConfig, manualData: newData });
                          } else {
                            const barColors = { ...(widgetConfig.barColors || {}) };
                            delete barColors[item.label];
                            setWidgetConfig({ ...widgetConfig, barColors });
                          }
                          setColorPickerBarIdx(null);
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorPickerBarIdx(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}
                {widgetConfig.dataSourceMode === 'report' && !widgetConfig.reportId && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Select a report or switch to &quot;Manual Entry&quot; to see live data preview
                  </p>
                )}
                {widgetConfig.dataSourceMode === 'report' && widgetConfig.reportId && (!widgetConfig.xAxis || !widgetConfig.yAxis) && !['metric', 'table', 'card'].includes(selectedWidgetType) && (
                  <p className="text-xs text-amber-600 mt-2 text-center">
                    Configure <strong>X-Axis</strong> and <strong>Y-Axis</strong> to see data visualization
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
                className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
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
