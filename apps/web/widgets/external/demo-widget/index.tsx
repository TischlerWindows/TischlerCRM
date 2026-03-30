'use client'

import type { WidgetProps } from '@/lib/widgets/types'

export default function DemoWidget({ config, record, displayMode }: WidgetProps) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 ${displayMode === 'full' ? 'w-full' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded" style={{ background: config.accentColor as string }} />
        <h3 className="font-semibold text-brand-dark text-sm">
          {config.showHeader ? (config.title as string) : 'Demo Widget'}
        </h3>
        <span className="ml-auto text-[10px] bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
          External · Demo
        </span>
      </div>
      {config.description != null && String(config.description).length > 0 ? (
        <p className="text-xs text-brand-gray mb-3">{String(config.description)}</p>
      ) : null}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {Object.entries(config).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-brand-gray font-medium truncate">{k}</dt>
            <dd className="text-brand-dark truncate">{String(v ?? '—')}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
