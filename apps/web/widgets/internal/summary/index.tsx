'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  FileText,
  Pencil,
  Trash2,
  Star,
  CalendarDays,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSetting, setSetting } from '@/lib/preferences'
import { apiClient } from '@/lib/api-client'
import type { WidgetProps } from '@/lib/widgets/types'

interface Summary {
  id: string
  name: string
  salesman: string
  opportunityNumber: string
  linkedOpportunityId?: string
  jobType: string
  estimator: string
  date: string
  address: string
  quoteType: 'first' | 'requote' | ''
  requoteDescription: string
  rows: any[]
  doorRows: any[]
  shadeBoxesNoSideTrim: { totalPerUnit: string; totalPerPosition: string }
  shadeBoxesWithSideTrim: { totalPerUnit: string; totalPerPosition: string }
  magneticContact: { totalPerUnit: string; totalPerPosition: string }
  quoteTotals: {
    euroWindows: { full: string; pct: string; final: string; finalAdj: string }
    doubleHung: { full: string; pct: string; final: string; finalAdj: string }
    euroDoors: { full: string; pct: string; final: string; finalAdj: string }
  }
  addOns?: any
  product: string
  productType: string
  productTypeOptions: string[]
  woodType: string
  finish: string
  glassType: string
  muntinType: string
  spacerBars: string
  spacerBarColors: string
  projectContains: string[]
  createdBy: string
  createdAt: string
  lastModifiedBy: string
  lastModifiedAt: string
  isFavorite?: boolean
  /** Which page created this record — determines which page re-opens it for editing. */
  summaryType?: string
}

export default function SummaryWidget({ record, object }: WidgetProps) {
  const router = useRouter()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [allSummaries, setAllSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const recordId = (record?.id ?? record?.Id ?? '') as string
  const oppName =
    (record?.Opportunity__opportunityName ?? record?.opportunityName ?? '') as string
  const oppNumber =
    (record?.Opportunity__opportunityNumber ?? record?.opportunityNumber ?? '') as string

  const loadSummaries = useCallback(async () => {
    const stored = await getSetting<Summary[]>('summaries')
    const all = stored ?? []
    setAllSummaries(all)
    // Filter to summaries linked to this record
    const linked = all.filter(
      (s) =>
        s.linkedOpportunityId === recordId ||
        (recordId && s.linkedOpportunityId === recordId),
    )
    setSummaries(linked)
    setLoading(false)
  }, [recordId])

  useEffect(() => {
    loadSummaries()
  }, [loadSummaries])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = (type: 'tischler' | 'arcadia') => {
    setDropdownOpen(false)
    const route = type === 'arcadia' ? '/arcadia-summary' : '/summary'
    const params = new URLSearchParams({
      fromOpportunity: recordId,
      opportunityName: oppName,
      opportunityNumber: oppNumber,
    })
    router.push(`${route}?${params.toString()}`)
  }

  const handleOpen = (summaryId: string) => {
    // Navigate to the summary page and auto-open this summary for editing.
    // MUST route by the summary's own summaryType, not always /summary —
    // otherwise an Arcadia summary opens in the Tischler page's edit modal,
    // which then force-stamps summaryType: 'tischler' on save, silently
    // converting it (visible as "Edit Tischler Fensterwerk Summary" title).
    const summary = allSummaries.find((s) => s.id === summaryId)
    const route = summary?.summaryType === 'arcadia' ? '/arcadia-summary' : '/summary'
    const params = new URLSearchParams({
      editSummary: summaryId,
    })
    router.push(`${route}?${params.toString()}`)
  }

  const handleDelete = async (summaryId: string) => {
    if (!confirm('Are you sure you want to delete this summary?')) return
    const updated = allSummaries.filter((s) => s.id !== summaryId)
    setAllSummaries(updated)
    setSummaries(updated.filter((s) => s.linkedOpportunityId === recordId))
    await setSetting('summaries', updated)
    apiClient.delete(`/product-log/${summaryId}`).catch(() => {})
  }

  const handleToggleFavorite = async (summaryId: string) => {
    const updated = allSummaries.map((s) =>
      s.id === summaryId ? { ...s, isFavorite: !s.isFavorite } : s,
    )
    setAllSummaries(updated)
    setSummaries(updated.filter((s) => s.linkedOpportunityId === recordId))
    await setSetting('summaries', updated)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-gray-200 mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-2/3 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">
            Summaries
          </span>
          {summaries.length > 0 && (
            <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-[10px] font-medium text-brand-navy">
              {summaries.length}
            </span>
          )}
        </div>
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy/90 transition-colors"
          >
            + New Summary
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', dropdownOpen && 'rotate-180')} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => handleCreate('tischler')}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors"
              >
                Tischler Fensterwerk Summary
              </button>
              <button
                type="button"
                onClick={() => handleCreate('arcadia')}
                className="w-full px-4 py-2.5 text-left text-xs font-medium text-gray-800 hover:bg-gray-50 transition-colors border-t border-gray-100"
              >
                Arcadia Summary
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {summaries.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No summaries yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Create a summary to estimate windows and doors for this opportunity.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {summaries.map((summary) => (
            <div
              key={summary.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-gray-50/80 transition-colors"
            >
              {/* Favorite star */}
              <button
                type="button"
                onClick={() => handleToggleFavorite(summary.id)}
                className={cn(
                  'shrink-0 p-0.5 rounded transition-colors',
                  summary.isFavorite
                    ? 'text-amber-400'
                    : 'text-gray-300 hover:text-amber-400',
                )}
                title={summary.isFavorite ? 'Remove favorite' : 'Add favorite'}
              >
                <Star
                  className={cn(
                    'h-3.5 w-3.5',
                    summary.isFavorite && 'fill-current',
                  )}
                />
              </button>

              {/* Main content — clickable */}
              <button
                type="button"
                onClick={() => handleOpen(summary.id)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-medium text-gray-900 truncate">
                  {summary.name || 'Untitled Summary'}
                </p>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-gray-500">
                  {summary.jobType && (
                    <span className="truncate">{summary.jobType}</span>
                  )}
                  {summary.salesman && (
                    <span className="flex items-center gap-1 truncate">
                      <User className="h-3 w-3" />
                      {summary.salesman}
                    </span>
                  )}
                  {summary.date && (
                    <span className="flex items-center gap-1 shrink-0">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(summary.date)}
                    </span>
                  )}
                  <span className="shrink-0">
                    {summary.rows?.filter((r: any) => r.tusPosition || r.qty).length || 0} windows
                    {' · '}
                    {summary.doorRows?.filter((r: any) => r.tusPosition || r.qty).length || 0} doors
                  </span>
                </div>
              </button>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpen(summary.id)}
                  className="p-1.5 rounded-md hover:bg-gray-200/60 text-gray-500 hover:text-brand-navy transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(summary.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
