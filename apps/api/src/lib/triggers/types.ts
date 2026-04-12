export type TriggerEvent =
  | 'beforeCreate' | 'afterCreate'
  | 'beforeUpdate' | 'afterUpdate'
  | 'beforeDelete' | 'afterDelete'

export interface TriggerManifest {
  id: string                    // kebab-case, unique, immutable
  name: string                  // Human-readable display name
  description: string           // What it does
  icon: string                  // Lucide icon name
  objectApiName: string         // Which CRM object it fires on
  events: TriggerEvent[]        // Which lifecycle events it handles
}

export interface TriggerContext {
  event: TriggerEvent
  objectApi: string
  recordId: string
  recordData: Record<string, any>
  beforeData?: Record<string, any>  // previous values (on update)
  userId: string
  orgId: string
}

/** Handler returns field updates to apply to the triggering record, or null */
export type TriggerHandler = (ctx: TriggerContext) => Promise<Record<string, any> | null>

export interface TriggerRegistration {
  manifest: TriggerManifest
  handler: TriggerHandler
}
