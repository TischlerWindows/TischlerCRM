import { useState, useCallback, useEffect } from 'react'
import { apiClient } from '@/lib/api-client'

const BASE = '/controllers/installation-grid'

interface InstallationData {
  installation: any
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  weekCount: number
}

interface DirtyState {
  costs: Record<string, Record<string, number>>
  techExpenses: Record<string, Record<string, number>>
}

export function useInstallationData(installationId: string | undefined) {
  const [data, setData] = useState<InstallationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState<DirtyState>({ costs: {}, techExpenses: {} })

  const isDirty = Object.keys(dirty.costs).length > 0 || Object.keys(dirty.techExpenses).length > 0

  const load = useCallback(async () => {
    if (!installationId) return
    setLoading(true)
    setError(null)
    try {
      const result = await apiClient.get<InstallationData>(`${BASE}/${installationId}/data`)
      setData(result)
    } catch (err: any) {
      setError(err.message || 'Failed to load installation data')
    } finally {
      setLoading(false)
    }
  }, [installationId])

  useEffect(() => { load() }, [load])

  const setCostField = useCallback((recordId: string, field: string, value: number) => {
    setDirty(prev => ({
      ...prev,
      costs: { ...prev.costs, [recordId]: { ...prev.costs[recordId], [field]: value } },
    }))
  }, [])

  const setTechExpenseField = useCallback((recordId: string, field: string, value: number) => {
    setDirty(prev => ({
      ...prev,
      techExpenses: { ...prev.techExpenses, [recordId]: { ...prev.techExpenses[recordId], [field]: value } },
    }))
  }, [])

  const save = useCallback(async () => {
    if (!installationId) return
    setSaving(true)
    setError(null)
    try {
      const costUpdates = Object.entries(dirty.costs).map(([id, fields]) => ({ id, ...fields }))
      if (costUpdates.length > 0) {
        await apiClient.request(`${BASE}/${installationId}/costs`, {
          method: 'PUT',
          body: JSON.stringify({ updates: costUpdates }),
        })
      }
      const expenseUpdates = Object.entries(dirty.techExpenses).map(([id, fields]) => ({ id, ...fields }))
      if (expenseUpdates.length > 0) {
        await apiClient.request(`${BASE}/${installationId}/tech-expenses`, {
          method: 'PUT',
          body: JSON.stringify({ updates: expenseUpdates }),
        })
      }
      await apiClient.request(`${BASE}/${installationId}/recalculate`, { method: 'POST' })
      setDirty({ costs: {}, techExpenses: {} })
      await load()
    } catch (err: any) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [installationId, dirty, load])

  const addWeek = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/weeks/add`, { method: 'POST' })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to add week') }
  }, [installationId, load])

  const removeWeek = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/weeks/remove`, { method: 'POST' })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to remove week') }
  }, [installationId, load])

  const recalculate = useCallback(async () => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/recalculate`, { method: 'POST' })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to recalculate') }
  }, [installationId, load])

  const assignTechnician = useCallback(async (technicianId: string) => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/technicians`, {
        method: 'POST',
        body: JSON.stringify({ technicianId }),
      })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to assign technician') }
  }, [installationId, load])

  const removeTechnician = useCallback(async (junctionId: string) => {
    if (!installationId) return
    try {
      await apiClient.request(`${BASE}/${installationId}/technicians/${junctionId}`, { method: 'DELETE' })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to remove technician') }
  }, [installationId, load])

  return {
    data, loading, error, saving, isDirty, dirty,
    setCostField, setTechExpenseField,
    save, addWeek, removeWeek, recalculate,
    assignTechnician, removeTechnician, reload: load,
  }
}
