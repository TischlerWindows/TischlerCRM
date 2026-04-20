'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Puzzle,
  Check,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import { externalWidgets } from '@/widgets/external/registry';
import { internalWidgets } from '@/widgets/internal/registry';
import type { WidgetManifest } from '@/lib/widgets/types';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { useToast } from '@/components/toast';
import { invalidateWidgetSettingsCache } from '@/lib/use-widget-settings';

type WidgetKind = 'external' | 'internal';

interface WidgetRow {
  manifest: WidgetManifest;
  kind: WidgetKind;
  enabled: boolean;
  integration: any | null;
}

export default function WidgetsPage() {
  const [rows, setRows] = useState<WidgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(async () => {
    try {
      const [widgetSettings, integrations] = await Promise.all([
        apiClient.getWidgetSettings(),
        apiClient.getIntegrations(),
      ]);

      const settingsMap = Object.fromEntries(
        widgetSettings.map((s) => [s.widgetId, s.enabled])
      );
      const integrationMap = Object.fromEntries(
        integrations.map((i: any) => [i.provider, i])
      );

      const externalRows: WidgetRow[] = externalWidgets.map((manifest) => ({
        manifest,
        kind: 'external',
        enabled: settingsMap[manifest.id] ?? false,
        integration: manifest.integration ? (integrationMap[manifest.integration] ?? null) : null,
      }));
      const internalRows: WidgetRow[] = internalWidgets.map((manifest) => ({
        manifest,
        kind: 'internal',
        enabled: settingsMap[manifest.id] ?? false,
        integration: null,
      }));

      setRows([...internalRows, ...externalRows]);
    } catch (err: any) {
      showToast(err.message || 'Failed to load widgets', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (row: WidgetRow) => {
    if (toggling) return;
    const next = !row.enabled;
    setToggling(row.manifest.id);
    try {
      await apiClient.updateWidgetSetting(row.manifest.id, next);
      invalidateWidgetSettingsCache();
      showToast(
        `${row.manifest.name} ${next ? 'enabled' : 'disabled'}.`,
        'success',
      );
      await load();
    } catch (err: any) {
      showToast(err.message || 'Failed to update widget', 'error');
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SettingsPageHeader
        icon={Puzzle}
        title="Widgets"
        subtitle="Enable widgets to embed on record pages"
      />
      <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {rows.map((row) => {
          const { manifest, kind, enabled, integration } = row;
          const integrationConfigured = integration ? integration.enabled && (integration.hasApiKey || integration.hasClientId) : true;
          const needsIntegration = manifest.integration !== null;
          const toggleDisabled = needsIntegration && !integrationConfigured;

          return (
            <div
              key={manifest.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            >
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#f0f1f9] flex items-center justify-center">
                      <Puzzle className="w-5 h-5 text-brand-navy" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-brand-dark">{manifest.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-medium text-brand-gray">
                        {kind === 'external' ? 'External' : 'Internal'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      enabled
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {enabled ? (
                      <>
                        <Check className="w-3 h-3" /> Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </div>

                <p className="text-xs text-brand-gray leading-relaxed">{manifest.description}</p>
              </div>

              {needsIntegration && (
                <div className="px-6 pb-3">
                  <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 flex items-center justify-between">
                    <span className="text-[11px] text-brand-gray">
                      Integration:{' '}
                      <span className="font-medium text-brand-dark">{manifest.integration}</span>
                    </span>
                    {integrationConfigured ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-600 font-medium">
                        <Check className="w-3 h-3" /> Connected
                      </span>
                    ) : (
                      <Link
                        href="/settings/integrations"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 font-medium transition-colors"
                      >
                        Not configured <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                  {!integrationConfigured && (
                    <p className="mt-1.5 text-[11px] text-amber-600">
                      Set up in{' '}
                      <Link href="/settings/integrations" className="underline hover:text-amber-800">
                        Connected Apps →
                      </Link>
                    </p>
                  )}
                </div>
              )}

              <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-brand-gray">
                  {toggleDisabled ? 'Configure the required integration first' : 'Enable on record pages'}
                </span>
                <button
                  role="switch"
                  aria-checked={enabled}
                  disabled={toggleDisabled || toggling === manifest.id}
                  onClick={() => handleToggle(row)}
                  title={toggleDisabled ? 'Set up the required integration in Connected Apps first' : undefined}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  {toggling === manifest.id ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                  ) : (
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div className="col-span-full text-center py-16 text-brand-gray">
            <Puzzle className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No widgets are registered yet.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
