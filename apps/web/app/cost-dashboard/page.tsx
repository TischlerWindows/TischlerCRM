'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { DollarSign, Clock, TrendingUp, Download, RefreshCw, Filter } from 'lucide-react';
import { recordsService } from '@/lib/records-service';

// ── Helpers ──────────────────────────────────────────────────────────────

function getField(rec: Record<string, unknown>, field: string): unknown {
  if (field in rec) return rec[field];
  for (const key of Object.keys(rec)) {
    if (key.endsWith(`__${field}`)) return rec[key];
  }
  return undefined;
}

function getStr(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field);
  return v != null ? String(v) : '';
}

function getNum(rec: Record<string, unknown>, field: string): number {
  const v = getField(rec, field);
  return typeof v === 'number' ? v : Number(v) || 0;
}

function getLookupId(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field);
  if (!v) return '';
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id);
  return String(v);
}

function fmtCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtHours(hours: number): string {
  return hours.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** YYYY-MM-DD string for an input[type=date] */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function exportToCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Types ────────────────────────────────────────────────────────────────

interface TechRow {
  techId: string;
  techName: string;
  techCode: string;
  totalHours: number;
  avgRate: number;
  laborCost: number;
  expenses: number;
  totalCost: number;
  // hours breakdown
  workHours: number;
  travelHours: number;
  prepHours: number;
  miscHours: number;
}

interface WORow {
  woId: string;
  woName: string;
  propertyName: string;
  status: string;
  category: string;
  laborCost: number;
  expenses: number;
  totalCost: number;
}

// ── Summary Card ─────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-start gap-3">
      <div className="p-2 bg-brand-light rounded-lg flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-brand-navy mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function CostDashboardPage() {
  // Raw data
  const [timeEntries, setTimeEntries] = useState<Record<string, any>[]>([]);
  const [expenses, setExpenses] = useState<Record<string, any>[]>([]);
  const [technicians, setTechnicians] = useState<Record<string, any>[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, any>[]>([]);
  const [properties, setProperties] = useState<Record<string, any>[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const [startDate, setStartDate] = useState(toDateStr(firstOfMonth));
  const [endDate, setEndDate] = useState(toDateStr(now));
  const [selectedTechId, setSelectedTechId] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Client Service' | 'Internal'>('All');

  // ── Fetch data ─────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [teRaw, expRaw, techRaw, woRaw, propRaw] = await Promise.all([
        recordsService.getRecords('TimeEntry', { limit: 2000 }),
        recordsService.getRecords('WorkOrderExpense', { limit: 2000 }),
        recordsService.getRecords('Technician'),
        recordsService.getRecords('WorkOrder', { limit: 2000 }),
        recordsService.getRecords('Property', { limit: 2000 }),
      ]);
      setTimeEntries(recordsService.flattenRecords(teRaw));
      setExpenses(recordsService.flattenRecords(expRaw));
      setTechnicians(recordsService.flattenRecords(techRaw));
      setWorkOrders(recordsService.flattenRecords(woRaw));
      setProperties(recordsService.flattenRecords(propRaw));
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Lookup maps ────────────────────────────────────────────────────

  const techMap = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const t of technicians) m.set(t.id, t);
    return m;
  }, [technicians]);

  const woMap = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const wo of workOrders) m.set(wo.id, wo);
    return m;
  }, [workOrders]);

  const propMap = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const p of properties) m.set(p.id, p);
    return m;
  }, [properties]);

  // ── Filtered entries ───────────────────────────────────────────────

  const filteredTimeEntries = useMemo(() => {
    return timeEntries.filter(te => {
      const d = getStr(te, 'date');
      if (!d) return false;
      if (d < startDate || d > endDate) return false;
      if (selectedTechId !== 'all') {
        const tId = getLookupId(te, 'technician');
        if (tId !== selectedTechId) return false;
      }
      if (categoryFilter !== 'All') {
        const woId = getLookupId(te, 'workOrder');
        const wo = woMap.get(woId);
        if (wo && getStr(wo, 'workOrderCategory') !== categoryFilter) return false;
      }
      return true;
    });
  }, [timeEntries, startDate, endDate, selectedTechId, categoryFilter, woMap]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const d = getStr(exp, 'date');
      if (!d) return false;
      if (d < startDate || d > endDate) return false;
      if (selectedTechId !== 'all') {
        const tId = getLookupId(exp, 'technician');
        if (tId !== selectedTechId) return false;
      }
      if (categoryFilter !== 'All') {
        const woId = getLookupId(exp, 'workOrder');
        const wo = woMap.get(woId);
        if (wo && getStr(wo, 'workOrderCategory') !== categoryFilter) return false;
      }
      return true;
    });
  }, [expenses, startDate, endDate, selectedTechId, categoryFilter, woMap]);

  // ── Aggregations ───────────────────────────────────────────────────

  const { techRows, woRows, summaryLabor, summaryExpenses, summaryHours } = useMemo(() => {
    // Per-tech aggregation
    const byTech = new Map<
      string,
      {
        hours: number;
        cost: number;
        expenses: number;
        entryCount: number;
        rateSum: number;
        workHours: number;
        travelHours: number;
        prepHours: number;
        miscHours: number;
      }
    >();

    for (const te of filteredTimeEntries) {
      const tId = getLookupId(te, 'technician');
      if (!tId) continue;
      const prev = byTech.get(tId) || {
        hours: 0,
        cost: 0,
        expenses: 0,
        entryCount: 0,
        rateSum: 0,
        workHours: 0,
        travelHours: 0,
        prepHours: 0,
        miscHours: 0,
      };
      prev.hours += getNum(te, 'totalHours');
      prev.cost += getNum(te, 'totalCost');
      prev.entryCount += 1;
      prev.rateSum += getNum(te, 'rateAtEntry');
      prev.workHours += getNum(te, 'workHours');
      prev.travelHours += getNum(te, 'travelHours');
      prev.prepHours += getNum(te, 'prepHours');
      prev.miscHours += getNum(te, 'miscHours');
      byTech.set(tId, prev);
    }

    for (const exp of filteredExpenses) {
      const tId = getLookupId(exp, 'technician');
      if (!tId) continue;
      const prev = byTech.get(tId) || {
        hours: 0,
        cost: 0,
        expenses: 0,
        entryCount: 0,
        rateSum: 0,
        workHours: 0,
        travelHours: 0,
        prepHours: 0,
        miscHours: 0,
      };
      prev.expenses += getNum(exp, 'amount');
      byTech.set(tId, prev);
    }

    const techRows: TechRow[] = Array.from(byTech.entries())
      .map(([techId, agg]) => {
        const tech = techMap.get(techId);
        return {
          techId,
          techName: tech ? getStr(tech, 'technicianName') : 'Unknown',
          techCode: tech ? getStr(tech, 'techCode') : '',
          totalHours: agg.hours,
          avgRate: agg.entryCount > 0 ? agg.rateSum / agg.entryCount : 0,
          laborCost: agg.cost,
          expenses: agg.expenses,
          totalCost: agg.cost + agg.expenses,
          workHours: agg.workHours,
          travelHours: agg.travelHours,
          prepHours: agg.prepHours,
          miscHours: agg.miscHours,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    // Per-WO aggregation
    const byWO = new Map<string, { laborCost: number; expenses: number }>();

    for (const te of filteredTimeEntries) {
      const woId = getLookupId(te, 'workOrder');
      if (!woId) continue;
      const prev = byWO.get(woId) || { laborCost: 0, expenses: 0 };
      prev.laborCost += getNum(te, 'totalCost');
      byWO.set(woId, prev);
    }

    for (const exp of filteredExpenses) {
      const woId = getLookupId(exp, 'workOrder');
      if (!woId) continue;
      const prev = byWO.get(woId) || { laborCost: 0, expenses: 0 };
      prev.expenses += getNum(exp, 'amount');
      byWO.set(woId, prev);
    }

    const woRows: WORow[] = Array.from(byWO.entries())
      .map(([woId, agg]) => {
        const wo = woMap.get(woId);
        const propId = wo ? getLookupId(wo, 'property') : '';
        const prop = propId ? propMap.get(propId) : null;
        return {
          woId,
          woName: wo
            ? getStr(wo, 'name') || getStr(wo, 'workOrderNumber') || 'Untitled'
            : 'Unknown WO',
          propertyName: prop
            ? getStr(prop, 'name') || getStr(prop, 'address') || ''
            : '',
          status: wo ? getStr(wo, 'workOrderStatus') : '',
          category: wo ? getStr(wo, 'workOrderCategory') : '',
          laborCost: agg.laborCost,
          expenses: agg.expenses,
          totalCost: agg.laborCost + agg.expenses,
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost);

    // Summary totals
    const summaryLabor = techRows.reduce((s, r) => s + r.laborCost, 0);
    const summaryExpenses = techRows.reduce((s, r) => s + r.expenses, 0);
    const summaryHours = techRows.reduce((s, r) => s + r.totalHours, 0);

    return { techRows, woRows, summaryLabor, summaryExpenses, summaryHours };
  }, [filteredTimeEntries, filteredExpenses, techMap, woMap, propMap]);

  // ── CSV export ─────────────────────────────────────────────────────

  function handleExportTechCsv() {
    const headers = [
      'Tech Name',
      'Tech Code',
      'Total Hours',
      'Avg Rate',
      'Labor Cost',
      'Expenses',
      'Total Cost',
    ];
    const rows = techRows.map(r => [
      r.techName,
      r.techCode,
      fmtHours(r.totalHours),
      fmtCurrency(r.avgRate),
      fmtCurrency(r.laborCost),
      fmtCurrency(r.expenses),
      fmtCurrency(r.totalCost),
    ]);
    exportToCsv(`cost-report-${startDate}-to-${endDate}.csv`, headers, rows);
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-brand-navy animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading cost data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 text-sm bg-brand-navy text-white rounded-md hover:bg-brand-navy-light"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-navy">Cost Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Per-technician and per-work-order cost reporting
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportTechCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-gray-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Labor Cost"
          value={fmtCurrency(summaryLabor)}
          icon={<DollarSign className="w-5 h-5 text-brand-navy" />}
        />
        <SummaryCard
          label="Total Expenses"
          value={fmtCurrency(summaryExpenses)}
          icon={<TrendingUp className="w-5 h-5 text-brand-navy" />}
        />
        <SummaryCard
          label="Total Job Cost"
          value={fmtCurrency(summaryLabor + summaryExpenses)}
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
        />
        <SummaryCard
          label="Total Hours"
          value={fmtHours(summaryHours)}
          icon={<Clock className="w-5 h-5 text-brand-navy" />}
        />
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Filters</h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Technician</label>
            <select
              value={selectedTechId}
              onChange={e => setSelectedTechId(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            >
              <option value="all">All Technicians</option>
              {technicians
                .sort((a, b) =>
                  getStr(a, 'technicianName').localeCompare(getStr(b, 'technicianName'))
                )
                .map(t => (
                  <option key={t.id} value={t.id}>
                    {getStr(t, 'technicianName')}
                    {getStr(t, 'techCode') ? ` (${getStr(t, 'techCode')})` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={e =>
                setCategoryFilter(e.target.value as 'All' | 'Client Service' | 'Internal')
              }
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            >
              <option value="All">All</option>
              <option value="Client Service">Client Service</option>
              <option value="Internal">Internal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Per-Technician Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-navy">
            Per-Technician Breakdown ({techRows.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Tech Name
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Tech Code
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Total Hours
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Avg Rate
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Labor Cost
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Expenses
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {techRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No data for the selected period
                  </td>
                </tr>
              ) : (
                techRows.map((r, i) => (
                  <tr key={r.techId} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.techName}</td>
                    <td className="px-4 py-2.5 text-gray-600">{r.techCode || '-'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtHours(r.totalHours)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCurrency(r.avgRate)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCurrency(r.laborCost)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtCurrency(r.expenses)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {fmtCurrency(r.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {techRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtHours(summaryHours)}</td>
                  <td className="px-4 py-2.5 text-right">-</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtCurrency(summaryLabor)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrency(summaryExpenses)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrency(summaryLabor + summaryExpenses)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Per-Work-Order Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-navy">
            Per-Work-Order Breakdown ({woRows.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Work Order
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Property
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Labor Cost
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Expenses
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Total Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {woRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No data for the selected period
                  </td>
                </tr>
              ) : (
                woRows.map((r, i) => (
                  <tr key={r.woId} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">
                      <a
                        href={`/workorders/${r.woId}`}
                        className="text-brand-navy hover:underline"
                      >
                        {r.woName}
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.propertyName || '-'}</td>
                    <td className="px-4 py-2.5">
                      {r.status ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                          {r.status}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{r.category || '-'}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtCurrency(r.laborCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtCurrency(r.expenses)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {fmtCurrency(r.totalCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {woRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2.5" colSpan={4}>
                    Totals
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrency(woRows.reduce((s, r) => s + r.laborCost, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrency(woRows.reduce((s, r) => s + r.expenses, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtCurrency(woRows.reduce((s, r) => s + r.totalCost, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Hours Breakdown Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-navy">
            Hours Breakdown ({techRows.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                  Tech Name
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Work Hours
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Travel Hours
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Prep Hours
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Misc Hours
                </th>
                <th className="px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider text-right">
                  Total Hours
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {techRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No data for the selected period
                  </td>
                </tr>
              ) : (
                techRows.map((r, i) => (
                  <tr key={r.techId} className={i % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{r.techName}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtHours(r.workHours)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtHours(r.travelHours)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtHours(r.prepHours)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmtHours(r.miscHours)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                      {fmtHours(r.totalHours)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {techRows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-2.5">Totals</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtHours(techRows.reduce((s, r) => s + r.workHours, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtHours(techRows.reduce((s, r) => s + r.travelHours, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtHours(techRows.reduce((s, r) => s + r.prepHours, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtHours(techRows.reduce((s, r) => s + r.miscHours, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {fmtHours(summaryHours)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
