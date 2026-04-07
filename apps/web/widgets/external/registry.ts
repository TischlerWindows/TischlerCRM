import dynamic from 'next/dynamic'
import type { WidgetRegistration } from '@/lib/widgets/types'
import { config as demoWidgetManifest } from './demo-widget/widget.config'
import DemoConfigPanel from './demo-widget/ConfigPanel'
import { config as dropboxBrowserManifest } from './dropbox-browser/widget.config'

export const externalWidgetRegistrations: WidgetRegistration[] = [
  {
    manifest: demoWidgetManifest,
    Component: dynamic(() => import('./demo-widget/index')),
    ConfigPanel: DemoConfigPanel,
  },
  {
    manifest: dropboxBrowserManifest,
    Component: dynamic(() => import('./dropbox-browser/index')),
  },
]

// Backwards-compatible derived export
export const externalWidgets = externalWidgetRegistrations.map((r) => r.manifest)
