'use client'

import React, { createContext, useContext, useRef, useCallback, useMemo } from 'react'

// ── Types ────────────────────────────────────────────────────────────────

export interface PendingWidgetRegistration {
  widgetId: string
  /** Returns true if this widget has unsaved data that needs to be persisted */
  hasPendingData: () => boolean
  /** Called after parent record creation — saves all pending child records */
  savePendingData: (parentRecordId: string) => Promise<void>
  /** Human-readable summary of pending items, e.g. "3 team member(s)" */
  getPendingSummary: () => string
}

export interface PendingWidgetSaveResult {
  success: boolean
  errors: string[]
}

export interface PendingWidgetContextValue {
  /** True when the form is in create mode (no record ID yet) */
  isCreateMode: boolean
  /** The parent object's API name, e.g. "Opportunity" */
  parentObjectApiName: string
  /** Register a widget that has pending data to save after parent creation */
  registerWidget: (registration: PendingWidgetRegistration) => void
  /** Unregister a widget (called on unmount) */
  unregisterWidget: (widgetId: string) => void
  /** Returns true if any registered widget has pending data */
  hasPendingData: () => boolean
  /** Save all pending widget data — called after parent record is created */
  saveAllPending: (parentRecordId: string) => Promise<PendingWidgetSaveResult>
}

// ── Context ──────────────────────────────────────────────────────────────

const PendingWidgetContext = createContext<PendingWidgetContextValue | null>(null)

// ── Manager hook (used by DynamicForm) ───────────────────────────────────

/**
 * Creates and manages the pending widget registrations. Used by DynamicForm
 * to both provide the context to child widgets AND access the save methods
 * in the submit handler.
 *
 * Returns:
 *  - `contextValue` — pass to `<PendingWidgetContext.Provider value={contextValue}>`
 *  - `hasPendingData` — check if any widget has unsaved data
 *  - `saveAllPending` — save all pending widget data after parent creation
 */
export function usePendingWidgetManager(
  isCreateMode: boolean,
  parentObjectApiName: string,
) {
  const registrationsRef = useRef<Map<string, PendingWidgetRegistration>>(new Map())

  const registerWidget = useCallback((reg: PendingWidgetRegistration) => {
    registrationsRef.current.set(reg.widgetId, reg)
  }, [])

  const unregisterWidget = useCallback((widgetId: string) => {
    registrationsRef.current.delete(widgetId)
  }, [])

  const hasPendingData = useCallback(() => {
    for (const reg of registrationsRef.current.values()) {
      if (reg.hasPendingData()) return true
    }
    return false
  }, [])

  const saveAllPending = useCallback(async (parentRecordId: string): Promise<PendingWidgetSaveResult> => {
    const errors: string[] = []
    for (const reg of registrationsRef.current.values()) {
      if (!reg.hasPendingData()) continue
      try {
        await reg.savePendingData(parentRecordId)
      } catch (err) {
        const message = err instanceof Error ? err.message : `Failed to save ${reg.getPendingSummary()}`
        errors.push(message)
        console.error(`[PendingWidgetContext] Failed to save pending data for widget "${reg.widgetId}":`, err)
      }
    }
    return { success: errors.length === 0, errors }
  }, [])

  const contextValue = useMemo<PendingWidgetContextValue>(
    () => ({
      isCreateMode,
      parentObjectApiName,
      registerWidget,
      unregisterWidget,
      hasPendingData,
      saveAllPending,
    }),
    [isCreateMode, parentObjectApiName, registerWidget, unregisterWidget, hasPendingData, saveAllPending],
  )

  return { contextValue, hasPendingData, saveAllPending }
}

// ── Provider (wraps children with the context) ──────────────────────────

export { PendingWidgetContext }

interface PendingWidgetProviderProps {
  value: PendingWidgetContextValue
  children: React.ReactNode
}

export function PendingWidgetProvider({ value, children }: PendingWidgetProviderProps) {
  return (
    <PendingWidgetContext.Provider value={value}>
      {children}
    </PendingWidgetContext.Provider>
  )
}

// ── Consumer hook (used by widgets) ──────────────────────────────────────

/**
 * Access the pending widget context. Returns null when not inside a
 * PendingWidgetProvider (e.g., on the record detail page). Widgets should
 * check `ctx?.isCreateMode` to decide whether to run in pending mode.
 */
export function usePendingWidget(): PendingWidgetContextValue | null {
  return useContext(PendingWidgetContext)
}
