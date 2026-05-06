'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Package } from 'lucide-react';
import { getSetting } from '@/lib/preferences';

interface ProductLogEntry {
  summaryId: string;
  summaryName: string;
  opportunityNumber: string;
  linkedOpportunityId: string | null;
  date: string | null;
  category: string;
  productType: string;
  typeOptions: string[];
  qty: number;
  fields: number;
  sqFeet: number;
  netEuro: number;
}

const CATEGORIES = ['All', 'Euro Windows', 'Double Hung', 'Euro Doors'];

function buildItems(summaries: any[]): ProductLogEntry[] {
  const pv = (x: string | undefined) => parseFloat(x || '0') || 0;
  const entries: ProductLogEntry[] = [];
  for (const s of summaries) {
    const pto: Record<string, string[]> = (Array.isArray(s.productTypeOptions) ? {} : s.productTypeOptions) || {};
    // For multi-location summaries, aggregate rows from all subLocations
    const allRows: any[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap((loc: any) => loc.rows || [])
      : (s.rows || []);
    const allDoorRows: any[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap((loc: any) => loc.doorRows || [])
      : (s.doorRows || []);
    const hungRows = allRows.filter((r: any) => r.type?.toLowerCase().includes('hung'));
    const nonHungRows = allRows.filter((r: any) => !r.type?.toLowerCase().includes('hung'));
    const groups: [string, any[]][] = [
      ['Euro Windows', nonHungRows],
      ['Double Hung', hungRows],
      ['Euro Doors', allDoorRows],
    ];
    for (const [category, catRows] of groups) {
      const acc: Record<string, { qty: number; fields: number; sqFeet: number; netEuro: number }> = {};
      for (const row of catRows) {
        const parts = [row.type, row.type2, row.type3, row.type4].filter(Boolean);
        const t = parts.length ? parts.join(' w/ ') : '—';
        if (!acc[t]) acc[t] = { qty: 0, fields: 0, sqFeet: 0, netEuro: 0 };
        acc[t].qty += pv(row.qty);
        acc[t].fields += pv(row.fieldsTotal);
        acc[t].sqFeet += pv(row.sqFeetTotal);
        acc[t].netEuro += pv(row.netEuroTotal);
      }
      for (const [productType, vals] of Object.entries(acc)) {
        if (vals.qty > 0 || vals.netEuro > 0) {
          entries.push({
            summaryId: s.id,
            summaryName: s.name || 'Untitled',
            opportunityNumber: s.opportunityNumber || '',
            linkedOpportunityId: s.linkedOpportunityId || null,
            date: s.date || null,
            category,
            productType,
            typeOptions: pto[productType] || [],
            ...vals,
          });
        }
      }
    }
  }
  return entries;
}

export default function ProductLogPage() {
  const [entries, setEntries] = useState<ProductLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [productTypeFilter, setProductTypeFilter] = useState('All');

  useEffect(() => {
    getSetting<any[]>('summaries')
      .then(summaries => setEntries(buildItems(summaries ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const productTypes = useMemo(() => {
    const pts = Array.from(new Set(entries.map(e => e.productType))).sort();
    return ['All', ...pts];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      if (categoryFilter !== 'All' && e.category !== categoryFilter) return false;
      if (productTypeFilter !== 'All' && e.productType !== productTypeFilter) return false;
      if (q && ![e.summaryName, e.opportunityNumber, e.productType, ...e.typeOptions].some(v => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [entries, search, categoryFilter, productTypeFilter]);

  const totals = useMemo(() => ({
    qty: filtered.reduce((s, e) => s + e.qty, 0),
    fields: filtered.reduce((s, e) => s + e.fields, 0),
    sqFeet: filtered.reduce((s, e) => s + e.sqFeet, 0),
    netEuro: filtered.reduce((s, e) => s + e.netEuro, 0),
  }), [filtered]);

  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtInt = (v: number) => v.toLocaleString('en-US');

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-brand-navy/10 rounded-lg">
          <Package className="w-6 h-6 text-brand-navy" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Log</h1>
          <p className="text-sm text-gray-500">All products logged from saved summary sheets</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search job, opportunity, product, option…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40 w-80"
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                categoryFilter === cat
                  ? 'bg-brand-navy text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <select
          value={productTypeFilter}
          onChange={e => setProductTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40"
        >
          {productTypes.map(pt => (
            <option key={pt} value={pt}>{pt === 'All' ? 'All Product Types' : pt}</option>
          ))}
        </select>
        <div className="ml-auto text-sm text-gray-500 self-center">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {entries.length === 0
              ? 'No products logged yet. Save a summary sheet to start logging.'
              : 'No entries match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Job Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Opp #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Options</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Fields</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Sq Ft</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">NET €</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((entry, i) => (
                  <tr key={`${entry.summaryId}-${entry.category}-${entry.productType}-${i}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{entry.summaryName}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.opportunityNumber}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {entry.date
                        ? new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        entry.category === 'Euro Windows' ? 'bg-blue-50 text-blue-700' :
                        entry.category === 'Double Hung' ? 'bg-purple-50 text-purple-700' :
                        'bg-green-50 text-green-700'
                      }`}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{entry.productType}</td>
                    <td className="px-4 py-3">
                      {entry.typeOptions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.typeOptions.map(opt => (
                            <span key={opt} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              {opt}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtInt(entry.qty)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmtInt(entry.fields)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{fmt(entry.sqFeet)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{entry.netEuro ? `€${fmt(entry.netEuro)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                  <td className="px-4 py-3 text-gray-800" colSpan={6}>Totals ({filtered.length} lines)</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmtInt(totals.qty)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmtInt(totals.fields)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt(totals.sqFeet)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">€{fmt(totals.netEuro)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
