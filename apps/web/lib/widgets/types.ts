// apps/web/lib/widgets/types.ts

export type WidgetCategory = 'external' | 'internal'
export type DisplayMode = 'full' | 'column'

export type SchemaFieldType =
  | 'text' | 'textarea' | 'url' | 'merge-text'
  | 'select' | 'button-group' | 'boolean' | 'number'
  | 'color' | 'object-select' | 'divider' | 'heading' | 'json'

export interface SchemaFieldOption {
  value: string
  label: string
}

export type SchemaField =
  | { type: 'divider' }
  | { type: 'heading'; label: string }
  | {
      key: string
      type: SchemaFieldType
      label: string
      required?: boolean
      default?: unknown
      placeholder?: string
      helpText?: string
      options?: SchemaFieldOption[]   // for select, button-group
      min?: number                    // for number
      max?: number                    // for number
    }

export interface WidgetManifest {
  id: string                          // kebab-case, unique, immutable
  name: string
  description: string
  icon: string                        // Lucide icon name
  category: WidgetCategory
  integration: string | null          // provider ID or null
  defaultDisplayMode: DisplayMode
  configSchema: SchemaField[]
}

// Stored in layout JSON for external widget placements
export interface ExternalWidgetLayoutConfig {
  type: 'ExternalWidget'
  externalWidgetId: string
  displayMode: DisplayMode
  config: Record<string, unknown>     // schema field values
}

// Props received by every widget component (index.tsx)
export interface WidgetProps {
  config: Record<string, unknown>     // resolved config (merge-text already substituted)
  record: Record<string, unknown>     // the CRM record being viewed
  object: {
    apiName: string
    label: string
    fields: Array<{ apiName: string; label: string; type: string }>
  }
  integration: {
    provider: string
    accessToken?: string
    isConnected: boolean
  } | null
  displayMode: DisplayMode
  orgId: string
}

// Props for optional ConfigPanel.tsx escape hatch
export interface ConfigPanelProps {
  config: Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  record: Record<string, unknown>
  integration: WidgetProps['integration']
  object: WidgetProps['object']
  objectOptions?: Array<{ apiName: string; label: string }>
}

export interface WidgetRegistration {
  manifest: WidgetManifest
  Component: React.ComponentType<WidgetProps>
  ConfigPanel?: React.ComponentType<ConfigPanelProps>
  /**
   * Internal widgets only. The PascalCase discriminant stored in
   * WidgetConfig.type (e.g. 'Spacer', 'ActivityFeed'). Used by
   * getInternalRegistrationByType to dispatch the correct component.
   * Not needed for external widgets (looked up by manifest.id).
   */
  widgetConfigType?: string
  /**
   * Internal widgets only. Maps the stored WidgetConfig shape to
   * Record<string, unknown> before passing as the `config` prop.
   * If omitted, the stored config is passed through as-is (cast).
   */
  transformConfig?: (stored: Record<string, unknown>) => Record<string, unknown>
}
