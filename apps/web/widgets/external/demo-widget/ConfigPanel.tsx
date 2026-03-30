'use client'

import type { ConfigPanelProps } from '@/lib/widgets/types'
import { SchemaRenderer } from '@/lib/widgets/schema-renderer'
import DemoWidget from './index'
import { config as manifest } from './widget.config'

export default function DemoConfigPanel({
  config,
  onChange,
  record,
  object,
  objectOptions,
}: ConfigPanelProps & { objectOptions?: Array<{ value: string; label: string }> }) {
  return (
    <div className="space-y-4">
      <SchemaRenderer
        schema={manifest.configSchema}
        config={config}
        onChange={(key, value) => onChange({ ...config, [key]: value })}
        objectOptions={objectOptions}
      />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gray mb-1">Preview</p>
        <div className="rounded-lg border border-dashed border-gray-200 p-2 bg-gray-50">
          <DemoWidget config={config} record={record} object={object} integration={null} displayMode="full" orgId="" />
        </div>
      </div>
    </div>
  )
}
