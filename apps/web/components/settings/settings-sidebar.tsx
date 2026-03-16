'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Users,
  Shield,
  Building2,
  FileText,
  Trash2,
  Database,
  Briefcase,
  Home,
  Lock,
  ShieldAlert,
  Bell,
  WifiOff,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Administration',
    items: [
      { name: 'Users', href: '/settings/users', icon: Users },
      { name: 'Roles', href: '/settings/roles', icon: Shield },
      { name: 'Departments', href: '/settings/departments', icon: Building2 },
      { name: 'Audit Log', href: '/settings/audit-log', icon: FileText },
      { name: 'Recycle Bin', href: '/settings/recycle-bin', icon: Trash2 },
      { name: 'Data', href: '/settings/data', icon: Database, disabled: true },
      { name: 'Backups', href: '/settings/backups', icon: Database },
    ],
  },
  {
    title: 'Settings',
    items: [
      { name: 'Company Settings', href: '/settings/company', icon: Home, disabled: true },
      { name: 'Security', href: '/settings/security', icon: Lock },
      { name: 'Privacy Center', href: '/settings/privacy', icon: ShieldAlert, disabled: true },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { name: 'Notifications', href: '/settings/notifications', icon: Bell, disabled: true },
      { name: 'Offline', href: '/settings/offline', icon: WifiOff, disabled: true },
    ],
  },
  {
    title: 'Automation',
    items: [
      { name: 'Process Automation', href: '/settings/automation', icon: Zap, disabled: true },
    ],
  },
];

interface SettingsSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SettingsSidebar({ collapsed, onToggleCollapse }: SettingsSidebarProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (href: string) => {
    if (href === '/object-manager') return pathname?.startsWith('/object-manager');
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((group) => group.items.length > 0);

  // When collapsed, render only a thin expand strip
  if (collapsed) {
    return (
      <aside className="fixed top-12 bottom-0 left-0 z-40 w-[20px] flex items-start justify-center pt-4 transition-[width] duration-200 ease-in-out bg-[#151f6d]">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-5 h-8 rounded-r-md bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-all"
          title="Expand sidebar"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="fixed top-12 bottom-0 left-0 z-40 flex flex-col w-[260px] transition-[width] duration-200 ease-in-out"
      style={{ background: 'linear-gradient(180deg, #151f6d 0%, #0f1754 100%)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/10 px-5 py-5 pb-3">
        <div>
          <h2 className="text-base font-bold text-white">Settings</h2>
          <p className="text-[11px] text-white/45 mt-0.5">Configure your CRM</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center rounded-md bg-white/8 text-white/40 hover:bg-white/15 hover:text-white/80 transition-all flex-shrink-0 w-7 h-7 mt-0.5"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Object Manager — prominent quick-access button */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/object-manager"
          className={cn(
            'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 transition-all duration-150',
            isActive('/object-manager')
              ? 'bg-white/[0.14] text-white font-semibold shadow-[inset_3px_0_0_#da291c]'
              : 'bg-white/[0.08] text-white/80 hover:bg-white/[0.14] hover:text-white'
          )}
        >
          <Briefcase className="w-[18px] h-[18px] flex-shrink-0" />
          <span className="text-[13px] font-medium">Object Manager</span>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/8 rounded-lg py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/35 outline-none focus:bg-white/15 focus:border-white/20 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 hover:text-white/70"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-5">
        {filteredGroups.map((group) => (
          <div key={group.title}>
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white/35">
              {group.title}
            </div>

            {group.items.map((item) => {
              const active = isActive(item.href);

              if (item.disabled) {
                return (
                  <div
                    key={item.name}
                    className="flex items-center gap-2.5 rounded-lg opacity-40 cursor-not-allowed my-0.5 px-3 py-2"
                    title="Coming soon"
                  >
                    <item.icon className="flex-shrink-0 w-[18px] h-[18px]" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    <span className="text-[13px] text-white/50">{item.name}</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg transition-all duration-150 my-0.5 px-3 py-2',
                    active
                      ? 'bg-white/[0.14] text-white font-semibold shadow-[inset_3px_0_0_#da291c]'
                      : 'text-white/65 hover:bg-white/[0.08] hover:text-white/90'
                  )}
                >
                  <item.icon
                    className={cn(
                      'flex-shrink-0 w-[18px] h-[18px]',
                      active ? 'opacity-100' : 'opacity-60'
                    )}
                  />
                  <span className="text-[13px]">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}