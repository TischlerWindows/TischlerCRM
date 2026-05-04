export const DEDICATED_ROUTES: Record<string, string> = {
  Property: '/properties',
  Account: '/accounts',
  Contact: '/contacts',
  Lead: '/leads',
  Opportunity: '/opportunities',
  Project: '/projects',
  Product: '/products',
  Installation: '/installations',
  Quote: '/quotes',
  Service: '/service',
}

export function recordUrl(objectApiName: string, recordId: string, fromPath?: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  const base = prefix ? `${prefix}/${recordId}` : `/objects/${objectApiName}/${recordId}`
  return fromPath ? `${base}?from=${encodeURIComponent(fromPath)}` : base
}
