'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { getSetting } from '@/lib/preferences';

interface ProductLogDetail {
  summaryId: string;
  summaryName: string;
  opportunityNumber: string;
  date: string | null;
  product: string;
  woodType: string;
  finish: string;
  glassType: string;
  spacerBarType: string;
  spacerBarColors: string;
  sdl: string;
  tdl: string;
  qty: number;
  fields: number;
  sqFeet: number;
  netEuro: number;
}

interface ProductLogGroup {
  productType: string;
  category: string;
  totalQty: number;
  totalFields: number;
  totalSqFeet: number;
  totalNetEuro: number;
  details: ProductLogDetail[];
}

const CATEGORIES = ['All', 'Euro Windows', 'Double Hung', 'Euro Doors'];

function buildGroups(summaries: any[]): ProductLogGroup[] {
  const pv = (x: string | undefined) => parseFloat(x || '0') || 0;
  const map = new Map<string, { category: string; details: ProductLogDetail[] }>();

  for (const s of summaries) {
    const allRows: any[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap((loc: any) => loc.rows || [])
      : (s.rows || []);
    const allDoorRows: any[] = s.hasMultipleLocations && s.subLocations?.length
      ? s.subLocations.flatMap((loc: any) => loc.doorRows || [])
      : (s.doorRows || []);

    // Product spec fields from the summary-level Product Specifications
    const product = s.product || s.jobType || '';
    const woodType = s.woodType === 'Custom Option' ? (s.woodTypeCustom || '') : (s.woodType || '');
    const finish = s.finish || '';
    const glassType = s.glassType === 'Custom Option' ? (s.glassTypeCustom || '') : (s.glassType || '');
    const spacerBarType = s.spacerBarType || '';
    const spacerBarColors = s.spacerBarColors || '';
    const sdl = s.sdl === 'Custom Option' ? (s.sdlCustom || '') : (s.sdl || '');
    const tdl = s.tdl === 'Custom Option' ? (s.tdlCustom || '') : (s.tdl || '');

    const processRows = (rows: any[], isDoor: boolean) => {
      for (const row of rows) {
        const qty = pv(row.qty);
        const netEuro = pv(row.netEuroTotal);
        if (!qty && !netEuro) continue;

        const parts = [row.type, row.type2, row.type3, row.type4].filter(Boolean);
        const productType = parts.length ? parts.join(' w/ ') : '—';

        let category: string;
        if (isDoor) {
          category = 'Euro Doors';
        } else {
          category = (row.type || '').toLowerCase().includes('hung') ? 'Double Hung' : 'Euro Windows';
        }

        const detail: ProductLogDetail = {
          summaryId: s.id,
          summaryName: s.name || 'Untitled',
          opportunityNumber: s.opportunityNumber || '',
          date: s.date || null,
          product, woodType, finish, glassType, spacerBarType, spacerBarColors, sdl, tdl,
          qty,
          fields: pv(row.fieldsTotal),
          sqFeet: pv(row.sqFeetTotal),
          netEuro,
        };

        const key = `${category}|||${productType}`;
        if (!map.has(key)) map.set(key, { category, details: [] });
        map.get(key)!.details.push(detail);
      }
    };

    processRows(allRows, false);
    processRows(allDoorRows, true);
  }

  return Array.from(map.entries())
    .map(([key, { category, details }]) => ({
      productType: key.split('|||')[1] ?? '—',
      category,
      totalQty: details.reduce((s, d) => s + d.qty, 0),
      totalFields: details.reduce((s, d) => s + d.fields, 0),
      totalSqFeet: details.reduce((s, d) => s + d.sqFeet, 0),
      totalNetEuro: details.reduce((s, d) => s + d.netEuro, 0),
      details,
    }))
    .sort((a, b) => a.productType.localeCompare(b.productType));
}

export default function ProductsPage() {
  const [groups, setGroups] = useState<ProductLogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSetting<any[]>('summaries')
      .then(summaries => setGroups(buildGroups(summaries ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return groups.filter(g => {
      if (categoryFilter !== 'All' && g.category !== categoryFilter) return false;
      if (q) {
        const inGroup = g.productType.toLowerCase().includes(q);
        const inDetails = g.details.some(d =>
          [d.summaryName, d.opportunityNumber, d.product, d.woodType, d.finish, d.glassType, d.spacerBarType, d.sdl, d.tdl]
            .some(v => v.toLowerCase().includes(q))
        );
        if (!inGroup && !inDetails) return false;
      }
      return true;
    });
  }, [groups, search, categoryFilter]);

  const totals = useMemo(() => ({
    qty: filtered.reduce((s, g) => s + g.totalQty, 0),
    fields: filtered.reduce((s, g) => s + g.totalFields, 0),
    sqFeet: filtered.reduce((s, g) => s + g.totalSqFeet, 0),
    netEuro: filtered.reduce((s, g) => s + g.totalNetEuro, 0),
  }), [filtered]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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
          <p className="text-sm text-gray-500">Products grouped by type across all summary sheets — click a row to expand</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search product type, job, specs…"
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
                categoryFilter === cat ? 'bg-brand-navy text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="ml-auto text-sm text-gray-500 self-center">
          {filtered.length} {filtered.length === 1 ? 'type' : 'types'}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {groups.length === 0
              ? 'No products logged yet. Save a summary sheet to start logging.'
              : 'No entries match the current filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Product Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Qty</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Fields</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sq Ft</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total NET €</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Jobs</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((group) => {
                  const key = `${group.category}|||${group.productType}`;
                  const isExpanded = expandedKeys.has(key);
                  return (
                    <>
                      <tr
                        key={key}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer select-none"
                        onClick={() => toggleExpand(key)}
                      >
                        <td className="px-4 py-3 text-gray-400">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{group.productType}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            group.category === 'Euro Windows' ? 'bg-blue-50 text-blue-700' :
                            group.category === 'Double Hung' ? 'bg-purple-50 text-purple-700' :
                            'bg-green-50 text-green-700'
                          }`}>
                            {group.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtInt(group.totalQty)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtInt(group.totalFields)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(group.totalSqFeet)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{group.totalNetEuro ? `€${fmt(group.totalNetEuro)}` : ''}</td>
                        <td className="px-4 py-3 text-center text-gray-500 text-xs">{group.details.length}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${key}--expanded`}>
                          <td colSpan={8} className="p-0 bg-gray-50">
                            <div className="border-t border-b border-gray-200 overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200">
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Job Name</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Opp #</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Product</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Wood Type</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Finish</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Glass Type</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Spacer Bar Type</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Spacer Bar Colors</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">SDL</th>
                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">TDL</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Qty</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Fields</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Sq Ft</th>
                                    <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">NET €</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {group.details.map((d, i) => (
                                    <tr key={`${d.summaryId}-${i}`} className="hover:bg-white">
                                      <td className="px-3 py-2 font-medium text-gray-800">{d.summaryName}</td>
                                      <td className="px-3 py-2 text-gray-600">{d.opportunityNumber}</td>
                                      <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                                        {d.date ? new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-gray-700">{d.product}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.woodType}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.finish}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.glassType}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.spacerBarType}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.spacerBarColors}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.sdl}</td>
                                      <td className="px-3 py-2 text-gray-700">{d.tdl}</td>
                                      <td className="px-3 py-2 text-right text-gray-700">{fmtInt(d.qty)}</td>
                                      <td className="px-3 py-2 text-right text-gray-700">{fmtInt(d.fields)}</td>
                                      <td className="px-3 py-2 text-right text-gray-700">{fmt(d.sqFeet)}</td>
                                      <td className="px-3 py-2 text-right text-gray-700">{d.netEuro ? `€${fmt(d.netEuro)}` : ''}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-gray-800">Totals ({filtered.length} types)</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmtInt(totals.qty)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmtInt(totals.fields)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt(totals.sqFeet)}</td>
                  <td className="px-4 py-3 text-right text-gray-800">€{fmt(totals.netEuro)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
