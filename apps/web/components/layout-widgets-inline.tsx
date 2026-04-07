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
    <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
      <div className="h-4 w-1/3 rounded bg-gray-200 mb-3" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-5/6 rounded bg-gray-200" />
        <div className="h-3 w-2/3 rounded bg-gray-200" />
      </div>
      <div className="mt-4 h-8 w-24 rounded bg-gray-200" />
    </div>
  )
}

function WidgetInvalidConfigFallback({
  widgetType,
  externalWidgetId,
}: {
  widgetType: string
  externalWidgetId?: string
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
      <p className="font-medium">Widget unavailable</p>
      <p className="mt-1 text-xs">
        {widgetType === 'ExternalWidget'
          ? `External widget "${externalWidgetId}" is not registered.`
          : `Widget type "${widgetType}" could not be loaded.`}
        {' '}Edit this layout to fix or remove it.
      </p>
    </div>
  )
}

interface WidgetErrorBoundaryState {
  hasError: boolean
}

class WidgetErrorBoundary extends React.Component<
  { children: React.ReactNode },
  WidgetErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[WidgetErrorBoundary] Widget crashed at render time:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          <p className="font-medium">Widget unavailable</p>
          <p className="mt-1 text-xs">
            This widget encountered an error and could not be displayed. Edit this layout to fix or
            remove it.
          </p>
        </div>
      )
    }
    return this.props.children
  }
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
            return (
              <WidgetInvalidConfigFallback
                key={w.id}
                widgetType="ExternalWidget"
                externalWidgetId={externalWidgetId}
              />
            )
          }

          if (!effectiveEnabledIds.includes(externalWidgetId)) {
            return <WidgetDisabledPlaceholder key={w.id} widgetId={externalWidgetId} />
          }

          const { Component } = registration
          const resolvedConfig = resolveConfig(widgetConfig, liveRecord)
          const integration = getIntegrationContext(registration.manifest.integration, integrations)

          return (
            <WidgetErrorBoundary key={w.id}>
              <React.Suspense fallback={<WidgetLoadingPlaceholder />}>
                <Component
                  config={resolvedConfig}
                  record={liveRecord}
                  object={liveObject}
                  integration={integration}
                  displayMode={displayMode}
                  orgId={orgId}
                />
              </React.Suspense>
            </WidgetErrorBoundary>
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
            <WidgetInvalidConfigFallback key={w.id} widgetType={config.type} />
          )
        }

        const { Component } = registration
        const rawConfig = registration.transformConfig
          ? registration.transformConfig(config as unknown as Record<string, unknown>)
          : (config as unknown as Record<string, unknown>)
        const resolvedConfig = resolveConfig(rawConfig, liveRecord)

        return (
          <WidgetErrorBoundary key={w.id}>
            <React.Suspense fallback={<WidgetLoadingPlaceholder />}>
              <Component
                config={resolvedConfig}
                record={liveRecord}
                object={liveObject}
                integration={null}
                displayMode="full"
                orgId={orgId}
              />
            </React.Suspense>
          </WidgetErrorBoundary>
        )
      })}
    </div>
  )
}
