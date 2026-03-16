'use client';

import { type LucideIcon, Plus } from 'lucide-react';

interface SettingsPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
  };
}

export function SettingsPageHeader({ icon: Icon, title, subtitle, action }: SettingsPageHeaderProps) {
  return (
    <div className="px-8 py-6 bg-white border-b border-gray-200 flex items-center justify-between">
      <div className="flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-[#f0f1f9] flex items-center justify-center flex-shrink-0">
          <Icon className="w-[22px] h-[22px] text-brand-navy" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-brand-dark">{title}</h1>
          {subtitle && (
            <p className="text-[13px] text-brand-gray mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 bg-brand-navy text-white px-5 py-2.5 rounded-[10px] text-sm font-semibold hover:bg-brand-navy-light transition-colors shadow-[0_1px_3px_rgba(21,31,109,0.3)]"
        >
          {action.icon ? (
            <action.icon className="w-4 h-4" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {action.label}
        </button>
      )}
    </div>
  );
}