'use client'
import { Plus, Minus, Users, RefreshCw, Save, Loader2 } from 'lucide-react'

interface ToolbarProps {
  startDate: string | null
  endDate: string | null
  weekCount: number
  isDirty: boolean
  saving: boolean
  onAddWeek: () => void
  onRemoveWeek: () => void
  onManageTechnicians: () => void
  onRecalculate: () => void
  onSave: () => void
}

export function Toolbar({
  startDate, endDate, weekCount, isDirty, saving,
  onAddWeek, onRemoveWeek, onManageTechnicians, onRecalculate, onSave,
}: ToolbarProps) {
  const formatDate = (d: string | null) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg flex-wrap">
      <span className="text-xs text-gray-500">
        <span className="font-semibold">Dates:</span> {formatDate(startDate)} – {formatDate(endDate)}
      </span>
      <span className="text-xs text-gray-500 bg-green-50 px-2 py-0.5 rounded">
        {weekCount} week{weekCount !== 1 ? 's' : ''}
      </span>
      <div className="flex gap-1">
        <button onClick={onAddWeek} className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1">
          <Plus className="w-3 h-3" /> Week
        </button>
        <button onClick={onRemoveWeek} className="text-[10px] px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1">
          <Minus className="w-3 h-3" /> Week
        </button>
      </div>
      <div className="flex-1" />
      <button onClick={onManageTechnicians} className="text-[10px] px-2 py-1 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1">
        <Users className="w-3 h-3" /> Manage Technicians
      </button>
      <button onClick={onRecalculate} className="text-[10px] px-2 py-1 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 transition-colors flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Recalculate
      </button>
      <button onClick={onSave} disabled={!isDirty && !saving} className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold relative">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Save
        {isDirty && !saving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
      </button>
    </div>
  )
}
