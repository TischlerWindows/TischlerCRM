'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pin, PinOff } from 'lucide-react';
import { getPinned, togglePin, getRecent, type SetupHistoryEntry } from '@/lib/setup-history';
import { getIcon } from '@/lib/setup-icon-registry';

export function SetupPinnedStrip() {
  const [pinned, setPinned] = useState<SetupHistoryEntry[]>([]);
  const [hasRecent, setHasRecent] = useState(false);

  useEffect(() => {
    setPinned(getPinned());
    setHasRecent(getRecent(1).length > 0);
  }, []);

  const handleUnpin = (e: React.MouseEvent, entry: SetupHistoryEntry) => {
    e.preventDefault();
    togglePin(entry);
    setPinned(getPinned());
  };

  if (pinned.length === 0 && !hasRecent) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Pin className="w-4 h-4 text-brand-gray" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">Pinned</h3>
      </div>

      {pinned.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-xs text-brand-gray">
          Pin any setting to keep it here.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pinned.map((item) => {
            const Icon = getIcon(item.iconKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-3 bg-white rounded-xl border border-gray-200 hover:border-brand-navy/20 hover:shadow-sm p-3 transition-all duration-150"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-[18px] h-[18px] text-brand-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-brand-dark truncate">{item.title}</div>
                </div>
                <button
                  onClick={(e) => handleUnpin(e, item)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                  title="Unpin"
                >
                  <PinOff className="w-3.5 h-3.5 text-brand-gray" />
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
