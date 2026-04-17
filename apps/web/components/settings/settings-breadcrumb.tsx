'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Setup',
  'object-manager': 'Object Manager',
  users: 'Users',
  profiles: 'Profiles',
  departments: 'Departments',
  'audit-log': 'Audit Log',
  'error-log': 'Error Log',
  'recycle-bin': 'Recycle Bin',
  security: 'Security',
  backups: 'Backups',
  company: 'Company Settings',
  integrations: 'Connected Apps',
  widgets: 'Widgets',
  privacy: 'Privacy Center',
  notifications: 'Notifications',
  offline: 'Offline',
  automations: 'Automations',
};

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0 || segments[0] !== 'settings') return [];

  const crumbs: Crumb[] = [{ label: 'Tischler CRM', href: '/' }];
  const isSettingsRoot = segments.length === 1;
  crumbs.push(isSettingsRoot ? { label: 'Setup' } : { label: 'Setup', href: '/settings' });
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i]!;
    const label = SEGMENT_LABELS[seg] || decodeURIComponent(seg);
    const isLast = i === segments.length - 1;
    crumbs.push(isLast ? { label } : { label, href: '/' + segments.slice(0, i + 1).join('/') });
  }

  return crumbs;
}

export function SettingsBreadcrumb() {
  const pathname = usePathname();
  if (!pathname) return null;
  const crumbs = buildCrumbs(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <div className="px-8 py-3 text-[12px] text-brand-gray bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-brand-navy transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className="text-brand-dark font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
