'use client'

import React from 'react'
import { ChevronDown } from 'lucide-react'

/**
 * Featured roles — surfaced as one-click chip buttons inline. These mirror
 * the four prominent role slots on the Property page (Primary Contact,
 * General Contractor, Contract Holder, Architect/Designer); since "Primary"
 * and "Contract Holder" are flags rather than roles, we substitute the most
 * common roles a user assigns to those slots: Homeowner and Subcontractor.
 *
 * The remaining picklist values stay accessible via the "More roles…"
 * dropdown so nothing is hidden.
 */
export const FEATURED_ROLES = [
  'Homeowner',
  'General Contractor',
  'Subcontractor',
  'Architect / Designer',
] as const

interface RolePickerProps {
  /** Currently selected role (empty string when none). */
  value: string
  onChange: (next: string) => void
  /** Full picklist of role values — typically loaded from the TeamMember schema. */
  roleValues: readonly string[]
  disabled?: boolean
}

/**
 * Inline-add-row role picker. Exposes the four most-common roles as chip
 * buttons + a dropdown labeled "More roles…" for the rest. Visually
 * distinguished from the multi-select Flag toggles next to it (Primary /
 * Contract / Quote) by border style — chips render single-select.
 *
 * Used by both `InlineAddConnectionRow` and `InlineConnectToRecordRow` to
 * keep the role-selection UX identical across the two connection-add flows.
 */
export function RolePicker({ value, onChange, roleValues, disabled }: RolePickerProps) {
  // Featured roles that actually exist in the live picklist (drop any that
  // were renamed/removed so we don't render dead chips). The picklist type
  // is `readonly string[]`; the FEATURED_ROLES tuple narrows to its literal
  // values so we widen via Set<string> for the membership checks.
  const featuredSet: ReadonlySet<string> = new Set(FEATURED_ROLES)
  const visibleFeatured = FEATURED_ROLES.filter((r) => roleValues.includes(r))
  const nonFeaturedRoles = roleValues.filter((r) => !featuredSet.has(r))
  const isFeaturedActive = featuredSet.has(value)

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {visibleFeatured.map(role => {
        const pressed = value === role
        return (
          <button
            key={role}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(pressed ? '' : role)}
            disabled={disabled}
            className={`px-2 h-7 rounded text-[10px] font-medium border-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand-navy/30 focus-visible:outline-none disabled:opacity-50 ${
              pressed
                ? 'bg-brand-navy border-brand-navy text-white shadow-sm'
                : 'bg-white dark:bg-brand-dark border-brand-navy/40 dark:border-brand-navy/60 text-brand-navy dark:text-gray-100 shadow-sm hover:border-brand-navy hover:bg-brand-navy/5'
            }`}
          >
            {role}
          </button>
        )
      })}
      <div className="relative">
        <select
          value={isFeaturedActive ? '' : value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          aria-label="More roles"
          className={`h-7 pl-2 pr-6 rounded border-2 text-[10px] font-medium outline-none appearance-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-navy/30 disabled:opacity-50 ${
            !isFeaturedActive && value
              ? 'bg-brand-navy border-brand-navy text-white'
              : 'bg-white dark:bg-brand-dark border-brand-navy/40 dark:border-brand-navy/60 text-brand-navy dark:text-gray-100 hover:border-brand-navy hover:bg-brand-navy/5'
          }`}
        >
          <option value="">More roles…</option>
          {nonFeaturedRoles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <ChevronDown
          className={`w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none ${
            !isFeaturedActive && value ? 'text-white' : 'text-brand-navy'
          }`}
        />
      </div>
    </div>
  )
}
