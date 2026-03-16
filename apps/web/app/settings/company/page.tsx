'use client';

import { useEffect, useState } from 'react';
import { Save, Building2, Globe, Phone, Mail, MapPin, Settings2 } from 'lucide-react';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';
import { apiClient } from '@/lib/api-client';

interface CompanySettings {
  companyName: string;
  legalName: string;
  website: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  timezone: string;
  fiscalYearStart: string;
}

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const FISCAL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<CompanySettings>({
    companyName: '',
    legalName: '',
    website: '',
    phone: '',
    email: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',
    timezone: 'America/New_York',
    fiscalYearStart: 'January',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.get<Record<string, any>>('/settings');
        if (data.companySettings) {
          setSettings((prev) => ({ ...prev, ...(data.companySettings as CompanySettings) }));
        }
      } catch {
        // Use defaults if no settings saved yet
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await apiClient.put('/settings/companySettings', { value: settings });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <SettingsPageHeader
        icon={Settings2}
        title="Company Settings"
        subtitle="Configure your organization's basic information"
      />

      <div className="p-6 space-y-6">
        {saveSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Settings saved successfully.
          </div>
        )}
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {saveError}
          </div>
        )}

        <SettingsContentCard>
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-5 h-5 text-brand-navy" />
            <h2 className="text-base font-semibold text-gray-900">Organization Details</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="Tischler Und Sohn USA Ltd"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Legal Name</label>
              <input
                type="text"
                value={settings.legalName}
                onChange={(e) => handleChange('legalName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="Full legal entity name"
              />
            </div>
          </div>
        </SettingsContentCard>

        <SettingsContentCard>
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-brand-navy" />
            <h2 className="text-base font-semibold text-gray-900">Contact Information</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</div>
              </label>
              <input
                type="url"
                value={settings.website}
                onChange={(e) => handleChange('website', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="https://www.example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</div>
              </label>
              <input
                type="tel"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</div>
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="info@company.com"
              />
            </div>
          </div>
        </SettingsContentCard>

        <SettingsContentCard>
          <div className="flex items-center gap-3 mb-6">
            <MapPin className="w-5 h-5 text-brand-navy" />
            <h2 className="text-base font-semibold text-gray-900">Address</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Street Address</label>
              <input
                type="text"
                value={settings.street}
                onChange={(e) => handleChange('street', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
                placeholder="123 Main Street"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
              <input
                type="text"
                value={settings.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">State / Province</label>
              <input
                type="text"
                value={settings.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zip / Postal Code</label>
              <input
                type="text"
                value={settings.zip}
                onChange={(e) => handleChange('zip', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
              <input
                type="text"
                value={settings.country}
                onChange={(e) => handleChange('country', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              />
            </div>
          </div>
        </SettingsContentCard>

        <SettingsContentCard>
          <h2 className="text-base font-semibold text-gray-900 mb-6">Locale & Fiscal Year</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
              <select
                value={settings.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fiscal Year Starts</label>
              <select
                value={settings.fiscalYearStart}
                onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy text-sm"
              >
                {FISCAL_MONTHS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </SettingsContentCard>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center px-5 py-2.5 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
