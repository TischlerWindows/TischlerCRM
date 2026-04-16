'use client'

import { useState, useEffect, useCallback } from 'react'
import { Receipt, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'

// ── Types ──────────────────────────────────────────────────────────────

interface FlatExpense {
  id: string
  workOrder: string
  technician: string
  date: string
  expenseType: string
  amount: number
  quantity: number
  rate: number
  description: string
}

interface FlatTechnician {
  id: string
  technicianName: string
}

type ExpenseType = 'Per Diem' | 'Mileage' | 'Materials' | 'Equipment' | 'Other'
const EXPENSE_TYPES: ExpenseType[] = ['Per Diem', 'Mileage', 'Materials', 'Equipment', 'Other']

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

function fmtCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
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

// ── Add Expense Modal ────────────────────────────────────────────────

interface AddExpenseFormData {
  date: string
  technician: string
  expenseType: string
  amount: string
  quantity: string
  rate: string
  description: string
}

function AddExpenseModal({
  techs,
  onSave,
  onClose,
  saving,
}: {
  techs: FlatTechnician[]
  onSave: (form: AddExpenseFormData) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<AddExpenseFormData>({
    date: todayISO(),
    technician: '',
    expenseType: '',
    amount: '',
    quantity: '1',
    rate: '',
    description: '',
  })

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-brand-dark">Add Expense</h4>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Expense Type *</label>
                <select
                  value={form.expenseType}
                  onChange={e => setForm(f => ({ ...f, expenseType: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                >
                  <option value="">-- Select --</option>
                  {EXPENSE_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Technician</label>
              <select
                value={form.technician}
                onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}
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
                <label className="block text-xs font-medium text-brand-navy mb-1">Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  placeholder="1"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Rate</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rate}
                  onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the expense..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy resize-none"
              />
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
              disabled={saving || !form.expenseType || !form.date || !form.amount}
              onClick={() => onSave(form)}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function WorkOrderExpensesWidget({ record, object }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  // ── State ──
  const [expenses, setExpenses] = useState<FlatExpense[]>([])
  const [techMap, setTechMap] = useState<Map<string, FlatTechnician>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!workOrderId) return
    setError(null)

    try {
      const [expenseRecords, techRecords] = await Promise.all([
        recordsService.getRecords('WorkOrderExpense', { limit: 500 }),
        recordsService.getRecords('Technician', { limit: 500 }),
      ])

      // Flatten and filter expenses for this work order
      const flatExpenses = recordsService.flattenRecords(expenseRecords)
      const filtered: FlatExpense[] = flatExpenses
        .filter(r => getLookupId(r, 'workOrder') === workOrderId)
        .map(r => ({
          id: String(r.id),
          workOrder: getLookupId(r, 'workOrder'),
          technician: getLookupId(r, 'technician'),
          date: getStr(r, 'date'),
          expenseType: getStr(r, 'expenseType'),
          amount: getNum(r, 'amount'),
          quantity: getNum(r, 'quantity'),
          rate: getNum(r, 'rate'),
          description: getStr(r, 'description'),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))

      // Build technician lookup map
      const flatTechs = recordsService.flattenRecords(techRecords)
      const map = new Map<string, FlatTechnician>()
      for (const t of flatTechs) {
        map.set(String(t.id), {
          id: String(t.id),
          technicianName: getStr(t, 'technicianName') || getStr(t, 'name') || 'Unnamed',
        })
      }

      setExpenses(filtered)
      setTechMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Tech list for modal ──
  const techList = Array.from(techMap.values()).sort((a, b) =>
    a.technicianName.localeCompare(b.technicianName)
  )

  // ── Add expense ──
  const addExpense = async (form: AddExpenseFormData) => {
    if (!workOrderId) return
    setSaving(true)
    try {
      await recordsService.createRecord('WorkOrderExpense', {
        data: {
          workOrder: workOrderId,
          technician: form.technician || null,
          date: form.date,
          expenseType: form.expenseType,
          amount: form.amount ? Number(form.amount) : 0,
          quantity: form.quantity ? Number(form.quantity) : 1,
          rate: form.rate ? Number(form.rate) : 0,
          description: form.description || '',
        },
      })
      setShowAddModal(false)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add expense')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete expense ──
  const handleDelete = async (expenseId: string) => {
    setDeleting(true)
    try {
      await recordsService.deleteRecord('WorkOrderExpense', expenseId)
      setDeleteTarget(null)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete expense')
    } finally {
      setDeleting(false)
    }
  }

  // ── Total ──
  const totalAmount = expenses.reduce((s, e) => s + e.amount, 0)

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
          <Receipt className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-navy flex-1">
            Work Order Expenses
          </h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
          </span>
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
          {expenses.length === 0 ? (
            <div className="py-6 text-center">
              <Receipt className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-brand-gray">No expenses recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Date</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Tech</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Type</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Amount</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Qty</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Rate</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Description</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => {
                    const tech = techMap.get(expense.technician)
                    return (
                      <tr
                        key={expense.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-2 text-brand-dark">{expense.date || '\u2014'}</td>
                        <td className="py-2 px-2 text-brand-dark max-w-[100px] truncate">
                          {tech?.technicianName || '\u2014'}
                        </td>
                        <td className="py-2 px-2">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                            {expense.expenseType || '\u2014'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right text-brand-dark font-medium tabular-nums">
                          {fmtCurrency(expense.amount)}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {expense.quantity || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {expense.rate ? fmtCurrency(expense.rate) : '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-brand-gray max-w-[180px] truncate">
                          {expense.description || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(expense.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete expense"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* ── Totals row ── */}
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50/50">
                    <td colSpan={3} className="py-2 px-2 text-right text-xs font-semibold text-brand-navy">
                      Total
                    </td>
                    <td className="py-2 px-2 text-right text-xs font-semibold text-brand-navy tabular-nums">
                      {fmtCurrency(totalAmount)}
                    </td>
                    <td colSpan={4} className="py-2 px-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Add Expense Button ── */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-navy hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense
          </button>
        </div>
      </div>

      {/* ── Add Expense Modal ── */}
      {showAddModal && (
        <AddExpenseModal
          techs={techList}
          onSave={addExpense}
          onClose={() => setShowAddModal(false)}
          saving={saving}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-dark">Delete expense?</p>
              <p className="text-xs text-brand-gray">
                This permanently removes the expense record. Work order totals will be recalculated.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => handleDelete(deleteTarget)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
