'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Shield, Building2, FileText, Trash2, Lock, Database,
  Settings2, ArrowRight, Home, Plug, Zap, Bell, Puzzle, AlertTriangle,
  Pin, PinOff, type LucideIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ObjectManagerHeroCard } from '@/components/settings/object-manager-hero-card';
import { SetupRecentStrip } from '@/components/settings/setup-recent-strip';
import { SetupPinnedStrip } from '@/components/settings/setup-pinned-strip';
import { isPinned, togglePin } from '@/lib/setup-history';
import { getIconKey } from '@/lib/setup-icon-registry';

interface Card {
  title: string;
  icon: LucideIcon;
  href: string;
  count?: number;
  description: string;
  color: string;
  group: string;
}

export default function SettingsPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pinVersion, setPinVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, profilesData, deptsData, triggersData, controllersData] = await Promise.all([
          apiClient.get<any[]>('/admin/users').catch(() => []),
          apiClient.get<any[]>('/profiles').catch(() => []),
          apiClient.get<any[]>('/departments').catch(() => []),
          apiClient.get<any[]>('/automations/triggers').catch(() => []),
          apiClient.get<any[]>('/automations/controllers').catch(() => []),
        ]);
        setCounts({
          users: usersData.length,
          profiles: profilesData.length,
          departments: deptsData.length,
          automations: triggersData.length + controllersData.length,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards: Card[] = [
    { title: 'Company Settings', icon: Home, href: '/settings/company', description: 'Organization info, address, locale', color: '#0d9488', group: 'Company' },
    { title: 'Departments', icon: Building2, href: '/settings/departments', count: counts.departments, description: 'Team structure', color: '#2563eb', group: 'Company' },
    { title: 'Security', icon: Lock, href: '/settings/security', description: 'Login history and access monitoring', color: '#059669', group: 'Company' },
    { title: 'Users', icon: Users, href: '/settings/users', count: counts.users, description: 'Manage user accounts', color: '#151f6d', group: 'Users & Access' },
    { title: 'Profiles', icon: Shield, href: '/settings/profiles', count: counts.profiles, description: 'Role-based permissions', color: '#1e2a7a', group: 'Users & Access' },
    { title: 'Backups', icon: Database, href: '/settings/backups', description: 'Database snapshots and restore', color: '#d97706', group: 'Data Model' },
    { title: 'Recycle Bin', icon: Trash2, href: '/settings/recycle-bin', description: 'Restore deleted records', color: '#da291c', group: 'Data Model' },
    { title: 'Automations', icon: Zap, href: '/settings/automations', count: counts.automations, description: 'Triggers and controllers', color: '#f59e0b', group: 'Automation' },
    { title: 'Notifications', icon: Bell, href: '/settings/notifications', description: 'Org-wide notification preferences', color: '#6366f1', group: 'Automation' },
    { title: 'Widgets', icon: Puzzle, href: '/settings/widgets', description: 'Reusable page widgets', color: '#7c3aed', group: 'Automation' },
    { title: 'Connected Apps', icon: Plug, href: '/settings/integrations', description: 'Google Maps, Dropbox, Outlook, etc.', color: '#4285F4', group: 'Connections' },
    { title: 'Audit Log', icon: FileText, href: '/settings/audit-log', description: 'All system activity', color: '#7c3aed', group: 'Monitoring' },
    { title: 'Error Log', icon: AlertTriangle, href: '/settings/error-log', description: 'Client errors captured across the app', color: '#dc2626', group: 'Monitoring' },
  ];

  const groupOrder = ['Company', 'Users & Access', 'Data Model', 'Automation', 'Connections', 'Monitoring'];
  const cardsByGroup: Record<string, Card[]> = {};
  for (const g of groupOrder) cardsByGroup[g] = [];
  for (const c of cards) cardsByGroup[c.group]!.push(c);

  const handleTogglePin = (e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    togglePin({ href: card.href, title: card.title, iconKey: getIconKey(card.icon) || 'settings' });
    setPinVersion(v => v + 1);
  };

  return (
    <div className="p-8">
      {/* Overview Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0f1f9] flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-brand-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">Settings Overview</h1>
            <p className="text-sm text-brand-gray mt-0.5">Configure and manage your CRM environment</p>
          </div>
        </div>
      </div>

      <ObjectManagerHeroCard />
      <SetupRecentStrip key={`recent-${pinVersion}`} />
      <SetupPinnedStrip key={`pinned-${pinVersion}`} />

      {groupOrder.map((groupTitle) => {
        const items = cardsByGroup[groupTitle]!;
        if (items.length === 0) return null;
        return (
          <section key={groupTitle} className="mb-8">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray mb-3">{groupTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map((card) => {
                const pinned = isPinned(card.href);
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-navy/20 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${card.color}12` }}
                      >
                        <card.icon className="w-5 h-5" style={{ color: card.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        {card.count !== undefined && !loading && (
                          <span className="text-2xl font-bold text-brand-dark">{card.count}</span>
                        )}
                        {loading && card.count === undefined && (
                          <div className="w-8 h-7 bg-gray-100 rounded animate-pulse" />
                        )}
                        <button
                          onClick={(e) => handleTogglePin(e, card)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                          title={pinned ? 'Unpin' : 'Pin'}
                        >
                          {pinned
                            ? <PinOff className="w-3.5 h-3.5 text-brand-gray" />
                            : <Pin className="w-3.5 h-3.5 text-brand-gray" />}
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-brand-dark group-hover:text-brand-navy transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-brand-gray mt-1">{card.description}</p>
                    <div className="mt-3 flex items-center text-xs font-medium text-brand-navy opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
