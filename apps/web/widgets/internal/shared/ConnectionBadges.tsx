'use client'

import Link from 'next/link'
import { CornerDownRight } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

export interface ViaSource {
  objectApiName: string
  recordId: string
  recordName: string
  /** Optional href; if omitted, the Via badge renders as plain text. */
  href?: string
}

export interface ConnectionFlags {
  primary?: boolean
  contractHolder?: boolean
  quoteRecipient?: boolean
}

interface ConnectionBadgesProps {
  /** Single Role (job function) — convenience prop for callers that show one TM row. */
  role?: string
  /**
   * Multiple roles — used by merged-row callers (e.g. Rollup tiles aggregating
   * multiple TM rows for the same person). When this is non-empty it takes
   * precedence over `role`; an empty array falls through to `role`.
   */
  roles?: string[]
  /** Per-record flags — appear as outlined semantic-color pills. */
  flags?: ConnectionFlags
  /** Indirect-rollup sources. Shown as small "↳ via {Name}" chips. */
  viaSources?: ViaSource[]
  /** Cap inline via-sources before collapsing the rest into "+N more". Default 2. */
  maxVisibleVia?: number
  /** Optional className for the outer wrapper. */
  className?: string
}

// ── Atoms ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-navy/10 text-brand-navy dark:bg-brand-navy/30 dark:text-blue-200">
      {role}
    </span>
  )
}

function FlagBadge({
  label,
  tone,
}: {
  label: string
  tone: 'green' | 'orange' | 'purple'
}) {
  const cls =
    tone === 'green'
      ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300'
      : tone === 'orange'
        ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        : 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  )
}

function ViaBadge({ source }: { source: ViaSource }) {
  const inner = (
    <span className="inline-flex items-center gap-0.5 text-[11px] text-brand-gray hover:text-brand-navy">
      <CornerDownRight className="w-3 h-3 shrink-0" />
      <span className="truncate">via {source.recordName}</span>
    </span>
  )
  if (source.href) {
    return (
      <Link href={source.href} className="hover:underline">
        {inner}
      </Link>
    )
  }
  return inner
}

// ── Public component ───────────────────────────────────────────────────

/**
 * Renders the canonical badge cluster for a Connection: Role · Flags · Via sources.
 *
 * Visual taxonomy:
 *   - Role (filled navy pill) — job function, always first when present
 *   - Flags (outlined semantic pills) — per-record state, separated from Role
 *     by a thin hairline so the filled-vs-outlined rhythm reads as
 *     "job function" vs "business role on this record"
 *   - Via (text + corner-down-right icon) — indirect-rollup sources, drawn
 *     subtly so they don't compete with role/flag identity
 *
 * Returns null when there is nothing to render.
 */
export function ConnectionBadges({
  role,
  roles,
  flags = {},
  viaSources = [],
  maxVisibleVia = 2,
  className,
}: ConnectionBadgesProps) {
  const allRoles = roles && roles.length > 0 ? roles : role ? [role] : []
  const hasRole = allRoles.length > 0
  const hasFlags = !!(flags.primary || flags.contractHolder || flags.quoteRecipient)
  const hasVia = viaSources.length > 0

  if (!hasRole && !hasFlags && !hasVia) return null

  const visibleVia = viaSources.slice(0, maxVisibleVia)
  const hiddenViaCount = viaSources.length - visibleVia.length

  return (
    <div className={`flex flex-wrap items-center gap-1 mt-0.5 ${className ?? ''}`}>
      {allRoles.map(r => (
        <RoleBadge key={r} role={r} />
      ))}

      {hasRole && hasFlags && (
        <span aria-hidden className="inline-block h-3 border-l border-gray-200 dark:border-gray-700 mx-0.5" />
      )}

      {flags.primary && <FlagBadge label="Primary" tone="green" />}
      {flags.contractHolder && <FlagBadge label="Contract Holder" tone="orange" />}
      {flags.quoteRecipient && <FlagBadge label="Quote Recipient" tone="purple" />}

      {hasVia && (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ml-1">
          {visibleVia.map(src => (
            <ViaBadge key={`${src.objectApiName}:${src.recordId}`} source={src} />
          ))}
          {hiddenViaCount > 0 && (
            <span className="text-[11px] text-brand-gray">+{hiddenViaCount} more</span>
          )}
        </span>
      )}
    </div>
  )
}
