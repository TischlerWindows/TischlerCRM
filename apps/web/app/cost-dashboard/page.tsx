'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertTriangle, Download } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// ── Types ──────────────────────────────────────────────────────────────

interface RawRecord {
  id: string
  [key: string]: unknown
  data?: Record<string, unknown>
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Timezone-safe local date string (YYYY-MM-DD).
 * Uses local calendar so date picker values compare correctly to stored
 * date strings without UTC-offset surprises.
 */
function localDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function getField(raw: Record<string, unknown>, field: string): unknown {
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as Record<string, unknown>
    if (d[field] !== undefined) return d[field]
    for (const key of Object.keys(d)) {
      if (key.endsWith(`__${field}`)) return d[key]
    }
  }
  if (raw[field] !== undefined) return raw[field]
  for (const key of Object.keys(raw)) {
    if (key.endsWith(`__${field}`)) return raw[key]
  }
  return undefined
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

function num(v: unknown): number {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? 0 : n
}

function parseRecords(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[]
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.records)) return r.records as RawRecord[]
    if (Array.isArray(r.data)) return r.data as RawRecord[]
  }
  return []
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`
}

// ── CSV export ─────────────────────────────────────────────────────────

function exportCsv(filename: string, headers: string[], rows: string[][]) {
  // Prefix cells starting with =, +, -, @, tab, or CR with a tab to neutralise
  // Excel / Google Sheets formula injection. Without this, a malicious payload
  // like "=cmd|'/c calc'!A1" in a tech name, note, or description field would
  // execute as a formula when the exported CSV is opened in Excel.
  const safe = (c: string | undefined) => {
    const v = c ?? ''
    const needsGuard = /^[=+\-@\t\r]/.test(v)
    const escaped = (needsGuard ? '\t' + v : v).replace(/"/g, '""')
    return `"${escaped}"`
  }
  const csv = [
    headers.map(safe).join(','),
    ...rows.map(r => r.map(safe).join(',')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────────────────

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-brand-dark">{value}</div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function CostDashboardPage() {
  // Default date range: month-to-date (timezone-safe).
  // Lazy initialisers run once so today/monthStart are stable across renders.
  const [from, setFrom] = useState<string>(() => {
    const d = new Date()
    d.setDate(1)
    return localDateString(d)
  })
  const [to, setTo] = useState<string>(() => localDateString(new Date()))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [truncationWarning, setTruncationWarning] = useState(false)

  // Raw records
  const [entries, setEntries] = useState<RawRecord[]>([])
  const [expenses, setExpenses] = useState<RawRecord[]>([])
  const [techMap, setTechMap] = useState<Record<string, RawRecord>>({})
  const [woMap, setWoMap] = useState<Record<string, RawRecord>>({})

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)

      try {
        // Parallel fetch all four collections.
        // The API hard-caps responses at 200 records. The API only supports
        // equality filters on data fields — no gte/lte — so date filtering
        // must be done client-side. If either raw result set hits the cap we
        // set a visible truncation warning.
        const [rawEntries, rawExpenses, rawTechs, rawWos] = await Promise.all([
          apiClient.get<unknown>('/objects/TimeEntry/records?limit=200'),
          apiClient.get<unknown>('/objects/WorkOrderExpense/records?limit=200'),
          apiClient.get<unknown>('/objects/Technician/records?limit=200'),
          apiClient.get<unknown>('/objects/WorkOrder/records?limit=200'),
        ])

        if (cancelled) return

        const allEntries = parseRecords(rawEntries)
        const allExpenses = parseRecords(rawExpenses)
        const allTechs = parseRecords(rawTechs)
        const allWos = parseRecords(rawWos)

        // Detect truncation: if either raw list hit the API cap, totals may
        // be silently under-counted. Show a warning so the user knows.
        const API_CAP = 200
        setTruncationWarning(allEntries.length >= API_CAP || allExpenses.length >= API_CAP)

        // Client-side date filter — compare YYYY-MM-DD strings directly
        const filteredEntries = allEntries.filter(e => {
          const d = str(getField(e, 'date'))
          return d >= from && d <= to
        })
        const filteredExpenses = allExpenses.filter(e => {
          const d = str(getField(e, 'date'))
          return d >= from && d <= to
        })

        // Build lookup maps
        const tmap: Record<string, RawRecord> = {}
        for (const t of allTechs) tmap[t.id] = t
        const wmap: Record<string, RawRecord> = {}
        for (const w of allWos) wmap[w.id] = w

        setEntries(filteredEntries)
        setExpenses(filteredExpenses)
        setTechMap(tmap)
        setWoMap(wmap)
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load cost data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aggregations ────────────────────────────────────────────────────

  const perTech = useMemo(() => {
    const map: Record<string, { hours: number; labor: number; expenses: number }> = {}

    for (const e of entries) {
      const tid = str(getField(e, 'technician'))
      if (!tid) continue
      if (!map[tid]) map[tid] = { hours: 0, labor: 0, expenses: 0 }
      map[tid].hours += num(getField(e, 'totalHours'))
      // Use snapshotted rateAtEntry * hours for labor cost when totalCost isn't stored,
      // but prefer totalCost if present (Task 3 trigger stores this).
      map[tid].labor += num(getField(e, 'totalCost'))
    }

    for (const x of expenses) {
      const tid = str(getField(x, 'technician'))
      if (!tid) continue
      if (!map[tid]) map[tid] = { hours: 0, labor: 0, expenses: 0 }
      map[tid].expenses += num(getField(x, 'amount'))
    }

    return map
  }, [entries, expenses])

  const perWo = useMemo(() => {
    const map: Record<string, { labor: number; expenses: number }> = {}

    for (const e of entries) {
      const wid = str(getField(e, 'workOrder'))
      if (!wid) continue
      if (!map[wid]) map[wid] = { labor: 0, expenses: 0 }
      map[wid].labor += num(getField(e, 'totalCost'))
    }

    for (const x of expenses) {
      const wid = str(getField(x, 'workOrder'))
      if (!wid) continue
      if (!map[wid]) map[wid] = { labor: 0, expenses: 0 }
      map[wid].expenses += num(getField(x, 'amount'))
    }

    return map
  }, [entries, expenses])

  const totalLabor = useMemo(
    () => Object.values(perTech).reduce((s, r) => s + r.labor, 0),
    [perTech]
  )
  const totalExpenses = useMemo(
    () => Object.values(perTech).reduce((s, r) => s + r.expenses, 0),
    [perTech]
  )

  // ── Render states ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto mt-8">
        <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-brand-dark">Cost Dashboard</h1>
        <p className="text-sm text-brand-gray mt-0.5">
          Manager view — all technicians
        </p>
      </div>

      {/* Date range picker */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
          <Input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
          <Input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Truncation warning */}
      {truncationWarning && (
        <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
          <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800">
            Results may be incomplete (reached the 200-record fetch limit). Consider narrowing the date range.
          </p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Labor" value={fmt(totalLabor)} />
        <SummaryCard label="Total Expenses" value={fmt(totalExpenses)} />
        <SummaryCard label="Total Job Cost" value={fmt(totalLabor + totalExpenses)} />
      </div>

      {/* Per-tech table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-brand-dark">By Technician</h2>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() =>
              exportCsv(
                'cost-by-tech.csv',
                ['Tech', 'Hours', 'Labor', 'Expenses', 'Total'],
                Object.entries(perTech).map(([tid, r]) => [
                  str(getField(techMap[tid] ?? {}, 'technicianName')) || tid,
                  r.hours.toFixed(2),
                  r.labor.toFixed(2),
                  r.expenses.toFixed(2),
                  (r.labor + r.expenses).toFixed(2),
                ])
              )
            }
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>

        {Object.keys(perTech).length === 0 ? (
          <p className="text-sm text-brand-gray py-3 px-1">
            No time entries in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left bg-gray-50">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Tech</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Hours</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Labor</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Expenses</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perTech).map(([tid, r]) => {
                  const techName =
                    str(getField(techMap[tid] ?? {}, 'technicianName')) || tid
                  return (
                    <tr key={tid} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-brand-dark">{techName}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{r.hours.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.labor)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.expenses)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-brand-dark">
                        {fmt(r.labor + r.expenses)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-2.5 font-bold text-brand-dark">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {Object.values(perTech)
                      .reduce((s, r) => s + r.hours, 0)
                      .toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(totalLabor)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(totalExpenses)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(totalLabor + totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Per-WO table */}
      <section>
        <h2 className="text-base font-bold text-brand-dark mb-3">By Work Order</h2>

        {Object.keys(perWo).length === 0 ? (
          <p className="text-sm text-brand-gray py-3 px-1">
            No work order activity in this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left bg-gray-50">
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Work Order</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Labor</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Expenses</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perWo).map(([wid, r]) => {
                  const wo = woMap[wid]
                  const name = wo ? str(getField(wo, 'name')) || wid : wid
                  const status = wo ? str(getField(wo, 'workOrderStatus')) : ''
                  return (
                    <tr key={wid} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-brand-dark">{name}</td>
                      <td className="px-4 py-2.5 text-gray-600">{status || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.labor)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmt(r.expenses)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-brand-dark">
                        {fmt(r.labor + r.expenses)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-4 py-2.5 font-bold text-brand-dark" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(Object.values(perWo).reduce((s, r) => s + r.labor, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(Object.values(perWo).reduce((s, r) => s + r.expenses, 0))}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-brand-dark">
                    {fmt(Object.values(perWo).reduce((s, r) => s + r.labor + r.expenses, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
