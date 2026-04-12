import type { TriggerRegistration } from '../lib/triggers/types.js'

export const triggerRegistrations: TriggerRegistration[] = []

export const triggers = triggerRegistrations.map(r => r.manifest)
