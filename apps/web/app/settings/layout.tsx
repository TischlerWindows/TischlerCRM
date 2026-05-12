'use client';

import { useState, useEffect } from 'react';
import { AlignLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { SettingsBreadcrumb } from '@/components/settings/settings-breadcrumb';
import { useSetupHistoryTracking } from '@/lib/use-setup-history-tracking';

const STORAGE_KEY = 'tischler-settings-sidebar-collapsed';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <SettingsSidebar
        collapsed={collapsed}
        onToggleCollapse={handleToggle}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div
        className={cn(
          'flex-1 overflow-y-auto bg-brand-light transition-[margin-left] duration-200 ease-in-out',
          collapsed ? 'ml-[20px]' : 'ml-[260px]',
          'max-md:ml-0'
        )}
      >
        {/* Mobile: hamburger to open sidebar */}
        <div className="md:hidden flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-gray-600 text-sm hover:bg-gray-50"
          >
            <AlignLeft className="w-4 h-4" />
            <span>Settings Menu</span>
          </button>
        </div>

        <SettingsBreadcrumb />
        {children}
      </div>
    </div>
  );
}