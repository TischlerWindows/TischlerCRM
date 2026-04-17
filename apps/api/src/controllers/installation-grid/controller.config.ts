import type { ControllerManifest } from '../../lib/controllers/types.js'

export const config: ControllerManifest = {
  id: 'installation-grid',
  name: 'Installation Grid Controller',
  description: 'API endpoints for installation cost grid data, CRUD, calculations, and technician management',
  icon: 'Table',
  objectApiName: 'Installation',
  routePrefix: '/controllers/installation-grid',
}
