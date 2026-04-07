import type { ObjectDef } from '@/lib/schema';

function defaultPageLayoutIdForObject(obj: ObjectDef): string | null {
  if (!obj.pageLayouts?.length) return null;
  const rts = obj.recordTypes || [];
  const defRt = obj.defaultRecordTypeId
    ? rts.find((r) => r.id === obj.defaultRecordTypeId)
    : rts[0];
  if (defRt?.pageLayoutId && obj.pageLayouts.some((l) => l.id === defRt.pageLayoutId)) {
    return defRt.pageLayoutId;
  }
  return obj.pageLayouts[0]?.id ?? null;
}

/** Object list URL (not record detail): /properties, /contacts, /objects/slug, etc. */
export function resolveListViewObjectSetup(
  pathname: string | null,
  objects: ObjectDef[] | undefined,
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
    return { objectApiName: api, pageLayoutId: defaultPageLayoutIdForObject(obj) };
  }

  if (segs[0] === 'objects' && segs.length === 2) {
    const slug = segs[1];
    const obj = objects.find((o) => o.apiName.toLowerCase() === slug?.toLowerCase());
    if (!obj) return null;
    return { objectApiName: obj.apiName, pageLayoutId: defaultPageLayoutIdForObject(obj) };
  }

  return null;
}
