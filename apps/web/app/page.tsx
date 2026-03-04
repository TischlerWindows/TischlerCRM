'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Clock, TrendingUp, LayoutDashboard, FileText, ArrowRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useAuth } from '@/lib/auth-context';
import { getPreference, getSetting } from '@/lib/preferences';
import { recordsService } from '@/lib/records-service';

type HomePanel = {
  id: string;
  type: 'report' | 'widget';
  sourceId: string;
  title: string;
  row: number;
  column: number;
  order: number;
};

type HomeLayout = {
  columns: number;
  panels: HomePanel[];
  updatedAt: string;
};

type ReportConfig = {
  id: string;
  name: string;
  description?: string;
  objectType: string;
  format: 'tabular' | 'summary' | 'matrix';
  fields: string[];
};

type DashboardWidget = {
  id: string;
  type: string;
  title?: string;
  config: any;
};

type Dashboard = {
  id: string;
  name: string;
  widgets: DashboardWidget[];
};

const HOME_LAYOUT_KEY = 'homeLayout';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const [homeLayout, setHomeLayout] = useState<HomeLayout | null>(null);
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);

  const [reportRecordsCache, setReportRecordsCache] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const storedLayout = await getPreference<any>('homeLayout');
      if (storedLayout) {
        try {
          const raw = storedLayout;
          if (raw?.panels && typeof raw.columns === 'number') {
            const migratedPanels = raw.panels.map((panel: any, index: number) => ({
              ...panel,
              row: panel.row ?? Math.floor(index / Math.max(raw.columns, 1)),
              column: panel.column ?? index % Math.max(raw.columns, 1),
            }));
            setHomeLayout({ ...raw, panels: migratedPanels } as HomeLayout);
          } else if (raw?.rows) {
            const panels = raw.rows
              .sort((a: any, b: any) => a.order - b.order)
              .flatMap((row: any) =>
                row.panels
                  .sort((a: any, b: any) => a.order - b.order)
                  .map((panel: any) => ({
                    ...panel,
                    row: row.order ?? 0,
                    column: panel.column ?? 0,
                  }))
              );
            setHomeLayout({
              columns: Math.min(Math.max(raw.rows[0]?.columns ?? 2, 1), 4),
              panels,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          setHomeLayout(null);
        }
      }

      const customReports = await getSetting<any[]>('customReports') || [];
      setReports(customReports);

      const saved = await getSetting<any[]>('dashboards') || [];
      setDashboards(saved);
    })();
  }, []);

  const reportMap = useMemo(() => new Map(reports.map((r) => [r.id, r])), [reports]);
  const widgetMap = useMemo(() => {
    const entries: [string, DashboardWidget & { dashboardName?: string }][] = [];
    dashboards.forEach((dashboard) => {
      (dashboard.widgets || []).forEach((widget) => {
        entries.push([widget.id, { ...widget, dashboardName: dashboard.name }]);
      });
    });
    return new Map(entries);
  }, [dashboards]);

  // Pre-load report records for all reports when reports change
  useEffect(() => {
    if (reports.length === 0) return;
    (async () => {
      const cache: Record<string, any[]> = {};
      for (const report of reports) {
        try {
          const records = await recordsService.getRecords(report.objectType);
          cache[report.id] = recordsService.flattenRecords(records);
        } catch {
          cache[report.id] = [];
        }
      }
      setReportRecordsCache(cache);
    })();
  }, [reports]);

  const loadReportRecords = (report: ReportConfig) => {
    return reportRecordsCache[report.id] || [];
  };

  const renderReportPanel = (panel: HomePanel) => {
    const report = reportMap.get(panel.sourceId);
    if (!report) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 h-full shadow-sm">
          <div className="text-sm text-brand-dark/50">Report not found</div>
        </div>
      );
    }

    const records = loadReportRecords(report);
    const visibleRows = records.slice(0, 5);

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-brand-dark">{report.name}</div>
            <div className="text-xs text-brand-dark/50 capitalize mt-0.5">{report.format} report</div>
          </div>
          <Link href={`/reports/view/${report.id}`} className="text-xs font-medium text-brand-navy hover:text-brand-red transition-colors flex items-center gap-1">
            Run <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {visibleRows.length === 0 ? (
          <div className="text-sm text-brand-dark/50 flex-1 flex items-center">No data available.</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {report.fields.slice(0, 4).map((field) => (
                    <th key={field} className="text-left py-1.5 text-brand-dark/60 font-medium">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-brand-light/50">
                    {report.fields.slice(0, 4).map((field) => (
                      <td key={field} className="py-1.5 text-brand-dark/80">
                        {String(row[field] ?? row[field.replace(/^\w+__/, '')] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderWidgetPanel = (panel: HomePanel) => {
    const widget = widgetMap.get(panel.sourceId);
    if (!widget) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-5 h-full shadow-sm">
          <div className="text-sm text-brand-dark/50">Widget not found</div>
        </div>
      );
    }

    const title = widget.title || widget.type;
    const cardBase = "bg-white rounded-lg border border-gray-200 p-5 h-full flex flex-col shadow-sm hover:shadow-md transition-shadow";

    if (widget.type === 'metric') {
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          <div className="text-3xl font-bold text-brand-navy">
            {widget.config?.prefix}{widget.config?.value?.toLocaleString?.() ?? widget.config?.value}{widget.config?.suffix}
          </div>
        </div>
      );
    }

    if (widget.type === 'vertical-bar' || widget.type === 'horizontal-bar') {
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          {widget.config?.data?.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={widget.config.data} layout={widget.type === 'horizontal-bar' ? 'vertical' : 'horizontal'}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={widget.type === 'horizontal-bar' ? 'value' : 'label'} type={widget.type === 'horizontal-bar' ? 'number' : 'category'} tick={{ fontSize: 11 }} />
                <YAxis dataKey={widget.type === 'horizontal-bar' ? 'label' : undefined} type={widget.type === 'horizontal-bar' ? 'category' : 'number'} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill={widget.config?.barColor || '#151f6d'} radius={[4, 4, 0, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-brand-dark/50">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'stacked-vertical-bar' || widget.type === 'stacked-horizontal-bar') {
      const stackKeys = widget.config?.stackKeys || [];
      const data = widget.config?.data || [];
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          {data.length && stackKeys.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout={widget.type === 'stacked-horizontal-bar' ? 'vertical' : 'horizontal'}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={widget.type === 'stacked-horizontal-bar' ? 'value' : 'label'} type={widget.type === 'stacked-horizontal-bar' ? 'number' : 'category'} tick={{ fontSize: 11 }} />
                <YAxis dataKey={widget.type === 'stacked-horizontal-bar' ? 'label' : undefined} type={widget.type === 'stacked-horizontal-bar' ? 'category' : 'number'} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {stackKeys.map((key: string, idx: number) => (
                  <Bar key={key} dataKey={key} stackId="stack" fill={['#151f6d', '#da291c', '#9f9fa2', '#293241', '#1e2a7a'][idx % 5]} />
                ))}
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-brand-dark/50">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'line') {
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          {widget.config?.data?.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={widget.config.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#151f6d" strokeWidth={2} dot={{ r: 3, fill: '#151f6d' }} activeDot={{ r: 5, fill: '#da291c' }} />
              </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-brand-dark/50">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'donut') {
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          {widget.config?.data?.length ? (
            <div className="flex flex-col items-center flex-1 justify-center">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                  {widget.config.data
                    .reduce((acc: any[], item: any, idx: number) => {
                      const total = widget.config.data.reduce((sum: number, d: any) => sum + d.value, 0);
                      const percentage = total ? (item.value / total) * 100 : 0;
                      const offset = acc.length > 0 ? acc[acc.length - 1].offset : 0;
                      acc.push({
                        percentage,
                        offset,
                        color: ['#151f6d', '#da291c', '#9f9fa2', '#293241'][idx % 4],
                      });
                      return acc;
                    }, [])
                    .map((segment: any, idx: number) => (
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
              <div className="mt-4 space-y-1 w-full">
                {widget.config.data.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ['#151f6d', '#da291c', '#9f9fa2', '#293241'][idx % 4] }} />
                    <span className="text-brand-dark/80">{item.label}</span>
                    <span className="text-brand-dark/50 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-brand-dark/50">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'gauge') {
      const value = widget.config?.value ?? 75;
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          <div className="text-3xl font-bold text-brand-navy">{value}%</div>
          <div className="text-xs text-brand-dark/50 mt-1">Goal Achievement</div>
        </div>
      );
    }

    if (widget.type === 'table') {
      const rows = widget.config?.data || [];
      return (
        <div className={cardBase}>
          <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
          {rows.length ? (
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    {Object.keys(rows[0]).slice(0, 4).map((key) => (
                      <th key={key} className="text-left py-1.5 text-brand-dark/60 font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-brand-light/50">
                      {Object.keys(rows[0]).slice(0, 4).map((key) => (
                        <td key={key} className="py-1.5 text-brand-dark/80">
                          {String(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-brand-dark/50">No data available.</div>
          )}
        </div>
      );
    }

    return (
      <div className={cardBase}>
        <div className="text-xs font-medium text-brand-dark/60 mb-2 uppercase tracking-wider">{title}</div>
        <div className="text-sm text-brand-dark/70">Widget preview</div>
      </div>
    );
  };

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-full bg-brand-light">
      {/* Hero / Greeting Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-lg bg-brand-navy flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                <Image
                  src="/tces-logo.png"
                  alt="Tischler"
                  width={40}
                  height={40}
                  className="object-contain"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-brand-dark">
                  {getGreeting()}, {firstName}
                </h1>
                <p className="text-sm text-brand-dark/60 mt-0.5 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  {getFormattedDate()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 py-2 overflow-x-auto">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-dark/70 hover:text-brand-navy hover:bg-brand-light rounded-md transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboards
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-dark/70 hover:text-brand-navy hover:bg-brand-light rounded-md transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Reports
            </Link>
            <Link
              href="/summary"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-dark/70 hover:text-brand-navy hover:bg-brand-light rounded-md transition-colors"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Summary
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content: Widget/Report Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {homeLayout && homeLayout.panels.length > 0 ? (
          <div className="space-y-6">
            {(() => {
              const columns = Math.min(Math.max(homeLayout.columns, 1), 4);
              const panels = homeLayout.panels
                .slice()
                .sort((a, b) => (a.row - b.row) || (a.order - b.order));
              const rows = new Map<number, HomePanel[]>();

              panels.forEach((panel) => {
                const rowIndex = Math.max(panel.row ?? 0, 0);
                if (!rows.has(rowIndex)) rows.set(rowIndex, []);
                rows.get(rowIndex)!.push(panel);
              });

              const rowKeys = Array.from(rows.keys()).sort((a, b) => a - b);

              const gridColsClass = columns === 1
                ? 'grid-cols-1'
                : columns === 2
                  ? 'grid-cols-2'
                  : columns === 3
                    ? 'grid-cols-3'
                    : 'grid-cols-4';

              const colSpanClass = (span: number) => {
                if (span === 4) return 'col-span-4';
                if (span === 3) return 'col-span-3';
                if (span === 2) return 'col-span-2';
                return 'col-span-1';
              };

              const colStartClass = (col: number) => {
                if (col === 1) return 'col-start-2';
                if (col === 2) return 'col-start-3';
                if (col === 3) return 'col-start-4';
                return 'col-start-1';
              };

              return rowKeys.map((rowKey) => {
                const rowPanels = rows.get(rowKey)!.slice().sort((a, b) => (a.column - b.column) || (a.order - b.order));
                const span = rowPanels.length === 1 ? columns : 1;

                return (
                  <div key={rowKey} className={`grid gap-6 ${gridColsClass} auto-rows-[320px]`}>
                    {rowPanels.map((panel) => (
                      <div
                        key={panel.id}
                        className={`${colSpanClass(span)} ${span === 1 ? colStartClass(panel.column ?? 0) : 'col-start-1'}`}
                      >
                        {panel.type === 'report' ? renderReportPanel(panel) : renderWidgetPanel(panel)}
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-brand-light flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="w-6 h-6 text-brand-navy" />
            </div>
            <h3 className="text-sm font-semibold text-brand-dark mb-1">No Home Page Layout</h3>
            <p className="text-xs text-brand-dark/50 max-w-sm mx-auto">
              Create a home page layout in the Home Layout Editor to see reports and widgets here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
