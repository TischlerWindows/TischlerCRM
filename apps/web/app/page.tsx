'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

export default function HomePage() {
  const [homeLayout, setHomeLayout] = useState<HomeLayout | null>(null);
  const [reports, setReports] = useState<ReportConfig[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);

  useEffect(() => {
    const storedLayout = localStorage.getItem(HOME_LAYOUT_KEY);
    if (storedLayout) {
      try {
        const raw = JSON.parse(storedLayout);
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

    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    setReports(customReports);

    const savedDashboards = localStorage.getItem('dashboards');
    const saved = savedDashboards ? JSON.parse(savedDashboards) : [];
    setDashboards(saved);
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

  const loadReportRecords = (report: ReportConfig) => {
    const possibleKeys = [
      report.objectType,
      report.objectType.toLowerCase(),
      `${report.objectType.toLowerCase()}s`,
      report.objectType.toLowerCase().endsWith('y')
        ? `${report.objectType.toLowerCase().slice(0, -1)}ies`
        : `${report.objectType.toLowerCase()}s`,
    ];

    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          return JSON.parse(raw) as any[];
        } catch (e) {
          return [];
        }
      }
    }

    return [];
  };

  const renderReportPanel = (panel: HomePanel) => {
    const report = reportMap.get(panel.sourceId);
    if (!report) {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full">
          <div className="text-sm text-gray-600">Report not found</div>
        </div>
      );
    }

    const records = loadReportRecords(report);
    const visibleRows = records.slice(0, 5);

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">{report.name}</div>
            <div className="text-xs text-gray-500 capitalize">{report.format} report</div>
          </div>
          <Link href={`/reports/view/${report.id}`} className="text-xs text-indigo-600 hover:text-indigo-800">
            Run
          </Link>
        </div>
        {visibleRows.length === 0 ? (
          <div className="text-sm text-gray-600">No data available.</div>
        ) : (
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200">
                  {report.fields.slice(0, 4).map((field) => (
                    <th key={field} className="text-left py-1 text-gray-600">
                      {field}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    {report.fields.slice(0, 4).map((field) => (
                      <td key={field} className="py-1 text-gray-700">
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
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full">
          <div className="text-sm text-gray-600">Widget not found</div>
        </div>
      );
    }

    const title = widget.title || widget.type;

    if (widget.type === 'metric') {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          <div className="text-2xl font-bold text-gray-900">
            {widget.config?.prefix}{widget.config?.value?.toLocaleString?.() ?? widget.config?.value}{widget.config?.suffix}
          </div>
        </div>
      );
    }

    if (widget.type === 'vertical-bar' || widget.type === 'horizontal-bar') {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          {widget.config?.data?.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={widget.config.data} layout={widget.type === 'horizontal-bar' ? 'vertical' : 'horizontal'}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={widget.type === 'horizontal-bar' ? 'value' : 'label'} type={widget.type === 'horizontal-bar' ? 'number' : 'category'} />
                <YAxis dataKey={widget.type === 'horizontal-bar' ? 'label' : undefined} type={widget.type === 'horizontal-bar' ? 'category' : 'number'} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill={widget.config?.barColor || '#4f46e5'} radius={[6, 6, 0, 0]} />
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'stacked-vertical-bar' || widget.type === 'stacked-horizontal-bar') {
      const stackKeys = widget.config?.stackKeys || [];
      const data = widget.config?.data || [];
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          {data.length && stackKeys.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout={widget.type === 'stacked-horizontal-bar' ? 'vertical' : 'horizontal'}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={widget.type === 'stacked-horizontal-bar' ? 'value' : 'label'} type={widget.type === 'stacked-horizontal-bar' ? 'number' : 'category'} />
                <YAxis dataKey={widget.type === 'stacked-horizontal-bar' ? 'label' : undefined} type={widget.type === 'stacked-horizontal-bar' ? 'category' : 'number'} />
                <Tooltip />
                <Legend />
                {stackKeys.map((key: string, idx: number) => (
                  <Bar key={key} dataKey={key} stackId="stack" fill={['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][idx % 5]} />
                ))}
              </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'line') {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          {widget.config?.data?.length ? (
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={widget.config.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'donut') {
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
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
                        color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'][idx % 4],
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
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b'][idx % 4] }} />
                    <span className="text-gray-700">{item.label}</span>
                    <span className="text-gray-500 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available.</div>
          )}
        </div>
      );
    }

    if (widget.type === 'gauge') {
      const value = widget.config?.value ?? 75;
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          <div className="text-2xl font-bold text-gray-900">{value}%</div>
          <div className="text-xs text-gray-500">Goal Achievement</div>
        </div>
      );
    }

    if (widget.type === 'table') {
      const rows = widget.config?.data || [];
      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
          <div className="text-xs text-gray-600 mb-2">{title}</div>
          {rows.length ? (
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    {Object.keys(rows[0]).slice(0, 4).map((key) => (
                      <th key={key} className="text-left py-1 text-gray-600">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-100">
                      {Object.keys(rows[0]).slice(0, 4).map((key) => (
                        <td key={key} className="py-1 text-gray-700">
                          {String(row[key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-gray-500">No data available.</div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 h-full flex flex-col">
        <div className="text-xs text-gray-600 mb-2">{title}</div>
        <div className="text-sm text-gray-700">Widget preview</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#9f9fa2]">
      <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <div className="text-center">
          <div className="flex justify-center">
            <Image
              src="/Website-logo-final.png"
              alt="Tischler CRM"
              width={520}
              height={120}
              priority
            />
          </div>
        </div>

        <div id="features" className="mt-24">
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
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-600">
              No Home page layout found. Create one in the Home Layout Editor.
            </div>
          )}
        </div>

        {/* CTA Banner (removed Phase 0 message) */}
      </main>

      <footer className="mt-24 bg-[#9f9fa2] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-200">
          <p>michael's notes: Built with Next.js, Fastify, Prisma, SQLite (dev), and AWS Lambdaready, through VSCode IDE</p>
          {/* Removed explicit phase completion note */}
        </div>
      </footer>
    </div>
  );
}
