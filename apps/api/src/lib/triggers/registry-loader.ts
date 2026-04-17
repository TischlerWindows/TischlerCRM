import type { TriggerManifest, TriggerRegistration } from './types.js'
import { triggerRegistrations, triggers } from '../../triggers/registry.js'

export function getAllTriggers(): TriggerManifest[] {
  return triggers
}

export function getTriggerById(id: string): TriggerManifest | undefined {
  return triggers.find(t => t.id === id)
}

export function getTriggersByObject(objectApiName: string): TriggerManifest[] {
  return triggers.filter(t => t.objectApiName === objectApiName)
}

/** Returns only registrations whose manifest.id is in enabledIds and matches the object */
export function getActiveTriggers(objectApiName: string, enabledIds: string[]): TriggerRegistration[] {
  return triggerRegistrations.filter(
    r => r.manifest.objectApiName === objectApiName && enabledIds.includes(r.manifest.id)
  )
}

export function getTriggerRegistration(id: string): TriggerRegistration | undefined {
  return triggerRegistrations.find(r => r.manifest.id === id)
}
