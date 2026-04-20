'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'
import { Select, SelectItem } from '@/components/ui/select'

// ── Types ──────────────────────────────────────────────────────────────

interface WorkOrderExpense {
  id: string
  data: {
    workOrder?: string
    technician?: string
    date?: string
    expenseType?: string
    amount?: number
    quantity?: number
    rate?: number
    description?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

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

function formatCurrency(val: number): string {
  return `$${val.toFixed(2)}`
}

const EXPENSE_TYPES = ['Per Diem', 'Mileage', 'Materials', 'Equipment', 'Other']

const EMPTY_FORM = {
  expenseType: 'Materials',
  amount: '',
  quantity: '',
  rate: '',
  description: '',
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function WorkOrderExpensesWidget({ record }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  const { user } = useAuth()

  const [expenses, setExpenses] = useState<WorkOrderExpense[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})
  const [myTechId, setMyTechId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [woStatus, setWoStatus] = useState<string>('')
  const [completedDate, setCompletedDate] = useState<string | null>(null)

  // Stable ref to techNames to avoid stale closures
  const techNamesRef = useRef(techNames)
  useEffect(() => { techNamesRef.current = techNames }, [techNames])

  // ── Determine current user's tech record and manager status ──
  useEffect(() => {
    if (!user) {
      setIsManager(false)
      setMyTechId(null)
      return
    }

    // ADMIN users are always managers
    if (user.role === 'ADMIN') {
      setIsManager(true)
      setMyTechId(null)
      return
    }

    // Check if a Technician record is linked to this user.
    // If yes → tech (see own only). If no → manager/office staff (see all).
    apiClient.get<Record<string, unknown>[]>(
      `/objects/Technician/records?limit=500`
    ).then(raw => {
      const all = Array.isArray(raw) ? raw : []
      const myTech = all.find(r => str(getDataField(r, 'user')) === user.id)
      if (myTech) {
        setMyTechId(String(myTech.id))
        setIsManager(false)
      } else {
        setIsManager(true)
        setMyTechId(null)
      }
    }).catch(() => {
      // On error: fall back to manager view (show all)
      setIsManager(true)
      setMyTechId(null)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    setError(null)
    try {
      // Fetch WO record for status / completedDate gating
      const woRec = await recordsService.getRecord('WorkOrder', workOrderId)
      const woData = (woRec?.data ?? {}) as Record<string, unknown>
      setWoStatus(str(woData.workOrderStatus))
      setCompletedDate(str(woData.completedDate) || null)

      // Fetch expenses filtered by workOrder
      const params = new URLSearchParams({
        'filter[workOrder]': workOrderId,
        limit: '500',
      })
      const raw = await apiClient.get<Record<string, unknown>[]>(
        `/objects/WorkOrderExpense/records?${params}`
      )
      const all: WorkOrderExpense[] = (Array.isArray(raw) ? raw : []).map(r => ({
        id: String(r.id),
        data: {
          workOrder: str(getDataField(r, 'workOrder')),
          technician: str(getDataField(r, 'technician')),
          date: str(getDataField(r, 'date')),
          expenseType: str(getDataField(r, 'expenseType')),
          amount: num(getDataField(r, 'amount')),
          quantity: num(getDataField(r, 'quantity')),
          rate: num(getDataField(r, 'rate')),
          description: str(getDataField(r, 'description')),
        },
      }))

      setExpenses(all)

      // Resolve tech names for unknown IDs
      const currentCache = techNamesRef.current
      const missingIds = [...new Set(
        all.map(e => e.data.technician).filter((id): id is string => !!id && !currentCache[id])
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
      setError(e instanceof Error ? e.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [workOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload()
  }, [reload])

  // ── Derived: filtered expenses based on user scope ──
  const visibleExpenses = isManager
    ? expenses
    : expenses.filter(e => e.data.technician === myTechId)

  // ── Edit-window gate: techs can't add expenses >24h after WO completion ──
  const completedMs = completedDate ? new Date(completedDate).getTime() : null
  const within24hWindow = completedMs ? (Date.now() - completedMs) < 24 * 60 * 60 * 1000 : true

  const canLog = isManager || (myTechId && within24hWindow && woStatus !== 'Closed')

  // ── Add expense ──
  async function addExpense() {
    if (!workOrderId) return
    setSaving(true)
    setMutationError(null)
    try {
      await recordsService.createRecord('WorkOrderExpense', {
        data: {
          workOrder: workOrderId,
          // Only set technician if user is a tech; managers log without tech linkage
          ...(myTechId ? { technician: myTechId } : {}),
          date: new Date().toISOString().split('T')[0],
          expenseType: form.expenseType,
          amount: Number(form.amount) || 0,
          quantity: Number(form.quantity) || 0,
          rate: Number(form.rate) || 0,
          description: form.description.trim(),
        },
      })
      setForm(EMPTY_FORM)
      setAdding(false)
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to save expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete expense ──
  async function deleteExpense(expenseId: string) {
    if (saving) return
    setSaving(true)
    setMutationError(null)
    try {
      await recordsService.deleteRecord('WorkOrderExpense', expenseId)
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to delete expense. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Guards ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No Work Order record loaded
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
      </div>
    )
  }

  if (error && expenses.length === 0) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  // ── Totals row ──
  const totalAmount = visibleExpenses.reduce((s, e) => s + (e.data.amount ?? 0), 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Mutation error banner */}
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
          Expenses
          <span className="ml-2 font-normal text-[11px]">({visibleExpenses.length})</span>
        </span>
        {canLog && (
          <button
            type="button"
            onClick={() => { setAdding(true); setForm(EMPTY_FORM) }}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Add Expense
          </button>
        )}
      </div>

      {/* Add-expense form */}
      {adding && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="col-span-2">
              <label className="block text-[10px] text-brand-gray mb-0.5">Type</label>
              <Select
                value={form.expenseType}
                onChange={e => setForm(f => ({ ...f, expenseType: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              >
                {EXPENSE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-[10px] text-brand-gray mb-0.5">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
            <div>
              <label className="block text-[10px] text-brand-gray mb-0.5">Qty</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="1"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] text-brand-gray mb-0.5">Rate ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] text-brand-gray mb-0.5">Description</label>
              <input
                type="text"
                placeholder="Description (optional)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addExpense}
              disabled={saving}
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
      {visibleExpenses.length === 0 ? (
        <p className="p-6 text-xs text-brand-gray text-center">
          {isManager ? 'No expenses logged yet.' : 'No expenses from you yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Date</th>
                {isManager && (
                  <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Tech</th>
                )}
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Amount</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Qty</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Description</th>
                {(isManager || within24hWindow) && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visibleExpenses.map(e => {
                const canDelete = isManager || (e.data.technician === myTechId && within24hWindow)
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-brand-dark">{e.data.date || '—'}</td>
                    {isManager && (
                      <td className="px-3 py-2.5 text-brand-gray">
                        {techNames[e.data.technician || ''] || '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.expenseType || '—'}</td>
                    <td className="px-3 py-2.5 font-medium text-brand-dark">{formatCurrency(e.data.amount ?? 0)}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.quantity ?? 0}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{formatCurrency(e.data.rate ?? 0)}</td>
                    <td className="px-3 py-2.5 text-brand-gray max-w-[160px] truncate">{e.data.description || '—'}</td>
                    {(isManager || within24hWindow) && (
                      <td className="px-2 py-2.5 text-right">
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete expense"
                            onClick={() => deleteExpense(e.id)}
                            disabled={saving}
                            className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {visibleExpenses.length > 1 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/80">
                  <td colSpan={isManager ? 3 : 2} className="px-3 py-2 text-[10px] font-semibold text-brand-gray uppercase">Total</td>
                  <td className="px-3 py-2 font-semibold text-brand-dark text-xs">{formatCurrency(totalAmount)}</td>
                  <td colSpan={isManager ? 5 : 4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
