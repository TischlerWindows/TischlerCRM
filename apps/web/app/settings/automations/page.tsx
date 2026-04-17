/**
 * Automations settings page — lists registered triggers and controllers
 * with per-item enable/disable toggles (opt-out model).
 */
'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { TriggerSettingDTO, ControllerSettingDTO } from '@/lib/automations/types';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';

type ActiveTab = 'triggers' | 'controllers';

export default function AutomationsPage() {
  const [triggers, setTriggers] = useState<TriggerSettingDTO[]>([]);
  const [controllers, setControllers] = useState<ControllerSettingDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('triggers');

  const load = useCallback(async () => {
    try {
      const [triggerData, controllerData] = await Promise.all([
        apiClient.getTriggerSettings(),
        apiClient.getControllerSettings(),
      ]);
      setTriggers(triggerData);
      setControllers(controllerData);
    } catch (err: any) {
      setError(err.message || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleTrigger = async (t: TriggerSettingDTO) => {
    if (toggling) return;
    setToggling(t.triggerId);
    try {
      await apiClient.updateTriggerSetting(t.triggerId, !t.enabled);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update trigger');
    } finally {
      setToggling(null);
    }
  };

  const handleToggleController = async (c: ControllerSettingDTO) => {
    if (toggling) return;
    setToggling(c.controllerId);
    try {
      await apiClient.updateControllerSetting(c.controllerId, !c.enabled);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update controller');
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
        icon={Zap}
        title="Automations"
        subtitle="Manage code-based triggers and controllers"
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

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('triggers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'triggers'
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-brand-gray hover:text-brand-dark'
          }`}
        >
          Triggers ({triggers.length})
        </button>
        <button
          onClick={() => setActiveTab('controllers')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'controllers'
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-brand-gray hover:text-brand-dark'
          }`}
        >
          Controllers ({controllers.length})
        </button>
      </div>

      {/* Trigger cards */}
      {activeTab === 'triggers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {triggers.map((t) => (
            <div
              key={t.triggerId}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            >
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-brand-dark">{t.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-medium text-brand-gray">
                        Trigger
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      t.enabled
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {t.enabled ? (
                      <>
                        <Check className="w-3 h-3" /> Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </div>

                <p className="text-xs text-brand-gray leading-relaxed mb-3">{t.description}</p>

                {/* Object + Events badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                    {t.objectApiName}
                  </span>
                  {t.events.map((event) => (
                    <span
                      key={event}
                      className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-100"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card footer — enable toggle */}
              <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-brand-gray">Enable trigger</span>
                <button
                  role="switch"
                  aria-checked={t.enabled}
                  disabled={toggling === t.triggerId}
                  onClick={() => handleToggleTrigger(t)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    t.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  {toggling === t.triggerId ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                  ) : (
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        t.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          ))}

          {triggers.length === 0 && (
            <div className="col-span-full text-center py-16 text-brand-gray">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No triggers registered yet.</p>
              <p className="text-xs mt-1 text-brand-gray/70">
                Add trigger modules to <code className="bg-gray-100 px-1 rounded">apps/api/src/triggers/</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Controller cards */}
      {activeTab === 'controllers' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {controllers.map((c) => (
            <div
              key={c.controllerId}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            >
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-brand-dark">{c.name}</h3>
                      <span className="text-[10px] uppercase tracking-wider font-medium text-brand-gray">
                        Controller
                      </span>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      c.enabled
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {c.enabled ? (
                      <>
                        <Check className="w-3 h-3" /> Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </div>

                <p className="text-xs text-brand-gray leading-relaxed mb-3">{c.description}</p>

                {/* Object + Route badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-100">
                    {c.objectApiName}
                  </span>
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600 border border-gray-100 font-mono">
                    {c.routePrefix}
                  </span>
                </div>
              </div>

              {/* Card footer — enable toggle */}
              <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                <span className="text-[11px] text-brand-gray">Enable controller</span>
                <button
                  role="switch"
                  aria-checked={c.enabled}
                  disabled={toggling === c.controllerId}
                  onClick={() => handleToggleController(c)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    c.enabled ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  {toggling === c.controllerId ? (
                    <Loader2 className="w-3 h-3 animate-spin text-white absolute left-1/2 -translate-x-1/2" />
                  ) : (
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        c.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  )}
                </button>
              </div>
            </div>
          ))}

          {controllers.length === 0 && (
            <div className="col-span-full text-center py-16 text-brand-gray">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No controllers registered yet.</p>
              <p className="text-xs mt-1 text-brand-gray/70">
                Add controller modules to <code className="bg-gray-100 px-1 rounded">apps/api/src/controllers/</code>
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
