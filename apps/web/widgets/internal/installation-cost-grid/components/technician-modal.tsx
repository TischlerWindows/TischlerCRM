'use client'
import { useState, useEffect } from 'react'
import { X, Trash2, Plus, Loader2, Search } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { fmt } from '../utils/calculations'

interface TechnicianModalProps {
  installationId: string
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: any[]
  }>
  onAssign: (technicianId: string) => Promise<void>
  onRemove: (junctionId: string) => Promise<void>
  onClose: () => void
}

interface TechnicianRecord {
  id: string
  data: { technicianName?: string; hourlyRate?: number; status?: string }
}

export function TechnicianModal({ installationId, techExpenses, onAssign, onRemove, onClose }: TechnicianModalProps) {
  const [allTechnicians, setAllTechnicians] = useState<TechnicianRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRate, setNewRate] = useState('')
  const [creating, setCreating] = useState(false)

  const assignedTechIds = new Set(Object.values(techExpenses).map(te => te.technician.id))

  useEffect(() => { loadTechnicians() }, [])

  const loadTechnicians = async () => {
    try {
      const result = await apiClient.get<{ records: TechnicianRecord[] }>('/objects/Technician/records')
      setAllTechnicians(result.records || [])
    } catch {
      setAllTechnicians([])
    } finally {
      setLoading(false)
    }
  }

  const handleAssign = async (techId: string) => {
    setAssigning(true)
    try { await onAssign(techId) } finally { setAssigning(false) }
  }

  const handleRemove = async (junctionId: string) => {
    if (!confirm('Remove this technician? Their expense records for this installation will be deleted.')) return
    setRemoving(junctionId)
    try { await onRemove(junctionId) } finally { setRemoving(null) }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newRate.trim()) return
    setCreating(true)
    try {
      const result = await apiClient.request('/objects/Technician/records', {
        method: 'POST',
        body: JSON.stringify({ technicianName: newName.trim(), hourlyRate: parseFloat(newRate) || 0, status: 'Active' }),
      }) as any
      if (result?.id) await onAssign(result.id)
      setNewName('')
      setNewRate('')
      setShowCreate(false)
      await loadTechnicians()
    } finally {
      setCreating(false)
    }
  }

  const available = allTechnicians.filter(t => {
    if (assignedTechIds.has(t.id)) return false
    const name = (t.data?.technicianName ?? '').toLowerCase()
    if (searchQuery && !name.includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-dark">Manage Technicians</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Assigned ({Object.keys(techExpenses).length})</h4>
            {Object.entries(techExpenses).length === 0 ? (
              <p className="text-xs text-gray-400">No technicians assigned</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(techExpenses).map(([junctionId, { technician }]) => (
                  <div key={junctionId} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                    <div>
                      <span className="text-xs font-medium text-brand-dark">{technician.name}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{fmt(technician.assignedHourlyRate)}/hr</span>
                    </div>
                    <button onClick={() => handleRemove(junctionId)} disabled={removing === junctionId} className="text-red-400 hover:text-red-600 disabled:opacity-50">
                      {removing === junctionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Available</h4>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search technicians..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none" />
            </div>
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
            ) : available.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No available technicians</p>
            ) : (
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {available.map(tech => (
                  <div key={tech.id} className="flex items-center justify-between px-3 py-2 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div>
                      <span className="text-xs font-medium">{tech.data?.technicianName}</span>
                      <span className="text-[10px] text-gray-500 ml-2">{fmt(tech.data?.hourlyRate ?? 0)}/hr</span>
                    </div>
                    <button onClick={() => handleAssign(tech.id)} disabled={assigning}
                      className="text-[10px] px-2 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 disabled:opacity-50 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            {!showCreate ? (
              <button onClick={() => setShowCreate(true)} className="text-xs text-brand-navy hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Create New Technician
              </button>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">New Technician</h4>
                <input type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-brand-navy outline-none" />
                <input type="number" placeholder="Hourly Rate" step="0.01" value={newRate} onChange={e => setNewRate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:border-brand-navy outline-none" />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={creating || !newName.trim() || !newRate.trim()}
                    className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded disabled:opacity-50 flex items-center gap-1">
                    {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Create & Assign
                  </button>
                  <button onClick={() => setShowCreate(false)} className="text-[10px] px-3 py-1 text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
