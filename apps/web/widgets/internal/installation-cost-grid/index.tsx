'use client'
import type { WidgetProps } from '@/lib/widgets/types'

export default function InstallationCostGridWidget({ record }: WidgetProps) {
  return (
    <div className="p-4 text-sm text-brand-gray">
      Installation Cost Grid — loading for {String(record?.id ?? 'unknown')}...
    </div>
  )
}
