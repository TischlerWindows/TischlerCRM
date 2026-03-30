'use client'
import { useState, useEffect } from 'react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'

export default function RelatedListWidget({ config, record, displayMode }: WidgetProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    objectApiName,
    columns = [],
    linkField,
    sortField,
    sortDirection = 'desc',
    rowLimit = 10,
  } = config as {
    objectApiName?: string
    columns?: string[]
    linkField?: string
    sortField?: string
    sortDirection?: 'asc' | 'desc'
    rowLimit?: number
  }

  useEffect(() => {
    if (!objectApiName || !linkField || !record.id) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      [`filter[${linkField}]`]: String(record.id),
      limit: String(rowLimit),
      ...(sortField ? { orderBy: sortField, orderDir: sortDirection } : {}),
    })

    apiClient.get<Record<string, unknown>[]>(`/objects/${objectApiName}/records?${params}`)
      .then(data => {
        setRows(Array.isArray(data) ? data : [])
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [objectApiName, linkField, sortField, sortDirection, rowLimit, record.id])

  if (!objectApiName || !linkField) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-xs text-brand-gray text-center">
        Configure this widget in the properties panel
      </div>
    )
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
        {[1, 2, 3].map(i => <div key={i} className="h-3 bg-gray-50 rounded mb-2" />)}
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">{error}</div>
  }

  const displayColumns = (columns as string[]).length > 0 ? (columns as string[]) : ['name']

  const getCellValue = (row: Record<string, unknown>, col: string): string => {
    const val = (row.data as Record<string, unknown>)?.[col] ?? row[col]
    return val !== undefined && val !== null ? String(val) : '—'
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${displayMode === 'full' ? 'w-full' : ''}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-dark">{objectApiName}</h3>
        <span className="text-xs text-brand-gray">{rows.length} records</span>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-xs text-brand-gray text-center">No related records</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              {displayColumns.map(col => (
                <th key={col} className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                {displayColumns.map(col => (
                  <td key={col} className="px-4 py-2 text-brand-dark">{getCellValue(row, col)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
