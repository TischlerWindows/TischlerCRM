import type { ControllerManifest, ControllerRegistration } from './types.js'
import { controllerRegistrations, controllers } from '../../controllers/registry.js'

export function getAllControllers(): ControllerManifest[] {
  return controllers
}

export function getControllerById(id: string): ControllerManifest | undefined {
  return controllers.find(c => c.id === id)
}

export function getControllersByObject(objectApiName: string): ControllerManifest[] {
  return controllers.filter(c => c.objectApiName === objectApiName)
}

/** Returns only registrations whose manifest.id is in enabledIds and matches the object */
export function getActiveControllers(objectApiName: string, enabledIds: string[]): ControllerRegistration[] {
  return controllerRegistrations.filter(
    r => r.manifest.objectApiName === objectApiName && enabledIds.includes(r.manifest.id)
  )
}

export function getControllerRegistration(id: string): ControllerRegistration | undefined {
  return controllerRegistrations.find(r => r.manifest.id === id)
}
