'use client';

import { useEffect, useState, useMemo } from 'react';
import { Search, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { getSetting } from '@/lib/preferences';
import { getOptionsForType } from '@/lib/product-type-options';

interface ProductLogDetail {
  summaryId: string;
  summaryName: string;
  opportunityNumber: string;
  date: string | null;
  product: string;
  woodType: string;
  finish: string;
  glassType: string;
  hungType: string;
  spacerBarType: string;
  spacerBarColors: string;
  sdl: string;
  tdl: string;
  productTypeOptions: Record<string, string[]>;
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
    const hungType = s.hungType === 'Custom Option' ? (s.hungTypeCustom || '') : (s.hungType || '');
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
          product, woodType, finish, glassType, hungType, spacerBarType, spacerBarColors, sdl, tdl,
          productTypeOptions: (s.productTypeOptions && !Array.isArray(s.productTypeOptions)) ? s.productTypeOptions as Record<string, string[]> : {},
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

interface FieldFilters {
  productType: string;
  job: string;
  glassType: string;
  woodType: string;
  finish: string;
  spacerBar: string;
}

const EMPTY_FILTERS: FieldFilters = { productType: '', job: '', glassType: '', woodType: '', finish: '', spacerBar: '' };

const FILTER_FIELDS: { key: keyof FieldFilters; label: string; detailKey?: keyof ProductLogDetail }[] = [
  { key: 'productType', label: 'Product Type' },
  { key: 'job',         label: 'Job / Opp #' },
  { key: 'glassType',   label: 'Glass Type',   detailKey: 'glassType' },
  { key: 'woodType',    label: 'Wood Type',    detailKey: 'woodType' },
  { key: 'finish',      label: 'Finish',       detailKey: 'finish' },
  { key: 'spacerBar',   label: 'Spacer Bar',   detailKey: 'spacerBarType' },
];

export default function ProductsPage() {
  const [groups, setGroups] = useState<ProductLogGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FieldFilters>(EMPTY_FILTERS);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);

  const setFilter = (field: keyof FieldFilters, value: string) =>
    setFilters(prev => ({ ...prev, [field]: value }));

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');

  useEffect(() => {
    getSetting<any[]>('summaries')
      .then(summaries => setGroups(buildGroups(summaries ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const fPT    = filters.productType.trim();
    const fJob   = filters.job.toLowerCase().trim();
    const fGlass = filters.glassType.trim();
    const fWood  = filters.woodType.trim();
    const fFinish = filters.finish.trim();
    const fSpacer = filters.spacerBar.trim();

    return groups.filter(g => {
      if (categoryFilter !== 'All' && g.category !== categoryFilter) return false;
      // productType: substring match (typed text)
      if (fPT && !g.productType.toLowerCase().includes(fPT.toLowerCase())) return false;
      // spec/job filters — group passes if at least one detail matches ALL active filters
      if (fJob || fGlass || fWood || fFinish || fSpacer) {
        const anyDetailMatches = g.details.some(d => {
          if (fJob && !`${d.summaryName} ${d.opportunityNumber}`.toLowerCase().includes(fJob)) return false;
          if (fGlass && d.glassType !== fGlass) return false;
          if (fWood && d.woodType !== fWood) return false;
          if (fFinish && d.finish !== fFinish) return false;
          if (fSpacer && d.spacerBarType !== fSpacer) return false;
          return true;
        });
        if (!anyDetailMatches) return false;
      }
      return true;
    });
  }, [groups, filters, categoryFilter]);

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

  // Build unique option lists from all loaded groups
  const allDetails = useMemo(() => groups.flatMap(g => g.details), [groups]);
  const uniqueOptions = useMemo(() => {
    const uniq = (vals: string[]) => Array.from(new Set(vals.filter(Boolean))).sort();
    return {
      productType: uniq(groups.map(g => g.productType)),
      glassType:   uniq(allDetails.map(d => d.glassType)),
      woodType:    uniq(allDetails.map(d => d.woodType)),
      finish:      uniq(allDetails.map(d => d.finish)),
      spacerBar:   uniq(allDetails.map(d => d.spacerBarType)),
    };
  }, [groups, allDetails]);

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
      <div className="mb-5 space-y-3">
        {/* Top row: category tabs + filter toggle */}
        <div className="flex flex-wrap items-center gap-3">
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
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              filtersOpen || hasActiveFilters
                ? 'bg-brand-navy text-white border-brand-navy'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Search className="w-4 h-4" />
            Search Fields
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                {Object.values(filters).filter(v => v.trim()).length}
              </span>
            )}
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-xs text-gray-400 hover:text-gray-700 underline"
            >
              Clear filters
            </button>
          )}
          <div className="ml-auto text-sm text-gray-500 self-center">
            {filtered.length} {filtered.length === 1 ? 'type' : 'types'}
          </div>
        </div>

        {/* Per-field dropdowns */}
        {filtersOpen && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            {FILTER_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</label>
                {key === 'job' ? (
                  <input
                    type="text"
                    value={filters.job}
                    onChange={e => setFilter('job', e.target.value)}
                    placeholder="Search job…"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40 bg-white"
                  />
                ) : (
                  <select
                    value={filters[key]}
                    onChange={e => setFilter(key, e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-navy/40 focus:border-brand-navy/40 bg-white"
                  >
                    <option value="">All</option>
                    {(uniqueOptions[key as keyof typeof uniqueOptions] ?? []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        )}
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
                                      ...(group.category === 'Double Hung' ? [['Hung Glass Type', d.hungType]] : []),
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
                                {(() => {
                                  const pto = d.productTypeOptions;
                                  const validOpts = new Set(getOptionsForType(group.productType));
                                  const opts = (Array.isArray(pto[group.productType]) ? pto[group.productType] : []).filter((o: string) => validOpts.has(o));
                                  if (!opts.length) return null;
                                  return (
                                    <div className="w-full mt-2 pt-2 border-t border-gray-100">
                                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Product Type Options</div>
                                      <div className="text-xs text-gray-700">{opts.join(', ')}</div>
                                    </div>
                                  );
                                })()}
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
