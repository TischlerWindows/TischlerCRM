'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ClipboardList, Plus, Printer, X, AlertCircle, ChevronDown } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'
import { generatePunchListPdf } from './punch-list-pdf'

// ── Types ──────────────────────────────────────────────────────────────

interface FlatPunchItem {
  id: string
  workOrder: string
  itemNumber: number
  location: string
  description: string
  assignedTech: string
  status: string
  estimatedHours: number
  estimatedMen: number
  serviceDate: string
}

interface FlatTechnician {
  id: string
  technicianName: string
}

type PunchStatus = 'Open' | 'In Progress' | 'Completed' | 'N/A'

const STATUSES: PunchStatus[] = ['Open', 'In Progress', 'Completed', 'N/A']

const STATUS_STYLES: Record<PunchStatus, string> = {
  'Open': 'bg-gray-100 text-gray-700',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Completed': 'bg-green-100 text-green-800',
  'N/A': 'bg-yellow-100 text-yellow-800',
}

// ── Helpers ────────────────────────────────────────────────────────────

function getField(rec: Record<string, unknown>, field: string): unknown {
  if (field in rec) return rec[field]
  for (const key of Object.keys(rec)) {
    if (key.endsWith(`__${field}`)) return rec[key]
  }
  return undefined
}

function getStr(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  return v != null ? String(v) : ''
}

function getNum(rec: Record<string, unknown>, field: string): number {
  const v = getField(rec, field)
  return typeof v === 'number' ? v : Number(v) || 0
}

function getLookupId(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}

// ── Skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({
  status,
  onChangeStatus,
  disabled,
}: {
  status: string
  onChangeStatus: (s: PunchStatus) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  const current = (STATUSES.includes(status as PunchStatus) ? status : 'Open') as PunchStatus

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold cursor-pointer transition-colors disabled:opacity-50 ${STATUS_STYLES[current]}`}
      >
        {current}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-32 rounded-lg border border-gray-200 bg-white shadow-lg z-20">
          {STATUSES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChangeStatus(s)
                setOpen(false)
              }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${s === current ? 'font-semibold' : ''}`}
            >
              <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] ${STATUS_STYLES[s]}`}>
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Add Item Modal ────────────────────────────────────────────────────

interface AddItemFormData {
  location: string
  description: string
  assignedTech: string
  estimatedHours: string
  estimatedMen: string
  serviceDate: string
}

const EMPTY_FORM: AddItemFormData = {
  location: '',
  description: '',
  assignedTech: '',
  estimatedHours: '',
  estimatedMen: '',
  serviceDate: '',
}

function AddItemModal({
  techs,
  onSave,
  onClose,
  saving,
}: {
  techs: FlatTechnician[]
  onSave: (form: AddItemFormData) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<AddItemFormData>(EMPTY_FORM)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-brand-dark">Add Punch List Item</h4>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Kitchen, 2nd Floor"
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Description *</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the punch list item..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Assigned Tech</label>
              <select
                value={form.assignedTech}
                onChange={e => setForm(f => ({ ...f, assignedTech: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
              >
                <option value="">-- None --</option>
                {techs.map(t => (
                  <option key={t.id} value={t.id}>{t.technicianName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Est. Hours</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.estimatedHours}
                  onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Est. Men</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.estimatedMen}
                  onChange={e => setForm(f => ({ ...f, estimatedMen: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Service Date</label>
                <input
                  type="date"
                  value={form.serviceDate}
                  onChange={e => setForm(f => ({ ...f, serviceDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.description.trim()}
              onClick={() => onSave(form)}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function PunchListWidget({ record, object }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  // ── State ──
  const [items, setItems] = useState<FlatPunchItem[]>([])
  const [techMap, setTechMap] = useState<Map<string, FlatTechnician>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!workOrderId) return
    setError(null)

    try {
      const [punchRecords, techRecords] = await Promise.all([
        recordsService.getRecords('PunchListItem', { limit: 500 }),
        recordsService.getRecords('Technician', { limit: 500 }),
      ])

      // Flatten and filter items for this work order
      const flatItems = recordsService.flattenRecords(punchRecords)
      const filtered: FlatPunchItem[] = flatItems
        .filter(r => getLookupId(r, 'workOrder') === workOrderId)
        .map(r => ({
          id: String(r.id),
          workOrder: getLookupId(r, 'workOrder'),
          itemNumber: getNum(r, 'itemNumber'),
          location: getStr(r, 'location'),
          description: getStr(r, 'description'),
          assignedTech: getLookupId(r, 'assignedTech'),
          status: getStr(r, 'status') || 'Open',
          estimatedHours: getNum(r, 'estimatedHours'),
          estimatedMen: getNum(r, 'estimatedMen'),
          serviceDate: getStr(r, 'serviceDate'),
        }))
        .sort((a, b) => a.itemNumber - b.itemNumber)

      // Build technician lookup map
      const flatTechs = recordsService.flattenRecords(techRecords)
      const map = new Map<string, FlatTechnician>()
      for (const t of flatTechs) {
        map.set(String(t.id), {
          id: String(t.id),
          technicianName: getStr(t, 'technicianName') || getStr(t, 'name') || 'Unnamed',
        })
      }

      setItems(filtered)
      setTechMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load punch list items')
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Status update ──
  const updateStatus = async (itemId: string, newStatus: PunchStatus) => {
    setSaving(true)
    try {
      await recordsService.updateRecord('PunchListItem', itemId, {
        data: { status: newStatus },
      })
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  // ── Add item ──
  const addItem = async (form: AddItemFormData) => {
    if (!workOrderId) return
    setSaving(true)
    try {
      const nextNum = items.length > 0 ? Math.max(...items.map(i => i.itemNumber)) + 1 : 1
      await recordsService.createRecord('PunchListItem', {
        data: {
          workOrder: workOrderId,
          itemNumber: nextNum,
          location: form.location,
          description: form.description,
          assignedTech: form.assignedTech || null,
          status: 'Open',
          estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : 0,
          estimatedMen: form.estimatedMen ? Number(form.estimatedMen) : 0,
          serviceDate: form.serviceDate || null,
        },
      })
      setShowAddModal(false)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add item')
    } finally {
      setSaving(false)
    }
  }

  // ── Print PDF ──
  const handlePrint = () => {
    const woName = getStr(record as Record<string, unknown>, 'name') || getStr(record as Record<string, unknown>, 'workOrderName') || 'Work Order'
    const propAddr = getStr(record as Record<string, unknown>, 'propertyAddress') || getStr(record as Record<string, unknown>, 'address') || ''

    generatePunchListPdf(
      woName,
      propAddr,
      items.map(item => ({
        itemNumber: item.itemNumber,
        location: item.location,
        description: item.description,
        techName: techMap.get(item.assignedTech)?.technicianName || '',
        status: item.status,
        estimatedHours: item.estimatedHours,
        estimatedMen: item.estimatedMen,
        serviceDate: item.serviceDate,
      }))
    )
  }

  // ── Tech list for the add-item modal ──
  const techList = Array.from(techMap.values()).sort((a, b) =>
    a.technicianName.localeCompare(b.technicianName)
  )

  // ── Render ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No work order selected.
      </div>
    )
  }

  if (loading) return <Skeleton />

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-navy flex-1">
            Punch List
          </h3>
          <span className="text-[11px] text-brand-gray tabular-nums mr-2">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={handlePrint}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-brand-navy hover:bg-gray-50 disabled:opacity-40 transition-colors"
            title="Print PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="py-6 text-center">
              <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-brand-gray">No punch list items yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy w-8">#</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Location</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Description</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Tech</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Status</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Est Hrs</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Est Men</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Service Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const tech = techMap.get(item.assignedTech)
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-2 text-brand-gray tabular-nums">
                          {item.itemNumber}
                        </td>
                        <td className="py-2 px-2 text-brand-dark max-w-[120px] truncate">
                          {item.location || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-brand-dark max-w-[200px] truncate">
                          {item.description || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-brand-gray max-w-[100px] truncate">
                          {tech?.technicianName || '\u2014'}
                        </td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            status={item.status}
                            onChangeStatus={s => updateStatus(item.id, s)}
                            disabled={saving}
                          />
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {item.estimatedHours || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {item.estimatedMen || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-brand-gray">
                          {item.serviceDate || '\u2014'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Add Item ── */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-navy hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Item
          </button>
        </div>
      </div>

      {/* ── Add Item Modal ── */}
      {showAddModal && (
        <AddItemModal
          techs={techList}
          onSave={addItem}
          onClose={() => setShowAddModal(false)}
          saving={saving}
        />
      )}
    </>
  )
}
