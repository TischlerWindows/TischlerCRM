import type { ControllerRegistration } from '../lib/controllers/types.js'
import { config as installationGridConfig } from './installation-grid/controller.config.js'
import { registerRoutes as installationGridRoutes } from './installation-grid/index.js'

export const controllerRegistrations: ControllerRegistration[] = [
  { manifest: installationGridConfig, registerRoutes: installationGridRoutes },
]

export const controllers = controllerRegistrations.map(r => r.manifest)
