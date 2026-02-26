'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
}

export default function PageHeader({ title, icon: Icon, subtitle }: PageHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-7 h-7 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
        </div>
        {subtitle && (
          <p className="text-gray-600 mt-2">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
