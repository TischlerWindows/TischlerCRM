'use client';

import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
}

export default function PageHeader({ title, icon: Icon, subtitle }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Icon className="w-6 h-6 text-brand-navy" />
            <h1 className="text-xl font-bold text-brand-dark">{title}</h1>
          </div>
        </div>
        {subtitle && (
          <p className="text-brand-dark/60 mt-1.5 text-sm">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
