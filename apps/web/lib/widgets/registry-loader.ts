import type { WidgetManifest } from './types'
import { externalWidgets } from '@/widgets/external/registry'
import { internalWidgets } from '@/widgets/internal/registry'

export function getAllWidgets(): WidgetManifest[] {
  return [...internalWidgets, ...externalWidgets]
}

export function getExternalWidgets(): WidgetManifest[] {
  return externalWidgets
}

export function getInternalWidgets(): WidgetManifest[] {
  return internalWidgets
}

export function getWidgetById(id: string): WidgetManifest | undefined {
  return getAllWidgets().find(w => w.id === id)
}

// On the client, pass in the list of enabled widgetIds from the API.
// Returns only widgets that should appear in the palette.
export function getEnabledExternalWidgets(
  enabledIds: string[],
  connectedProviders: string[]
): WidgetManifest[] {
  return externalWidgets.filter(w => {
    if (!enabledIds.includes(w.id)) return false
    if (w.integration === null) return true
    return connectedProviders.includes(w.integration)
  })
}
