'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, FileText, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { Select, SelectItem } from '@/components/ui/select'
import { generatePunchListPdf, type PunchItemForPdf } from './punch-list-pdf'

// ── Types ──────────────────────────────────────────────────────────────

interface PunchItem {
  id: string
  data: {
    workOrder?: string
    itemNumber?: number
    location?: string
    description?: string
    assignedTech?: string
    status?: string
    estimatedHours?: number
    estimatedMen?: number
    serviceDate?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract a field from a raw API record, tolerating flat and nested-data
 * shapes and prefixed keys (e.g. PunchListItem__location).
 */
function getDataField(raw: Record<string, unknown>, field: string): unknown {
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as Record<string, unknown>
    if (d[field] !== undefined) return d[field]
    for (const key of Object.keys(d)) {
      if (key === field || key.endsWith(`__${field}`)) return d[key]
    }
  }
  if (raw[field] !== undefined) return raw[field]
  for (const key of Object.keys(raw)) {
    if (key === field || key.endsWith(`__${field}`)) return raw[key]
  }
  return undefined
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

const STATUSES = ['Open', 'In Progress', 'Completed', 'N/A']

// ── Status badge colours ────────────────────────────────────────────

function statusClass(status: string): string {
  switch (status) {
    case 'Completed': return 'text-green-700 bg-green-50'
    case 'In Progress': return 'text-blue-700 bg-blue-50'
    case 'N/A': return 'text-gray-400 bg-gray-50'
    default: return 'text-amber-700 bg-amber-50'
  }
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function PunchListWidget({ record }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  const [items, setItems] = useState<PunchItem[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  // Keep a ref to the current techNames cache so reload() can read it
  // without adding techNames to its dependency array
  const techNamesRef = useRef(techNames)
  useEffect(() => { techNamesRef.current = techNames }, [techNames])

  // Add-item form state
  const [adding, setAdding] = useState(false)
  const [newLoc, setNewLoc] = useState('')
  const [newDesc, setNewDesc] = useState('')

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        'filter[workOrder]': workOrderId,
        limit: '500',
      })
      const raw = await apiClient.get<Record<string, unknown>[]>(
        `/objects/PunchListItem/records?${params}`
      )
      const list: PunchItem[] = (Array.isArray(raw) ? raw : [])
        .map(r => ({
          id: String(r.id),
          data: {
            workOrder: str(getDataField(r, 'workOrder')),
            itemNumber: num(getDataField(r, 'itemNumber')),
            location: str(getDataField(r, 'location')),
            description: str(getDataField(r, 'description')),
            assignedTech: str(getDataField(r, 'assignedTech')),
            status: str(getDataField(r, 'status')) || 'Open',
            estimatedHours: num(getDataField(r, 'estimatedHours')),
            estimatedMen: num(getDataField(r, 'estimatedMen')),
            serviceDate: str(getDataField(r, 'serviceDate')),
          },
        }))
        .sort((a, b) => (a.data.itemNumber ?? 0) - (b.data.itemNumber ?? 0))
      setItems(list)

      // Resolve tech names for IDs not already in our cache
      const currentCache = techNamesRef.current
      const missingIds = [...new Set(
        list.map(i => i.data.assignedTech).filter((id): id is string => !!id && !currentCache[id])
      )]
      const newNames: Record<string, string> = {}
      await Promise.all(
        missingIds.map(async (tid) => {
          const t = await recordsService.getRecord('Technician', tid) as any
          if (t) newNames[tid] = t.data?.technicianName || ''
        })
      )
      setTechNames(prev => ({ ...prev, ...newNames }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load punch list items')
    } finally {
      setLoading(false)
    }
  }, [workOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload()
  }, [reload])

  async function addItem() {
    if (!workOrderId || !newDesc.trim()) return
    setSaving(true)
    setMutationError(null)
    try {
      // Auto-increment: find max itemNumber across current items, add 1
      const maxNum = items.reduce((max, i) => Math.max(max, i.data.itemNumber ?? 0), 0)
      await recordsService.createRecord('PunchListItem', {
        data: {
          workOrder: workOrderId,
          itemNumber: maxNum + 1,
          location: newLoc.trim(),
          description: newDesc.trim(),
          status: 'Open',
        },
      })
      setNewLoc('')
      setNewDesc('')
      setAdding(false)
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to add item. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(item: PunchItem, status: string) {
    if (saving) return
    setSaving(true)
    setMutationError(null)
    try {
      await recordsService.updateRecord('PunchListItem', item.id, {
        data: { status },
      })
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  async function printPdf() {
    if (!workOrderId || items.length === 0) return
    setPdfLoading(true)
    setMutationError(null)
    try {
      const wo = await recordsService.getRecord('WorkOrder', workOrderId) as any
      const propertyId = wo?.data?.property
      const property = propertyId
        ? await recordsService.getRecord('Property', propertyId) as any
        : null
      const propAddress = property?.data?.address || property?.data?.name || ''
      const pdfItems: PunchItemForPdf[] = items.map(i => ({
        itemNumber: i.data.itemNumber ?? 0,
        location: i.data.location || '',
        description: i.data.description || '',
        techName: techNames[i.data.assignedTech || ''] || '',
        status: i.data.status || '',
        estimatedHours: i.data.estimatedHours ?? 0,
        estimatedMen: i.data.estimatedMen ?? 0,
        serviceDate: i.data.serviceDate || '',
      }))
      await generatePunchListPdf(wo?.data?.name || `WO-${workOrderId}`, propAddress, pdfItems)
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Guard: no parent record ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No Work Order record loaded
      </div>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
      </div>
    )
  }

  // ── Initial load error (nothing to show) ──
  if (error && items.length === 0) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Mutation error banner — sits above the table, doesn't hide it */}
      {mutationError && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-600">{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="ml-3 text-red-400 hover:text-red-600 text-xs leading-none"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
        <span className="text-xs font-semibold text-brand-gray uppercase tracking-wide">
          Punch List
          <span className="ml-2 font-normal text-[11px]">({items.length})</span>
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={printPdf}
            disabled={pdfLoading || items.length === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-brand-gray text-[11px] font-semibold hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {pdfLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileText className="w-3 h-3" />
            )}
            Print PDF
          </button>
          <button
            type="button"
            onClick={() => { setAdding(true); setNewLoc(''); setNewDesc('') }}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Add Item
          </button>
        </div>
      </div>

      {/* Add-item form */}
      {adding && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Location (kitchen, bath 2…)"
              value={newLoc}
              onChange={e => setNewLoc(e.target.value)}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            />
            <input
              type="text"
              placeholder="Description"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newDesc.trim()) addItem() }}
              className="flex-[2] px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addItem}
              disabled={saving || !newDesc.trim()}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-brand-gray hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {items.length === 0 ? (
        <p className="p-6 text-xs text-brand-gray text-center">No punch list items yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px] w-10">#</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Location</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Description</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Tech</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px] w-36">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                  <td className="px-3 py-2.5 text-brand-gray font-medium">
                    {i.data.itemNumber ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-dark">
                    {i.data.location || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-dark max-w-xs truncate">
                    {i.data.description || '—'}
                  </td>
                  <td className="px-3 py-2.5 text-brand-gray">
                    {techNames[i.data.assignedTech || ''] || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <Select
                      value={i.data.status || 'Open'}
                      onChange={e => updateStatus(i, e.target.value)}
                      disabled={saving}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium border-0 cursor-pointer disabled:opacity-50 ${statusClass(i.data.status || 'Open')}`}
                    >
                      {STATUSES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
