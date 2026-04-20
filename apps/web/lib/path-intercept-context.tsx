'use client'

import React, { createContext, useContext } from 'react'

// ── Types ────────────────────────────────────────────────────────────────

/**
 * Callback the Path widget calls before committing a stage transition.
 *
 * @param stageName  The display name of the stage being transitioned TO
 *                   (e.g. "On Hold", "Cancelled").
 * @returns          A Promise that resolves with extra fields to merge into
 *                   the update payload, or `null` to abort the transition.
 *
 * The Path widget calls this before calling apiClient.updateRecord.
 * If the promise resolves with `null`, the transition is cancelled.
 * If the promise resolves with a record (even `{}`), the transition proceeds.
 */
export type PathInterceptCallback = (
  stageName: string
) => Promise<Record<string, string> | null>

export interface PathInterceptContextValue {
  onBeforeAdvance: PathInterceptCallback
}

// ── Context ──────────────────────────────────────────────────────────────

const PathInterceptContext = createContext<PathInterceptContextValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────

export function PathInterceptProvider({
  onBeforeAdvance,
  children,
}: {
  onBeforeAdvance: PathInterceptCallback
  children: React.ReactNode
}) {
  return (
    <PathInterceptContext.Provider value={{ onBeforeAdvance }}>
      {children}
    </PathInterceptContext.Provider>
  )
}

// ── Consumer hook ─────────────────────────────────────────────────────────

/**
 * Returns the path intercept context if provided by an ancestor.
 * Returns null on pages that have no interception (all objects except
 * WorkOrder — the Path widget proceeds normally).
 */
export function usePathIntercept(): PathInterceptContextValue | null {
  return useContext(PathInterceptContext)
}
