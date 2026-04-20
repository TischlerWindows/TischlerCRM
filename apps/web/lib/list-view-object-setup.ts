import type { ObjectDef } from '@/lib/schema';
import { resolveLayoutForUser, type ResolveUserContext } from '@/lib/layout-resolver';

function activeLayoutIdForObject(obj: ObjectDef, user: ResolveUserContext): string | null {
  const result = resolveLayoutForUser(obj, user, { layoutType: 'edit' });
  return result.kind === 'resolved' ? result.layout.id : null;
}

/** Object list URL (not record detail): /properties, /contacts, /objects/slug, etc. */
export function resolveListViewObjectSetup(
  pathname: string | null,
  objects: ObjectDef[] | undefined,
  user: ResolveUserContext,
): { objectApiName: string; pageLayoutId: string | null } | null {
  if (!pathname || !objects?.length) return null;
  const segs = pathname.split('/').filter(Boolean);

  const standardSegmentToApi: Record<string, string> = {
    properties: 'Property',
    contacts: 'Contact',
    accounts: 'Account',
    products: 'Product',
    leads: 'Lead',
    opportunities: 'Opportunity',
    projects: 'Project',
    service: 'Service',
    quotes: 'Quote',
    installations: 'Installation',
  };

  if (segs.length === 1) {
    const api = standardSegmentToApi[segs[0]!];
    if (!api) return null;
    const obj = objects.find((o) => o.apiName === api);
    if (!obj) return null;
    return { objectApiName: api, pageLayoutId: activeLayoutIdForObject(obj, user) };
  }

  if (segs[0] === 'objects' && segs.length === 2) {
    const slug = segs[1];
    const obj = objects.find((o) => o.apiName.toLowerCase() === slug?.toLowerCase());
    if (!obj) return null;
    return { objectApiName: obj.apiName, pageLayoutId: activeLayoutIdForObject(obj, user) };
  }

  return null;
}
