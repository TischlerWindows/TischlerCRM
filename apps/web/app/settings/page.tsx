'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Shield,
  Building2,
  FileText,
  Trash2,
  Lock,
  Database,
  Settings2,
  ArrowRight,
  Home,
  Plug,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface OverviewCard {
  title: string;
  icon: typeof Users;
  href: string;
  count?: number;
  description: string;
  color: string;
}

export default function SettingsPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, profilesData, deptsData] = await Promise.all([
          apiClient.get<any[]>('/admin/users').catch(() => []),
          apiClient.get<any[]>('/profiles').catch(() => []),
          apiClient.get<any[]>('/departments').catch(() => []),
        ]);
        setCounts({
          users: usersData.length,
          profiles: profilesData.length,
          departments: deptsData.length,
        });
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards: OverviewCard[] = [
    { title: 'Company Settings', icon: Home, href: '/settings/company', description: 'Organization info, address, and locale', color: '#0d9488' },
    { title: 'Users', icon: Users, href: '/settings/users', count: counts.users, description: 'Manage user accounts and access', color: '#151f6d' },
    { title: 'Profiles', icon: Shield, href: '/settings/profiles', count: counts.profiles, description: 'Define what users can see and do across the system', color: '#1e2a7a' },
    { title: 'Departments', icon: Building2, href: '/settings/departments', count: counts.departments, description: 'Organize team structure', color: '#2563eb' },
    { title: 'Audit Log', icon: FileText, href: '/settings/audit-log', description: 'Track all system activity', color: '#7c3aed' },
    { title: 'Recycle Bin', icon: Trash2, href: '/settings/recycle-bin', description: 'Restore deleted records', color: '#da291c' },
    { title: 'Security', icon: Lock, href: '/settings/security', description: 'Login history and access monitoring', color: '#059669' },
    { title: 'Backups', icon: Database, href: '/settings/backups', description: 'Database snapshots and restore', color: '#d97706' },
    { title: 'Integrations', icon: Plug, href: '/settings/integrations', description: 'Connect Google Maps, Dropbox, Outlook & more', color: '#4285F4' },
  ];

  return (
    <div className="p-8">
      {/* Overview Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
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

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-navy/20 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${card.color}12` }}
              >
                <card.icon className="w-5 h-5" style={{ color: card.color }} />
              </div>
              {card.count !== undefined && !loading && (
                <span className="text-2xl font-bold text-brand-dark">{card.count}</span>
              )}
              {loading && card.count === undefined && (
                <div className="w-8 h-7 bg-gray-100 rounded animate-pulse" />
              )}
            </div>
            <h3 className="text-sm font-semibold text-brand-dark group-hover:text-brand-navy transition-colors">
              {card.title}
            </h3>
            <p className="text-xs text-brand-gray mt-1">{card.description}</p>
            <div className="mt-3 flex items-center text-xs font-medium text-brand-navy opacity-0 group-hover:opacity-100 transition-opacity">
              Open <ArrowRight className="w-3 h-3 ml-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}