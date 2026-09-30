'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Database, Search } from 'lucide-react';
import { apiClient, type GlobalSearchResult } from '@/lib/api-client';
import { getSetting } from '@/lib/preferences';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import { useSchemaStore } from '@/lib/schema-store';
import { getSearchPageLayoutForUser, type SearchPageLayoutSettings } from '@/lib/search-page-layouts';
import { getRecordUrl } from '@/components/universal-search';

export default function SearchResultsPage({ query }: { query: string }) {
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const { schema, loadSchema } = useSchemaStore();
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [settings, setSettings] = useState<SearchPageLayoutSettings | null>(null);
  const [selectedObjectApiName, setSelectedObjectApiName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!schema) void loadSchema();
  }, [schema, loadSchema]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return () => { cancelled = true; };
    }
    Promise.all([
      apiClient.globalSearch(query.trim()),
      getSetting<SearchPageLayoutSettings>('searchPageLayouts'),
    ]).then(([searchResponse, layoutSettings]) => {
      if (cancelled) return;
      setResults(searchResponse.results);
      setSettings(layoutSettings ?? null);
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Search failed. Please try again.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, user?.id]);

  const activeLayout = getSearchPageLayoutForUser(settings, user?.id ?? '');
  const groupsByObject = useMemo(() => {
    const groupedResults = results.reduce<Record<string, GlobalSearchResult[]>>((acc, result) => {
      (acc[result.objectApiName] ??= []).push(result);
      return acc;
    }, {});

    return (schema?.objects ?? [])
      .filter(objectDef => canAccess(objectDef.apiName, 'read'))
      .map(objectDef => {
        const apiName = objectDef.apiName;
        const objectResults = groupedResults[apiName] ?? [];
        return {
          apiName,
          label: objectDef.pluralLabel || objectResults[0]?.objectPluralLabel || objectDef.label || apiName,
          results: objectResults,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
  }, [canAccess, results, schema]);

  const displayedGroups = useMemo(() => {
    if (selectedObjectApiName) {
      return groupsByObject.filter(group => group.apiName === selectedObjectApiName);
    }
    const layoutObjectApiNames = activeLayout?.objectApiNames ?? groupsByObject.map(group => group.apiName);
    return layoutObjectApiNames
      .map(apiName => groupsByObject.find(group => group.apiName === apiName))
      .filter((group): group is (typeof groupsByObject)[number] => Boolean(group));
  }, [activeLayout, groupsByObject, selectedObjectApiName]);

  const displayedResultCount = displayedGroups.reduce((count, group) => count + group.results.length, 0);

  const handleSelectObject = (apiName: string | null) => {
    setSelectedObjectApiName(apiName);
  };

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-navy text-white"><Search className="h-4 w-4" /></div>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Search Results</h1>
          <p className="text-sm text-gray-500">{query ? `Results for “${query}”` : 'Enter a search term in the header to find records.'}</p>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertCircle className="h-4 w-4" />{error}</div>}

      {loading ? (
        <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Searching…</div>
      ) : query.trim() ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="self-start overflow-hidden rounded-md border border-gray-200 bg-white">
            <button type="button" onClick={() => handleSelectObject(null)} className={`w-full border-b border-gray-200 px-4 py-3 text-left text-sm font-semibold ${selectedObjectApiName === null ? 'bg-gray-50 text-brand-navy' : 'text-gray-900 hover:bg-gray-50'}`}>Top Results</button>
            <nav className="max-h-[70vh] overflow-y-auto p-2" aria-label="Search result objects">
              {groupsByObject.map(group => (
                <button key={group.apiName} type="button" onClick={() => handleSelectObject(group.apiName)} className={`flex w-full items-center justify-between gap-2 rounded px-2 py-2 text-left text-sm ${selectedObjectApiName === group.apiName ? 'bg-[#f0f1fa] text-brand-navy' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <span className="truncate">{group.label}</span>
                  <span className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500">{group.results.length}</span>
                </button>
              ))}
              {groupsByObject.length === 0 && <p className="px-2 py-3 text-sm text-gray-500">No readable objects available.</p>}
            </nav>
          </aside>

          <main className="min-w-0 space-y-3">
            <div className="rounded-md border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              {displayedResultCount} {displayedResultCount === 1 ? 'result' : 'results'} for <span className="font-medium">“{query}”</span>
            </div>
            {displayedGroups.map(group => (
              <section key={group.apiName} id={`search-section-${encodeURIComponent(group.apiName)}`} className="overflow-hidden rounded-md border border-gray-200 bg-white">
                <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <h2 className="text-sm font-semibold text-gray-800">{group.label}</h2>
                  <span className="text-xs text-gray-500">{group.results.length} {group.results.length === 1 ? 'result' : 'results'}</span>
                </div>
                {group.results.length ? (
                  <div className="divide-y divide-gray-100">
                    {group.results.map(result => (
                      <Link key={`${result.objectApiName}-${result.id}`} href={getRecordUrl(result.objectApiName, result.id)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#f0f1fa] text-brand-navy"><Database className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-brand-navy">{result.title}</span>
                          {result.subtitle && <span className="mt-0.5 block truncate text-xs text-gray-600">{result.subtitle}</span>}
                        </span>
                        <span className="hidden text-xs text-gray-500 sm:block">{result.objectLabel}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-5 text-sm text-gray-500">No matching records.</p>
                )}
              </section>
            ))}
            {displayedResultCount === 0 && displayedGroups.length === 0 && <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No results found for “{query}”.</div>}
          </main>
        </div>
      ) : null}
    </div>
  );
}