import type { OrgSchema } from '@/lib/schema';

export type SearchGroup = 'Pages' | 'Objects' | 'Users' | 'Profiles';

export interface SearchItem {
  group: SearchGroup;
  primary: string;
  secondary: string;
  href: string;
  iconKey: string;
}

const SIDEBAR_STATIC: Array<{ title: string; href: string; iconKey: string }> = [
  { title: 'Object Manager', href: '/object-manager', iconKey: 'briefcase' },
  { title: 'Company Settings', href: '/settings/company', iconKey: 'home' },
  { title: 'Departments', href: '/settings/departments', iconKey: 'building' },
  { title: 'Security', href: '/settings/security', iconKey: 'lock' },
  { title: 'Users', href: '/settings/users', iconKey: 'users' },
  { title: 'Profiles', href: '/settings/profiles', iconKey: 'shield' },
  { title: 'Backups', href: '/settings/backups', iconKey: 'database' },
  { title: 'Recycle Bin', href: '/settings/recycle-bin', iconKey: 'trash' },
  { title: 'Automations', href: '/settings/automations', iconKey: 'zap' },
  { title: 'Notifications', href: '/settings/notifications', iconKey: 'bell' },
  { title: 'Widgets', href: '/settings/widgets', iconKey: 'puzzle' },
  { title: 'Support Tickets', href: '/settings/support-tickets', iconKey: 'life-buoy' },
  { title: 'Connected Apps', href: '/settings/integrations', iconKey: 'plug' },
  { title: 'Audit Log', href: '/settings/audit-log', iconKey: 'file-text' },
  { title: 'Error Log', href: '/settings/error-log', iconKey: 'alert-triangle' },
];

const OBJECT_SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'fields', label: 'Fields & Relationships' },
  { id: 'record-types', label: 'Record Types' },
  { id: 'page-editor', label: 'Page Editor' },
  { id: 'search-settings', label: 'Search Settings' },
  { id: 'workflow-rules', label: 'Workflow Rules' },
  { id: 'paths', label: 'Paths' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'validation-rules', label: 'Validation Rules' },
];

export function buildSidebarItems(): SearchItem[] {
  return SIDEBAR_STATIC.map(item => ({
    group: 'Pages' as const,
    primary: item.title,
    secondary: '',
    href: item.href,
    iconKey: item.iconKey,
  }));
}

export function buildObjectItems(schema: OrgSchema | null): SearchItem[] {
  if (!schema) return [];
  return schema.objects.map(obj => ({
    group: 'Objects' as const,
    primary: obj.label || obj.apiName,
    secondary: 'Object Manager',
    href: `/object-manager/${obj.apiName}`,
    iconKey: 'database',
  }));
}

export function buildObjectSectionItems(schema: OrgSchema | null): SearchItem[] {
  if (!schema) return [];
  const items: SearchItem[] = [];
  for (const obj of schema.objects) {
    for (const section of OBJECT_SECTIONS) {
      items.push({
        group: 'Objects',
        primary: section.label,
        secondary: `Object Manager › ${obj.label || obj.apiName}`,
        href: `/object-manager/${obj.apiName}?section=${section.id}`,
        iconKey: 'database',
      });
    }
  }
  return items;
}

export function buildUserItems(users: Array<{ id: string; name: string | null; email: string }>): SearchItem[] {
  return users.map(u => ({
    group: 'Users' as const,
    primary: u.name || u.email,
    secondary: u.name ? u.email : '',
    href: `/settings/users/${u.id}`,
    iconKey: 'users',
  }));
}

export function buildProfileItems(profiles: Array<{ id: string; name: string; label?: string }>): SearchItem[] {
  return profiles.map(p => ({
    group: 'Profiles' as const,
    primary: p.label || p.name,
    secondary: p.name,
    href: `/settings/profiles/${p.id}`,
    iconKey: 'shield',
  }));
}

export function searchIndex(query: string, items: SearchItem[]): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items.filter(item =>
    item.primary.toLowerCase().includes(q) ||
    item.secondary.toLowerCase().includes(q)
  );
}
