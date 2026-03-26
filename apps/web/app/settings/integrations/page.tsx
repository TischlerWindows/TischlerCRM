'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Plug,
  Map,
  FolderOpen,
  Calendar,
  Check,
  X,
  Settings2,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
  Mail,
  Unplug,
  Send,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────────

interface Integration {
  id: string;
  provider: string;
  displayName: string;
  description: string;
  category: string;
  enabled: boolean;
  hasApiKey: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  config: Record<string, any>;
  updatedAt: string;
}

// Maps provider names to icons and accent colors
const PROVIDER_META: Record<string, { icon: typeof Map; color: string; docsUrl?: string }> = {
  google_maps: {
    icon: Map,
    color: '#4285F4',
    docsUrl: 'https://developers.google.com/maps/documentation/javascript/get-api-key',
  },
  dropbox: {
    icon: FolderOpen,
    color: '#0061FF',
    docsUrl: 'https://www.dropbox.com/developers/apps',
  },
  outlook: {
    icon: Calendar,
    color: '#0078D4',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/auth-register-app-v2',
  },
};

// ── Main page ──────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<string | null>(null); // provider being configured
  const [error, setError] = useState<string | null>(null);

  const loadIntegrations = useCallback(async () => {
    try {
      const data = await apiClient.getIntegrations();
      setIntegrations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0f1f9] flex items-center justify-center">
            <Plug className="w-6 h-6 text-brand-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">Integrations</h1>
            <p className="text-sm text-brand-gray mt-0.5">
              Connect external services to extend your CRM
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Integration cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const meta = PROVIDER_META[integration.provider] || {
            icon: Plug,
            color: '#6b7280',
          };
          const Icon = meta.icon;
          const isConfiguring = configuring === integration.provider;

          return (
            <div
              key={integration.provider}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden transition-all hover:shadow-md"
            >
              {/* Card header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${meta.color}14` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-brand-dark">
                        {integration.displayName}
                      </h3>
                      <span className="text-[10px] uppercase tracking-wider font-medium text-brand-gray">
                        {integration.category}
                      </span>
                    </div>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      integration.enabled
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {integration.enabled ? (
                      <>
                        <Check className="w-3 h-3" /> Active
                      </>
                    ) : (
                      'Inactive'
                    )}
                  </span>
                </div>

                <p className="text-xs text-brand-gray leading-relaxed">{integration.description}</p>
              </div>

              {/* Card footer / actions */}
              <div className="px-6 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-between">
                {meta.docsUrl && (
                  <a
                    href={meta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-brand-gray hover:text-brand-navy flex items-center gap-1 transition-colors"
                  >
                    Docs <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  onClick={() => setConfiguring(isConfiguring ? null : integration.provider)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-navy bg-white border border-gray-200 hover:border-brand-navy/30 hover:bg-brand-navy/5 transition-all"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Configure
                </button>
              </div>

              {/* Expandable config panel */}
              {isConfiguring && (
                <ConfigPanel
                  integration={integration}
                  onSave={async () => {
                    setConfiguring(null);
                    await loadIntegrations();
                  }}
                  onCancel={() => setConfiguring(null)}
                  onError={setError}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Config panel (expandable per-card) ─────────────────────────────

interface ConfigPanelProps {
  integration: Integration;
  onSave: () => Promise<void>;
  onCancel: () => void;
  onError: (msg: string) => void;
}

function ConfigPanel({ integration, onSave, onCancel, onError }: ConfigPanelProps) {
  const authType = integration.config?.authType || 'api_key';
  const [enabled, setEnabled] = useState(integration.enabled);
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { enabled };

      if (authType === 'api_key') {
        // Only send apiKey if user typed something new
        if (apiKey.trim()) payload.apiKey = apiKey.trim();
      } else {
        if (clientId.trim()) payload.clientId = clientId.trim();
        if (clientSecret.trim()) payload.clientSecret = clientSecret.trim();
      }

      await apiClient.updateIntegration(integration.provider, payload);
      await onSave();
    } catch (err: any) {
      onError(err.message || 'Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(`Reset ${integration.displayName}? This will disconnect all users and clear credentials.`)) return;
    setSaving(true);
    try {
      await apiClient.resetIntegration(integration.provider);
      await onSave();
    } catch (err: any) {
      onError(err.message || 'Failed to reset integration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-6 py-5">
      {/* Enable toggle */}
      <label className="flex items-center gap-3 mb-5 cursor-pointer">
        <button
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>
        <span className="text-sm font-medium text-brand-dark">
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </label>

      {/* Hidden honeypot fields to absorb browser autofill */}
      <input type="text" name="prevent_autofill_username" autoComplete="username" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />
      <input type="password" name="prevent_autofill_password" autoComplete="current-password" style={{ display: 'none' }} tabIndex={-1} aria-hidden="true" />

      {/* Credentials — API key vs OAuth */}
      {authType === 'api_key' ? (
        <div className="mb-4">
          <label className="block text-xs font-medium text-brand-dark mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="new-password"
              placeholder={integration.hasApiKey ? '••••••••  (already set — enter new to replace)' : 'Paste your API key'}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-10 text-sm text-brand-dark placeholder:text-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none transition"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {integration.hasApiKey && (
            <p className="mt-1 text-[11px] text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" /> Key is configured
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3">
            <label className="block text-xs font-medium text-brand-dark mb-1.5">Client ID</label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              autoComplete="new-password"
              placeholder={integration.hasClientId ? '(already set — enter new to replace)' : 'OAuth Client ID'}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 px-3 text-sm text-brand-dark placeholder:text-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none transition"
            />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-brand-dark mb-1.5">Client Secret</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                autoComplete="new-password"
                placeholder={integration.hasClientSecret ? '••••••••  (already set)' : 'OAuth Client Secret'}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-3 pr-10 text-sm text-brand-dark placeholder:text-gray-400 focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {!(integration.hasClientId || clientId.trim()) && (
            <p className="text-[11px] text-amber-600 bg-amber-50 rounded-md px-3 py-2 mb-4">
              OAuth connect flow for {integration.displayName} will be available once client credentials are configured.
            </p>
          )}
        </>
      )}

      {/* Outlook-specific connect section */}
      {integration.provider === 'outlook' && (integration.hasClientId || clientId.trim()) && (
        <OutlookConnectSection integration={integration} />
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleReset}
          disabled={saving}
          className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
        >
          Reset Integration
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-brand-gray border border-gray-200 hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-4 py-1.5 text-xs font-medium text-white bg-brand-navy hover:bg-brand-navy/90 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Outlook connect / status / disconnect ──────────────────────────

function OutlookConnectSection({ integration }: { integration: Integration }) {
  const [status, setStatus] = useState<{
    connected: boolean;
    externalEmail?: string;
    connectedAt?: string;
    connectedBy?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await apiClient.getOutlookStatus();
      setStatus({ connected: s.connected, externalEmail: s.externalEmail, connectedAt: s.connectedAt, connectedBy: s.connectedBy });
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Listen for OAuth popup result
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'outlook-oauth-result') return;
      setConnecting(false);
      if (e.data.status === 'connected') {
        loadStatus();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await apiClient.getOutlookConnectUrl();
      const w = 600, h = 700;
      const left = window.screenX + (window.outerWidth - w) / 2;
      const top = window.screenY + (window.outerHeight - h) / 2;
      popupRef.current = window.open(url, 'outlook_oauth', `width=${w},height=${h},left=${left},top=${top}`);
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Outlook? Invite emails will no longer be sent.')) return;
    setDisconnecting(true);
    try {
      await apiClient.disconnectOutlook();
      setStatus({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestEmail = async () => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await apiClient.sendOutlookTestEmail();
      setTestResult(res.message || 'Test email sent!');
    } catch (err: any) {
      setTestResult(err.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 text-xs text-brand-gray">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking Outlook connection…
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
      <h4 className="text-xs font-semibold text-brand-dark mb-3 flex items-center gap-1.5">
        <Mail className="w-3.5 h-3.5" style={{ color: '#0078D4' }} />
        Outlook Connection
      </h4>

      {status?.connected ? (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
              <Check className="w-3 h-3" /> Connected
            </span>
            {status.externalEmail && (
              <span className="text-[11px] text-brand-gray">{status.externalEmail}</span>
            )}
          </div>
          {status.connectedBy && (
            <p className="text-[11px] text-brand-gray mb-3">
              Connected by {status.connectedBy}
              {status.connectedAt && ` on ${new Date(status.connectedAt).toLocaleDateString()}`}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestEmail}
              disabled={sendingTest}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white bg-[#0078D4] hover:bg-[#006CBE] transition disabled:opacity-50"
            >
              {sendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Test Email
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
              Disconnect
            </button>
          </div>
          {testResult && (
            <p className="mt-2 text-[11px] text-brand-gray">{testResult}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-[11px] text-brand-gray mb-3">
            Connect an Outlook account to send invite and notification emails from the CRM.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white bg-[#0078D4] hover:bg-[#006CBE] transition disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
            Connect Outlook Account
          </button>
        </>
      )}
    </div>
  );
}
