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
        await apiClient.put(`${BASE}/${installationId}/costs`, { updates: costUpdates })
      }
      const expenseUpdates = Object.entries(dirty.techExpenses).map(([id, fields]) => ({ id, ...fields }))
      if (expenseUpdates.length > 0) {
        await apiClient.put(`${BASE}/${installationId}/tech-expenses`, { updates: expenseUpdates })
      }
      await apiClient.post(`${BASE}/${installationId}/recalculate`)
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
    setError(null)
    try {
      await apiClient.post(`${BASE}/${installationId}/weeks/add`)
      await load()
    } catch (err: any) { setError(err.message || 'Failed to add week') }
  }, [installationId, load])

  const removeWeek = useCallback(async () => {
    if (!installationId) return
    setError(null)
    try {
      await apiClient.post(`${BASE}/${installationId}/weeks/remove`)
      await load()
    } catch (err: any) { setError(err.message || 'Failed to remove week') }
  }, [installationId, load])

  const recalculate = useCallback(async () => {
    if (!installationId) return
    setError(null)
    try {
      await apiClient.post(`${BASE}/${installationId}/recalculate`)
      await load()
    } catch (err: any) { setError(err.message || 'Failed to recalculate') }
  }, [installationId, load])

  const assignTechnician = useCallback(async (technicianId: string) => {
    if (!installationId) return
    setError(null)
    try {
      await apiClient.post(`${BASE}/${installationId}/technicians`, { technicianId })
      await load()
    } catch (err: any) { setError(err.message || 'Failed to assign technician') }
  }, [installationId, load])

  const removeTechnician = useCallback(async (junctionId: string) => {
    if (!installationId) return
    setError(null)
    try {
      await apiClient.delete(`${BASE}/${installationId}/technicians/${junctionId}`)
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
