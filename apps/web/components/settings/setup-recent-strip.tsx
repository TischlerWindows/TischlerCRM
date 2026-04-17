'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getRecent, type SetupHistoryEntry } from '@/lib/setup-history';
import { getIcon } from '@/lib/setup-icon-registry';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SetupRecentStrip() {
  const [items, setItems] = useState<SetupHistoryEntry[]>([]);
  useEffect(() => {
    setItems(getRecent(4));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-brand-gray" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">Recently Visited</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = getIcon(item.iconKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 bg-white rounded-xl border border-gray-200 hover:border-brand-navy/20 hover:shadow-sm p-3 transition-all duration-150"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-[18px] h-[18px] text-brand-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-brand-dark truncate">{item.title}</div>
                <div className="text-[11px] text-brand-gray">{formatRelative(item.visitedAt ?? Date.now())}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
