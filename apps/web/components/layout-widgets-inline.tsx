'use client'

import React from 'react'
import { getExternalRegistration, getInternalRegistrationByType } from '@/lib/widgets/registry-loader'
import { resolveConfig } from '@/lib/widgets/merge-resolver'
import { externalWidgets } from '@/widgets/external/registry'
import type { PageWidget } from '@/lib/schema'
import type { WidgetProps } from '@/lib/widgets/types'

function WidgetDisabledPlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
      Widget &ldquo;{widgetId}&rdquo; is not enabled for this organization.
    </div>
  )
}

function WidgetUnavailablePlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-red-100 bg-red-50/50 px-3 py-4 text-center text-xs text-red-400">
      Widget &ldquo;{widgetId}&rdquo; is unavailable.
    </div>
  )
}

function WidgetLoadingPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400 animate-pulse">
      Loading widget…
    </div>
  )
}

const STUB_RECORD: Record<string, unknown> = {}
const STUB_OBJECT = {
  apiName: '',
  label: '',
  fields: [] as Array<{ apiName: string; label: string; type: string }>,
}

interface LayoutWidgetsInlineProps {
  widgets?: PageWidget[]
  enabledIds?: string[]
  /** The live CRM record being rendered */
  record?: Record<string, unknown>
  /** The object definition for the current record */
  objectDef?: { apiName: string; label: string; fields: Array<{ apiName: string; label: string; type: string }> }
  /** Organization ID for the current record context */
  orgId?: string
  /** Integration connection state keyed by provider ID */
  integrations?: Record<string, { isConnected: boolean }>
}

function getIntegrationContext(
  provider: string | null,
  integrations: Record<string, { isConnected: boolean }> | undefined,
): WidgetProps['integration'] {
  if (!provider) return null
  const state = integrations?.[provider]
  return { provider, isConnected: state?.isConnected ?? false }
}

/**
 * Renders tab-level or section-level layout widgets on record detail and forms.
 */
export function LayoutWidgetsInline({
  widgets,
  enabledIds,
  record,
  objectDef,
  orgId = '',
  integrations,
}: LayoutWidgetsInlineProps) {
  if (!widgets?.length) return null

  const effectiveEnabledIds = enabledIds ?? externalWidgets.map((w) => w.id)
  const sorted = [...widgets].sort((a, b) => a.order - b.order)
  const liveRecord = record ?? STUB_RECORD
  const liveObject = objectDef ?? STUB_OBJECT

  return (
    <div className="mb-4 flex flex-col gap-3">
      {sorted.map((w) => {
        const config = w.config

        if (config.type === 'ExternalWidget') {
          const { externalWidgetId, displayMode, config: widgetConfig } = config
          const registration = getExternalRegistration(externalWidgetId)

          if (!registration) {
            return <WidgetUnavailablePlaceholder key={w.id} widgetId={externalWidgetId} />
          }

          if (!effectiveEnabledIds.includes(externalWidgetId)) {
            return <WidgetDisabledPlaceholder key={w.id} widgetId={externalWidgetId} />
          }

          const { Component } = registration
          const resolvedConfig = resolveConfig(widgetConfig, liveRecord)
          const integration = getIntegrationContext(registration.manifest.integration, integrations)

          return (
            <React.Suspense key={w.id} fallback={<WidgetLoadingPlaceholder />}>
              <Component
                config={resolvedConfig}
                record={liveRecord}
                object={liveObject}
                integration={integration}
                displayMode={displayMode}
                orgId={orgId}
              />
            </React.Suspense>
          )
        }

        // Internal widgets — CustomComponent is kept as legacy fallback
        if (config.type === 'CustomComponent') {
          return (
            <div
              key={w.id}
              className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900"
            >
              <span className="font-medium">Widget:</span> {w.widgetType}
              {config && 'label' in config && (config as { label?: string }).label
                ? ` — ${(config as { label?: string }).label}`
                : null}
            </div>
          )
        }

        const registration = getInternalRegistrationByType(config.type)

        if (!registration) {
          return (
            <div
              key={w.id}
              className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900"
            >
              <span className="font-medium">Widget:</span> {w.widgetType}
              {config && 'label' in config && (config as { label?: string }).label
                ? ` — ${(config as { label?: string }).label}`
                : null}
            </div>
          )
        }

        const { Component } = registration
        const rawConfig = registration.transformConfig
          ? registration.transformConfig(config as unknown as Record<string, unknown>)
          : (config as unknown as Record<string, unknown>)
        const resolvedConfig = resolveConfig(rawConfig, liveRecord)

        return (
          <React.Suspense key={w.id} fallback={<WidgetLoadingPlaceholder />}>
            <Component
              config={resolvedConfig}
              record={liveRecord}
              object={liveObject}
              integration={null}
              displayMode="full"
              orgId={orgId}
            />
          </React.Suspense>
        )
      })}
    </div>
  )
}
