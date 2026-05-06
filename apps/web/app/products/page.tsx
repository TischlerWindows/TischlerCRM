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
  widthFtIn: string;
  heightFtIn: string;
  qty: number;
  fields: number;
  sqFeet: number;
  netEuroEach: number;
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
          widthFtIn: row.widthFtIn || '',
          heightFtIn: row.heightFtIn || '',
          qty,
          fields: pv(row.fieldsTotal),
          sqFeet: pv(row.sqFeetTotal),
          netEuroEach: pv(row.netEuroEach),
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
    const q = search.toLowerCase().trim();
    return groups.filter(g => {
      if (categoryFilter !== 'All' && g.category !== categoryFilter) return false;
      if (!q) return true;
      // Match product type name (the grouped type)
      if (g.productType.toLowerCase().includes(q)) return true;
      // Match any detail where job identity OR spec fields contain the phrase.
      // Spec fields are checked per-detail so "28" matches details with glassType
      // "28 DC Standard..." but not details with "29 DC..." from a different summary.
      return g.details.some(d => {
        const identity = `${d.summaryName} ${d.opportunityNumber}`.toLowerCase();
        const specs = `${d.glassType} ${d.woodType} ${d.finish} ${d.spacerBarType} ${d.spacerBarColors} ${d.sdl} ${d.tdl}`.toLowerCase();
        return identity.includes(q) || specs.includes(q);
      });
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
    <div className="p-6">
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
                        <td colSpan={8} className="p-0">
                          <div className="bg-[#f8f9fb] border-t border-b border-gray-200 px-6 py-4">
                            <div className="grid grid-cols-1 gap-3">
                              {group.details.map((d, i) => (
                                <div
                                  key={`${d.summaryId}-${i}`}
                                  className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex flex-wrap items-start gap-x-8 gap-y-2"
                                >
                                  {/* Job info */}
                                  <div className="min-w-[160px]">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Job</div>
                                    <div className="text-sm font-medium text-gray-900">{d.summaryName}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 flex gap-2">
                                      {d.opportunityNumber && <span>{d.opportunityNumber}</span>}
                                      {d.date && <span>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                                    </div>
                                    {(d.widthFtIn || d.heightFtIn) && (
                                      <div className="text-xs text-gray-600 mt-1">
                                        {d.widthFtIn && <span>W: {d.widthFtIn}</span>}
                                        {d.widthFtIn && d.heightFtIn && <span className="mx-1 text-gray-300">·</span>}
                                        {d.heightFtIn && <span>H: {d.heightFtIn}</span>}
                                      </div>
                                    )}
                                  </div>

                                  {/* Spec grid */}
                                  <div className="flex-1 grid grid-cols-4 gap-x-6 gap-y-3">
                                    {[
                                      ['Product', d.product],
                                      ['Wood Type', d.woodType],
                                      ['Finish', d.finish],
                                      ['Glass Type', d.glassType],
                                      ['Spacer Bar', d.spacerBarType],
                                      ['Spacer Colors', d.spacerBarColors],
                                      ['SDL', d.sdl],
                                      ['TDL', d.tdl],
                                    ].filter(([, v]) => v).map(([label, val]) => (
                                      <div key={label}>
                                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                                        <div className="text-sm text-gray-800">{val}</div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Numbers */}
                                  <div className="flex gap-5 text-right shrink-0">
                                    <div>
                                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Qty</div>
                                      <div className="text-sm font-medium text-gray-800">{fmtInt(d.qty)}</div>
                                    </div>
                                    {d.fields > 0 && (
                                      <div>
                                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Fields</div>
                                        <div className="text-sm font-medium text-gray-800">{fmtInt(d.fields)}</div>
                                      </div>
                                    )}
                                    {d.sqFeet > 0 && (
                                      <div>
                                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Sq Ft</div>
                                        <div className="text-sm font-medium text-gray-800">{fmt(d.sqFeet)}</div>
                                      </div>
                                    )}
                                    {d.netEuroEach > 0 && (
                                      <div>
                                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">€ Each</div>
                                        <div className="text-sm font-medium text-gray-700">€{fmt(d.netEuroEach)}</div>
                                      </div>
                                    )}
                                    {d.netEuro > 0 && (
                                      <div>
                                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">NET €</div>
                                        <div className="text-sm font-semibold text-brand-navy">€{fmt(d.netEuro)}</div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
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
        )}
      </div>
    </div>
  );
}
