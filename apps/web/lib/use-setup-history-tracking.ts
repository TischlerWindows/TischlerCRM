'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackVisit } from '@/lib/setup-history';
import { rememberCameFrom, isSetupPath } from '@/lib/setup-return-to';

interface RouteMeta {
  title: string;
  iconKey: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/settings': { title: 'Settings', iconKey: 'settings' },
  '/settings/users': { title: 'Users', iconKey: 'users' },
  '/settings/profiles': { title: 'Profiles', iconKey: 'shield' },
  '/settings/departments': { title: 'Departments', iconKey: 'building' },
  '/settings/company': { title: 'Company Settings', iconKey: 'home' },
  '/settings/security': { title: 'Security', iconKey: 'lock' },
  '/settings/audit-log': { title: 'Audit Log', iconKey: 'file-text' },
  '/settings/error-log': { title: 'Error Log', iconKey: 'alert-triangle' },
  '/settings/recycle-bin': { title: 'Recycle Bin', iconKey: 'trash' },
  '/settings/backups': { title: 'Backups', iconKey: 'database' },
  '/settings/automations': { title: 'Automations', iconKey: 'zap' },
  '/settings/notifications': { title: 'Notifications', iconKey: 'bell' },
  '/settings/widgets': { title: 'Widgets', iconKey: 'puzzle' },
  '/settings/integrations': { title: 'Connected Apps', iconKey: 'plug' },
  '/object-manager': { title: 'Object Manager', iconKey: 'briefcase' },
};

function resolveMeta(pathname: string): RouteMeta | null {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]!;
  if (pathname.startsWith('/object-manager/')) {
    const slug = pathname.split('/')[2]!;
    return { title: `Object Manager › ${slug}`, iconKey: 'briefcase' };
  }
  return null;
}

const TRACKABLE_PREFIX = /^\/(settings|object-manager)(\/|$)/;
const SKIP_TRACKING_PREFIXES = ['/settings/users/', '/settings/profiles/'];

export function useSetupHistoryTracking(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;

    if (!isSetupPath(pathname)) {
      rememberCameFrom(pathname);
      return;
    }

    if (!TRACKABLE_PREFIX.test(pathname)) return;
    if (SKIP_TRACKING_PREFIXES.some(p => pathname.startsWith(p) && pathname !== p.slice(0, -1))) return;

    const meta = resolveMeta(pathname);
    if (!meta) return;
    trackVisit({ href: pathname, title: meta.title, iconKey: meta.iconKey });
  }, [pathname]);
}
