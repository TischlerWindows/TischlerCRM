'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { RowSortDirection } from '@/lib/widget-row-sorting'

export function SortableGridHeader({
  label,
  active,
  direction,
  onSort,
  compact = false,
}: {
  label: string
  active: boolean
  direction: RowSortDirection
  onSort: (direction: RowSortDirection) => void
  compact?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Sort by ${label}`}
          className={`group inline-flex w-full items-center justify-between gap-1 text-left font-semibold text-gray-600 hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 ${compact ? 'text-[9px] uppercase' : ''}`}
        >
          <span className="min-w-0 flex-1">{label}</span>
          {active
            ? direction === 'asc'
              ? <ArrowUp className="h-3.5 w-3.5 shrink-0 text-brand-navy" aria-hidden="true" />
              : <ArrowDown className="h-3.5 w-3.5 shrink-0 text-brand-navy" aria-hidden="true" />
            : <ArrowUpDown className={`h-3.5 w-3.5 shrink-0 text-gray-400 ${compact ? '' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`} aria-hidden="true" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuItem onSelect={() => onSort('asc')}>
          <ArrowUp className="mr-2 h-3.5 w-3.5 text-gray-500" />
          Ascending
          {active && direction === 'asc' && <Check className="ml-auto h-3.5 w-3.5 text-brand-navy" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onSort('desc')}>
          <ArrowDown className="mr-2 h-3.5 w-3.5 text-gray-500" />
          Descending
          {active && direction === 'desc' && <Check className="ml-auto h-3.5 w-3.5 text-brand-navy" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}