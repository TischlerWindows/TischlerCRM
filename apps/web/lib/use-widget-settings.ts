'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { getInternalRegistrationByType } from '@/lib/widgets/registry-loader'
import type { WidgetConfig } from '@/lib/schema'

export interface WidgetSetting {
  widgetId: string
  kind?: 'external' | 'internal'
  enabled: boolean
}

let cachedPromise: Promise<WidgetSetting[]> | null = null
let cachedValue: WidgetSetting[] | null = null

function fetchWidgetSettings(): Promise<WidgetSetting[]> {
  if (cachedPromise) return cachedPromise
  cachedPromise = apiClient
    .getWidgetSettings()
    .then((list) => {
      cachedValue = list as WidgetSetting[]
      return cachedValue
    })
    .catch((err) => {
      cachedPromise = null
      throw err
    })
  return cachedPromise
}

export function invalidateWidgetSettingsCache() {
  cachedPromise = null
  cachedValue = null
}

/**
 * Loads the per-org widget enablement map once and caches it across the app.
 * Returns a Set of enabled widget manifest ids.
 */
export function useEnabledWidgetIds(): {
  ids: Set<string>
  loading: boolean
  error: Error | null
} {
  const [ids, setIds] = useState<Set<string>>(
    () => new Set((cachedValue ?? []).filter((s) => s.enabled).map((s) => s.widgetId)),
  )
  const [loading, setLoading] = useState(cachedValue === null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchWidgetSettings()
      .then((list) => {
        if (cancelled) return
        setIds(new Set(list.filter((s) => s.enabled).map((s) => s.widgetId)))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err : new Error(String(err)))
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ids, loading, error }
}

/**
 * Given a PageWidget's `config`, return the manifest id used for enablement lookups.
 * External widgets key on the externalWidgetId; internal widgets key on their
 * manifest id (derived from the registration).
 */
export function widgetIdForConfig(config: WidgetConfig): string | null {
  if (config.type === 'ExternalWidget') return config.externalWidgetId
  const reg = getInternalRegistrationByType(config.type)
  return reg?.manifest.id ?? null
}

export const useWidgetSettingsCacheInvalidate = () => useCallback(invalidateWidgetSettingsCache, [])
