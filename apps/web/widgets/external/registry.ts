import dynamic from 'next/dynamic'
import type { WidgetRegistration } from '@/lib/widgets/types'
import { config as demoWidgetManifest } from './demo-widget/widget.config'
import DemoConfigPanel from './demo-widget/ConfigPanel'

export const externalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: demoWidgetManifest,
    Component: dynamic(() => import('./demo-widget/index')),
    ConfigPanel: DemoConfigPanel,
  },
]

// Backwards-compatible derived export
export const externalWidgets = externalWidgetRegistrations.map((r) => r.manifest)
