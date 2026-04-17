/**
 * Notifications settings page — admin toggles enable/disable per kind
 * (opt-out model). Mirrors the Automations page in structure.
 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, Loader2, AlertCircle, X } from 'lucide-react';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import {
  notificationsClient,
  type NotificationTypeItem,
} from '@/lib/notifications-client';

export default function NotificationSettingsPage() {
  const [items, setItems] = useState<NotificationTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items: fetched } = await notificationsClient.listTypes();
      setItems(fetched);
    } catch (err: any) {
      setError(err.message || 'Failed to load notification types');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = async (item: NotificationTypeItem) => {
    if (toggling) return;
    setToggling(item.kind);
    try {
      await notificationsClient.setTypeEnabled(item.kind, !item.enabled);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update notification type');
    } finally {
      setToggling(null);
    }
  };

  const byCategory = useMemo(() => {
    const groups = new Map<string, NotificationTypeItem[]>();
    for (const item of items) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

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
        icon={Bell}
        title="Notifications"
        subtitle="Enable or disable in-app notification types org-wide. Disabled types are suppressed for every user."
      />
      <div className="p-8">
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="space-y-8">
        {byCategory.map(([category, kinds]) => (
          <section key={category}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-gray mb-3">
              {category}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {kinds.map((item) => (
                <div
                  key={item.kind}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                >
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                          <Bell className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-brand-dark">{item.label}</h3>
                          <span className="text-[10px] uppercase tracking-wider font-medium text-brand-gray">
                            {item.kind}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                          item.enabled
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}
                      >
                        {item.enabled ? (
                          <>
                            <Check className="w-3 h-3" /> Active
                          </>
                        ) : (
                          'Disabled'
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-brand-gray leading-relaxed">{item.description}</p>
                  </div>
                  <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-brand-gray">Enable type</span>
                    <button
                      role="switch"
                      aria-checked={item.enabled}
                      disabled={toggling === item.kind}
                      onClick={() => handleToggle(item)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        item.enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      {toggling === item.kind ? (
                        <Loader2 className="w-3 h-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                      ) : (
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            item.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                          }`}
                        />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {items.length === 0 && (
          <div className="text-center py-16 text-brand-gray">
            <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No notification types registered yet.</p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
