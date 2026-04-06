'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Database, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { apiClient, type GlobalSearchResult } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';

// Known dedicated routes — apiName → URL prefix (without trailing slash)
const DEDICATED_ROUTES: Record<string, string> = {
  Property: '/properties',
  Account: '/accounts',
  Contact: '/contacts',
  Lead: '/leads',
  Opportunity: '/opportunities',
  Project: '/projects',
  Product: '/products',
  Installation: '/installations',
  Quote: '/quotes',
  Service: '/service',
};

function getRecordUrl(objectApiName: string, recordId: string): string {
  const prefix = DEDICATED_ROUTES[objectApiName];
  if (prefix) return `${prefix}/${recordId}`;
  return `/objects/${objectApiName}/${recordId}`;
}

export default function UniversalSearch({ inputClassName, iconClassName }: { inputClassName?: string; iconClassName?: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { schema } = useSchemaStore();

  // Build dynamic placeholder from search-enabled objects
  const searchEnabledLabels = (schema?.objects ?? [])
    .filter(o => o.searchConfig?.enabled)
    .map(o => (o.pluralLabel || o.label || o.apiName).toLowerCase());

  const placeholder = searchEnabledLabels.length > 0
    ? `Search ${searchEnabledLabels.join(', ')}…`
    : 'Search…';

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const { results: r } = await apiClient.globalSearch(query);
      setResults(r);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && searchTerm) {
      setIsOpen(true);
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) handleSelect(results[selectedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: GlobalSearchResult) => {
    router.push(getRecordUrl(result.objectApiName, result.id));
    setSearchTerm('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setSearchTerm('');
    setResults([]);
    setSelectedIndex(0);
    inputRef.current?.focus();
  };

  // Group results by object type for display
  const grouped = results.reduce<Record<string, GlobalSearchResult[]>>((acc, r) => {
    (acc[r.objectApiName] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl">
      <div className="relative">
        <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400', iconClassName)} />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            setSelectedIndex(0);
          }}
          onFocus={() => searchTerm && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/40 bg-white dark:bg-gray-800 dark:text-white text-sm',
            inputClassName
          )}
          aria-label="Universal search"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && searchTerm && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No results found for &quot;{searchTerm}&quot;
            </div>
          ) : (
            <div className="py-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </div>
              {Object.entries(grouped).map(([objectApi, items]) => {
                const label = items[0]?.objectPluralLabel || objectApi;
                return (
                  <div key={objectApi}>
                    <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      {label}
                    </div>
                    {items.map((result) => {
                      const globalIdx = results.indexOf(result);
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <button
                          key={`${result.objectApiName}-${result.id}`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            'w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'bg-[#f0f1fa] dark:bg-brand-navy-dark/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          )}
                        >
                          <div className="w-8 h-8 rounded-lg bg-[#f0f1fa] dark:bg-brand-navy-dark/20 flex items-center justify-center flex-shrink-0">
                            <Database className="w-4 h-4 text-brand-navy" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {result.title}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-[#f0f1fa] text-brand-navy dark:bg-opacity-20">
                                {result.objectLabel}
                              </span>
                            </div>
                            {result.subtitle && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </p>
                            )}
                            {result.matchedFields.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Matched: {result.matchedFields.join(', ')}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
