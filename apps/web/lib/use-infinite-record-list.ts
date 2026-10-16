'use client'

import { createElement, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { apiClient } from './api-client'
import { recordsService } from './records-service'

const PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 50

interface RecordWithId {
  id: string
}

interface UseInfiniteRecordListOptions<T extends RecordWithId> {
  objectApiName: string
  records: T[]
  setRecords: Dispatch<SetStateAction<T[]>>
  loading: boolean
  enabled: boolean
  normalize?: (records: any[]) => T[]
}

function defaultNormalize<T extends RecordWithId>(records: any[]): T[] {
  return recordsService.flattenRecords(records) as T[]
}

export function useInfiniteRecordList<T extends RecordWithId>({
  objectApiName,
  records,
  setRecords,
  loading,
  enabled,
  normalize,
}: UseInfiniteRecordListOptions<T>) {
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const initialPageLoadedRef = useRef(false)
  const requestInFlightRef = useRef(false)
  const normalizeRef = useRef(normalize ?? defaultNormalize<T>)
  normalizeRef.current = normalize ?? defaultNormalize<T>

  useEffect(() => {
    if (loading) {
      initialPageLoadedRef.current = false
      offsetRef.current = 0
      setHasMore(true)
      setLoadError(false)
      return
    }
    if (!initialPageLoadedRef.current) {
      offsetRef.current = records.length
      initialPageLoadedRef.current = true
      setHasMore(records.length >= DEFAULT_PAGE_SIZE)
    }
  }, [loading, records.length])

  const loadMore = useCallback(async () => {
    if (!enabled || loading || !hasMore || requestInFlightRef.current) return
    requestInFlightRef.current = true
    setLoadingMore(true)
    setLoadError(false)
    try {
        const page = await apiClient.getRecords(objectApiName, { limit: PAGE_SIZE, offset: offsetRef.current })
      const normalizedPage = normalizeRef.current(page)
      setRecords((current) => {
        const currentIds = new Set(current.map((record) => record.id))
        return [...current, ...normalizedPage.filter((record) => !currentIds.has(record.id))]
      })
      offsetRef.current += page.length
      setHasMore(page.length === PAGE_SIZE)
    } catch (error) {
      console.error(`Failed to load more ${objectApiName} records:`, error)
      setLoadError(true)
    } finally {
      requestInFlightRef.current = false
      setLoadingMore(false)
    }
  }, [enabled, hasMore, loading, objectApiName, records.length, setRecords])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !enabled || loading || !hasMore || loadingMore || loadError
      || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore()
    }, { root: null, rootMargin: '400px 0px' })
    return () => observer.disconnect()
  }, [enabled, hasMore, loadError, loadMore, loading, loadingMore])

  const footer = createElement('div', {
    ref: sentinelRef,
    'aria-live': 'polite',
    className: 'flex min-h-10 items-center justify-center py-3 text-sm text-gray-500',
  },
  enabled && loadingMore ? 'Loading more records...' : null,
  enabled && loadError
    ? createElement('button', {
        type: 'button',
        onClick: () => void loadMore(),
        className: 'text-brand-navy underline',
      }, 'Could not load more records. Retry')
    : null,
  enabled && !hasMore && records.length > 0 ? 'All records loaded.' : null)

  return { footer }
}