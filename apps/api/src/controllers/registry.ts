import type { ControllerRegistration } from '../lib/controllers/types.js'

export const controllerRegistrations: ControllerRegistration[] = []

export const controllers = controllerRegistrations.map(r => r.manifest)
