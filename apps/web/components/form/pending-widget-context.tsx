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
  /**
   * Register an "is in incomplete state" predicate from a widget. The
   * wizard's section/full validation polls every registered predicate; if
   * any returns true, the wizard refuses to advance and surfaces an error.
   * Use case: TeamMemberSlot fields where the user has picked a contact
   * but not yet picked a role. The pool only ever holds complete rows
   * (PR #92's snapshot semantics), so the in-progress state has to be
   * reported separately for the wizard to gate Next.
   * Returns an unregister function for cleanup.
   */
  registerIncompleteCheck: (widgetId: string, isIncomplete: () => boolean) => () => void
  /** True if any registered widget reports an incomplete selection right now. */
  hasIncompleteWidgets: () => boolean
  /** Returns true if any registered widget has pending data */
  hasPendingData: () => boolean
  /**
   * Snapshot every widget that currently has pending data — used by the
   * parent form's submit handler BEFORE awaiting the parent POST. While the
   * parent POST awaits, the form may re-render and useEffect cleanups in
   * pending widgets (e.g. PendingTeamMemberPoolProvider) can fire and
   * unregister the widget before we ever get to flush its rows. Capturing
   * the registration objects synchronously up-front lets the form save
   * them after the await regardless of what happened to the registrations
   * map in between — the closures still point at live React refs for the
   * underlying row state.
   */
  snapshotPendingWidgets: () => PendingWidgetRegistration[]
  /** Save all pending widget data — called after parent record is created */
  saveAllPending: (parentRecordId: string) => Promise<PendingWidgetSaveResult>
  /**
   * Save a previously-captured snapshot of widgets. Useful when the parent
   * snapshot-ed widgets BEFORE its own awaited POST and wants to flush them
   * after, immune to any mid-await unregistration.
   */
  saveSnapshot: (
    widgets: PendingWidgetRegistration[],
    parentRecordId: string,
  ) => Promise<PendingWidgetSaveResult>
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

  // Incomplete-widgets registry. Lives on this outer context (not the inner
  // TeamMember pool) so the DynamicForm — which sits above the inner pool —
  // can poll it during wizard validation. Each consumer registers a
  // predicate; hasIncompleteWidgets() returns true if any predicate fires.
  const incompleteChecksRef = useRef<Map<string, () => boolean>>(new Map())

  const registerIncompleteCheck = useCallback(
    (widgetId: string, isIncomplete: () => boolean) => {
      incompleteChecksRef.current.set(widgetId, isIncomplete)
      return () => {
        incompleteChecksRef.current.delete(widgetId)
      }
    },
    [],
  )

  const hasIncompleteWidgets = useCallback((): boolean => {
    for (const fn of incompleteChecksRef.current.values()) {
      try {
        if (fn()) return true
      } catch {
        // A misbehaving widget's check shouldn't crash the wizard.
      }
    }
    return false
  }, [])

  const snapshotPendingWidgets = useCallback((): PendingWidgetRegistration[] => {
    const out: PendingWidgetRegistration[] = []
    for (const reg of registrationsRef.current.values()) {
      if (reg.hasPendingData()) out.push(reg)
    }
    return out
  }, [])

  const saveSnapshot = useCallback(
    async (
      widgets: PendingWidgetRegistration[],
      parentRecordId: string,
    ): Promise<PendingWidgetSaveResult> => {
      const errors: string[] = []
      for (const reg of widgets) {
        // hasPendingData re-check: if the widget already flushed (e.g. user
        // raced two save paths) we shouldn't re-POST.
        if (!reg.hasPendingData()) continue
        try {
          await reg.savePendingData(parentRecordId)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : `Failed to save ${reg.getPendingSummary()}`
          errors.push(message)
          console.error(
            `[PendingWidgetContext] Failed to save pending data for widget "${reg.widgetId}":`,
            err,
          )
        }
      }
      return { success: errors.length === 0, errors }
    },
    [],
  )

  const saveAllPending = useCallback(
    async (parentRecordId: string): Promise<PendingWidgetSaveResult> => {
      return saveSnapshot(Array.from(registrationsRef.current.values()), parentRecordId)
    },
    [saveSnapshot],
  )

  const contextValue = useMemo<PendingWidgetContextValue>(
    () => ({
      isCreateMode,
      parentObjectApiName,
      registerWidget,
      unregisterWidget,
      registerIncompleteCheck,
      hasIncompleteWidgets,
      hasPendingData,
      snapshotPendingWidgets,
      saveAllPending,
      saveSnapshot,
    }),
    [
      isCreateMode,
      parentObjectApiName,
      registerWidget,
      unregisterWidget,
      registerIncompleteCheck,
      hasIncompleteWidgets,
      hasPendingData,
      snapshotPendingWidgets,
      saveAllPending,
      saveSnapshot,
    ],
  )

  return {
    contextValue,
    hasPendingData,
    hasIncompleteWidgets,
    snapshotPendingWidgets,
    saveAllPending,
    saveSnapshot,
  }
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
