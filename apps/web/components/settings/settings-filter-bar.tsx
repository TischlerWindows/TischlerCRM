'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  placeholder?: string;
}

interface SettingsFilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  resultCount?: string;
  children?: React.ReactNode;
}

export function SettingsFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters,
  resultCount,
  children,
}: SettingsFilterBarProps) {
  return (
    <div className="px-8 py-4 bg-white flex items-center gap-3 flex-wrap">
      {onSearchChange !== undefined && (
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
          <input
            type="text"
            value={searchValue || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="w-full py-2.5 pl-10 pr-4 border border-gray-200 rounded-[10px] text-[13px] bg-gray-50/50 outline-none focus:border-brand-navy focus:bg-white focus:shadow-[0_0_0_3px_rgba(21,31,109,0.08)] transition-all"
          />
        </div>
      )}
      {filters?.map((filter, i) => (
        <select
          key={i}
          value={filter.value}
          onChange={(e) => filter.onChange(e.target.value)}
          className="py-2.5 pl-3.5 pr-8 border border-gray-200 rounded-[10px] text-[13px] text-gray-600 bg-gray-50/50 outline-none cursor-pointer focus:border-brand-navy focus:bg-white appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239f9fa2%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_12px_center]"
        >
          {filter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ))}
      {children}
      {resultCount && (
        <span className="ml-auto text-xs text-brand-gray">{resultCount}</span>
      )}
    </div>
  );
}