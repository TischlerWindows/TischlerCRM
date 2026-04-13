import type { FastifyInstance } from 'fastify'

export interface ControllerManifest {
  id: string                    // kebab-case, unique, immutable
  name: string                  // Human-readable display name
  description: string           // What it provides
  icon: string                  // Lucide icon name
  objectApiName: string         // Which CRM object it serves
  routePrefix: string           // API route prefix (e.g., '/controllers/installation-grid')
}

export interface ControllerRegistration {
  manifest: ControllerManifest
  registerRoutes: (app: FastifyInstance) => Promise<void>
}
