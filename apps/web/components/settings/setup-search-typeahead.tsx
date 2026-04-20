'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';
import {
  buildSidebarItems, buildObjectItems, buildObjectSectionItems,
  buildUserItems, buildProfileItems, searchIndex,
  type SearchItem, type SearchGroup,
} from '@/lib/setup-search-index';
import { getIcon } from '@/lib/setup-icon-registry';

const MAX_PER_GROUP = 5;
const GROUP_ORDER: SearchGroup[] = ['Pages', 'Objects', 'Users', 'Profiles'];

export function SetupSearchTypeahead() {
  const router = useRouter();
  const { schema } = useSchemaStore();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string; label?: string }>>([]);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focused || remoteLoaded) return;
    (async () => {
      const [u, p] = await Promise.all([
        apiClient.get<any[]>('/admin/users').catch(() => []),
        apiClient.get<any[]>('/profiles').catch(() => []),
      ]);
      setUsers(u.map((x: any) => ({ id: x.id, name: x.name, email: x.email })));
      setProfiles(p.map((x: any) => ({ id: x.id, name: x.name, label: x.label })));
      setRemoteLoaded(true);
    })();
  }, [focused, remoteLoaded]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const allItems: SearchItem[] = useMemo(() => [
    ...buildSidebarItems(),
    ...buildObjectItems(schema),
    ...buildObjectSectionItems(schema),
    ...buildUserItems(users),
    ...buildProfileItems(profiles),
  ], [schema, users, profiles]);

  const results = useMemo(() => searchIndex(query, allItems), [query, allItems]);

  const grouped: Record<SearchGroup, SearchItem[]> = { Pages: [], Objects: [], Users: [], Profiles: [] };
  for (const r of results) grouped[r.group].push(r);
  const visibleGroups = GROUP_ORDER.filter(g => grouped[g].length > 0);
  const flatVisible = visibleGroups.flatMap(g => grouped[g].slice(0, MAX_PER_GROUP));

  useEffect(() => { setActiveIndex(0); }, [query]);

  const open = focused && query.trim().length > 0;

  const navigateTo = (href: string) => {
    if (href === '/object-manager' || href.startsWith('/object-manager/')) {
      window.open(href, '_blank', 'noopener,noreferrer');
    } else {
      router.push(href);
    }
    setQuery('');
    setFocused(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatVisible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatVisible[activeIndex];
      if (target) navigateTo(target.href);
    } else if (e.key === 'Escape') {
      setQuery('');
      setFocused(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="search"
          placeholder="Search settings, objects, users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          autoComplete="off"
          className="w-full bg-gray-100 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {visibleGroups.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-brand-gray">No matches for &quot;{query}&quot;</div>
          ) : (
            visibleGroups.map((group) => {
              const items = grouped[group].slice(0, MAX_PER_GROUP);
              return (
                <div key={group} className="py-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray bg-gray-50/60">{group}</div>
                  {items.map((item) => {
                    const flatIndex = flatVisible.indexOf(item);
                    const active = flatIndex === activeIndex;
                    const Icon = getIcon(item.iconKey);
                    return (
                      <button
                        key={`${item.group}-${item.href}-${item.primary}`}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => navigateTo(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${active ? 'bg-[#ede9f5]' : 'hover:bg-gray-50'}`}
                      >
                        <Icon className="w-[18px] h-[18px] text-brand-navy flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-brand-dark truncate">{item.primary}</div>
                          {item.secondary && (
                            <div className="text-[11px] text-brand-gray truncate">{item.secondary}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
