'use client'

import type { WidgetProps } from '@/lib/widgets/types'

/**
 * Mirrors the non-Spacer branch in `LayoutWidgetsInline` until file-folder
 * UI is wired through this entry point.
 */
export default function FileFolderWidget({ config, record }: WidgetProps) {
  const provider = typeof config.provider === 'string' ? config.provider : '—'
  const path = typeof config.path === 'string' ? config.path : ''
  return (
    <div className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900">
      <span className="font-medium">Widget:</span> FileFolder
      {path ? ` — ${path}` : ` — ${provider}`}
      <span className="block text-xs text-blue-800/80 mt-1">Record: {String(record.id)}</span>
    </div>
  )
}
