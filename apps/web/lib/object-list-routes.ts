/**
 * List-view paths for standard objects (same routes as record-detail lookup links).
 * Custom objects: use `/objects/[slug]` when slug matches apiName lowercased.
 */
const STANDARD_LIST_ROUTES: Record<string, string> = {
  Contact: '/contacts',
  Account: '/accounts',
  Property: '/properties',
  Lead: '/leads',
  Opportunity: '/opportunities',
  Product: '/products',
  Quote: '/quotes',
  Project: '/projects',
  Service: '/service',
  Installation: '/installations',
};

export function getObjectListHref(apiName: string): string | null {
  const direct = STANDARD_LIST_ROUTES[apiName];
  if (direct) return direct;
  const slug = apiName.toLowerCase();
  if (slug && /^[a-z][a-z0-9_]*$/i.test(apiName)) {
    return `/objects/${encodeURIComponent(slug)}`;
  }
  return null;
}
