'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ExitSetupPill } from '@/components/settings/exit-setup-pill';
import { SetupSearchTypeahead } from '@/components/settings/setup-search-typeahead';
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
  Plug,
  Puzzle,
  Zap,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  LifeBuoy,
  ExternalLink,
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
    title: 'Company',
    items: [
      { name: 'Company Settings', href: '/settings/company', icon: Home },
      { name: 'Departments', href: '/settings/departments', icon: Building2 },
      { name: 'Security', href: '/settings/security', icon: Lock },
      { name: 'Privacy Center', href: '/settings/privacy', icon: ShieldAlert, disabled: true },
    ],
  },
  {
    title: 'Users & Access',
    items: [
      { name: 'Users', href: '/settings/users', icon: Users },
      { name: 'Profiles', href: '/settings/profiles', icon: Shield },
    ],
  },
  {
    title: 'Data Model',
    items: [
      { name: 'Backups', href: '/settings/backups', icon: Database },
      { name: 'Recycle Bin', href: '/settings/recycle-bin', icon: Trash2 },
      { name: 'Data', href: '/settings/data', icon: Database, disabled: true },
    ],
  },
  {
    title: 'Automation',
    items: [
      { name: 'Automations', href: '/settings/automations', icon: Zap },
      { name: 'Notifications', href: '/settings/notifications', icon: Bell },
      { name: 'Widgets', href: '/settings/widgets', icon: Puzzle },
    ],
  },
  {
    title: 'Support',
    items: [
      { name: 'Support Tickets', href: '/settings/support-tickets', icon: LifeBuoy },
    ],
  },
  {
    title: 'Connections',
    items: [
      { name: 'Connected Apps', href: '/settings/integrations', icon: Plug },
      { name: 'Offline', href: '/settings/offline', icon: WifiOff, disabled: true },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { name: 'Audit Log', href: '/settings/audit-log', icon: FileText },
      { name: 'Error Log', href: '/settings/error-log', icon: AlertTriangle },
    ],
  },
];

interface SettingsSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SettingsSidebar({ collapsed, onToggleCollapse }: SettingsSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/object-manager') return pathname?.startsWith('/object-manager');
    return pathname === href || pathname?.startsWith(href + '/');
  };

  // When collapsed, render only a thin expand strip
  if (collapsed) {
    return (
      <aside className="fixed top-12 bottom-0 left-0 z-40 w-[20px] flex items-start justify-center pt-4 transition-[width] duration-200 ease-in-out bg-white border-r border-gray-200">
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center w-5 h-8 rounded-r-md bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all"
          title="Expand sidebar"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className="fixed top-12 bottom-0 left-0 z-40 flex flex-col w-[260px] transition-[width] duration-200 ease-in-out bg-white border-r border-gray-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-200 px-5 py-5 pb-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">Settings</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Configure your CRM</p>
        </div>
        <button
          onClick={onToggleCollapse}
          className="flex items-center justify-center rounded-md bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all flex-shrink-0 w-7 h-7 mt-0.5"
          title="Collapse sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Object Manager — prominent quick-access button (opens in new tab) */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/object-manager"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2.5 w-full rounded-lg px-3 py-2.5 transition-all duration-150',
            isActive('/object-manager')
              ? 'bg-[#ede9f5] text-brand-navy font-semibold shadow-[inset_3px_0_0_theme(colors.brand.red)]'
              : 'bg-gray-50 text-gray-800 hover:bg-gray-100 hover:text-gray-900'
          )}
        >
          <Briefcase className="w-[18px] h-[18px] flex-shrink-0 text-gray-600" />
          <span className="text-sm font-medium">Object Manager</span>
          <ExternalLink className="w-3.5 h-3.5 ml-auto text-gray-400 flex-shrink-0" />
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <SetupSearchTypeahead />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
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
                    <item.icon className="flex-shrink-0 w-[18px] h-[18px] text-gray-300" />
                    <span className="text-sm text-gray-400">{item.name}</span>
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
                      ? 'bg-[#ede9f5] text-brand-navy font-semibold shadow-[inset_3px_0_0_theme(colors.brand.red)]'
                      : 'text-gray-800 font-medium hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon
                    className={cn(
                      'flex-shrink-0 w-[18px] h-[18px]',
                      active ? 'text-brand-navy' : 'text-gray-500'
                    )}
                  />
                  <span className="text-sm">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-gray-200 bg-white">
        <ExitSetupPill className="w-full justify-center" />
      </div>
    </aside>
  );
}