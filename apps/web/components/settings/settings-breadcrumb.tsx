'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Settings',
  users: 'Users',
  roles: 'Roles',
  departments: 'Departments',
  'audit-log': 'Audit Log',
  'recycle-bin': 'Recycle Bin',
  security: 'Security',
  backups: 'Backups',
  data: 'Data',
  company: 'Company Settings',
  integrations: 'Connected Apps',
  privacy: 'Privacy Center',
  notifications: 'Notifications',
  offline: 'Offline',
  automation: 'Process Automation',
  ui: 'User Interface',
};

const SEGMENT_GROUPS: Record<string, string> = {
  users: 'Administration',
  roles: 'Administration',
  departments: 'Administration',
  'audit-log': 'Administration',
  'recycle-bin': 'Administration',
  data: 'Administration',
  backups: 'Administration',
  security: 'Settings',
  company: 'Settings',
  integrations: 'Integrations',
  privacy: 'Settings',
  notifications: 'Integrations',
  offline: 'Integrations',
  automation: 'Automation',
};

export function SettingsBreadcrumb() {
  const pathname = usePathname();
  if (!pathname) return null;

  const segments = pathname.split('/').filter(Boolean);
  // Only show breadcrumb for sub-pages (not the settings hub itself)
  if (segments.length <= 1) return null;

  const currentSegment = segments[segments.length - 1];
  const group = SEGMENT_GROUPS[currentSegment];

  const items: Array<{ label: string; href?: string }> = [
    { label: 'Settings', href: '/settings' },
  ];

  if (group) {
    items.push({ label: group });
  }

  items.push({ label: SEGMENT_LABELS[currentSegment] || currentSegment });

  return (
    <div className="px-8 py-3 text-[12px] text-brand-gray bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-brand-navy transition-colors">
                {item.label}
              </Link>
            ) : i === items.length - 1 ? (
              <span className="text-brand-dark font-medium">{item.label}</span>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}