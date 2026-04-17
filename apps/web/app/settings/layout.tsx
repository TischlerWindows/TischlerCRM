'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { SettingsBreadcrumb } from '@/components/settings/settings-breadcrumb';
import { useSetupHistoryTracking } from '@/lib/use-setup-history-tracking';

const STORAGE_KEY = 'tischler-settings-sidebar-collapsed';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useSetupHistoryTracking();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'true') setCollapsed(true);

    // Auto-collapse on narrow viewports
    const mq = window.matchMedia('(max-width: 1024px)');
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true);
    };
    handleResize(mq);
    mq.addEventListener('change', handleResize);
    return () => mq.removeEventListener('change', handleResize);
  }, []);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-48px)]">
      <SettingsSidebar collapsed={collapsed} onToggleCollapse={handleToggle} />
      <div
        className={cn(
          'flex-1 overflow-y-auto bg-brand-light transition-[margin-left] duration-200 ease-in-out',
          collapsed ? 'ml-[20px]' : 'ml-[260px]'
        )}
      >
        <SettingsBreadcrumb />
        {children}
      </div>
    </div>
  );
}