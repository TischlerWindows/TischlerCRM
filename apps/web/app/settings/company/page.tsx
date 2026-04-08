'use client';

import { useEffect, useState } from 'react';
import { Save, Building2, Calendar, Globe, Phone, Mail, MapPin, Settings2 } from 'lucide-react';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';
import { useToast } from '@/components/toast';
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

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white transition-colors focus:ring-2 focus:ring-brand-navy/40 focus:border-brand-navy outline-none';

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
  const { showToast } = useToast();

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
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/settings/companySettings', { value: settings });
      showToast('Settings saved successfully.', 'success');
    } catch {
      showToast('Failed to save settings. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
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

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Organization Details */}
        <SettingsContentCard className="!mx-0 !my-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-5 h-5 text-brand-navy" />
              <h2 className="text-base font-semibold text-gray-900">Organization Details</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">Company Name</label>
                <input
                  id="companyName"
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className={inputClass}
                  placeholder="Tischler Und Sohn USA Ltd"
                />
              </div>
              <div>
                <label htmlFor="legalName" className="block text-sm font-medium text-gray-700 mb-1.5">Legal Name</label>
                <input
                  id="legalName"
                  type="text"
                  value={settings.legalName}
                  onChange={(e) => handleChange('legalName', e.target.value)}
                  className={inputClass}
                  placeholder="Full legal entity name"
                />
              </div>
            </div>
          </div>
        </SettingsContentCard>

        {/* Contact Information */}
        <SettingsContentCard className="!mx-0 !my-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Globe className="w-5 h-5 text-brand-navy" />
              <h2 className="text-base font-semibold text-gray-900">Contact Information</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label htmlFor="website" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Globe className="w-3.5 h-3.5" /> Website
                </label>
                <input
                  id="website"
                  type="url"
                  value={settings.website}
                  onChange={(e) => handleChange('website', e.target.value)}
                  className={inputClass}
                  placeholder="https://www.example.com"
                />
              </div>
              <div>
                <label htmlFor="phone" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Phone className="w-3.5 h-3.5" /> Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={settings.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className={inputClass}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="md:col-span-2 md:max-w-[calc(50%-0.75rem)]">
                <label htmlFor="email" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                  <Mail className="w-3.5 h-3.5" /> Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className={inputClass}
                  placeholder="info@company.com"
                />
              </div>
            </div>
          </div>
        </SettingsContentCard>

        {/* Address */}
        <SettingsContentCard className="!mx-0 !my-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <MapPin className="w-5 h-5 text-brand-navy" />
              <h2 className="text-base font-semibold text-gray-900">Address</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div className="md:col-span-2">
                <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1.5">Street Address</label>
                <input
                  id="street"
                  type="text"
                  value={settings.street}
                  onChange={(e) => handleChange('street', e.target.value)}
                  className={inputClass}
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                <input
                  id="city"
                  type="text"
                  value={settings.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1.5">State / Province</label>
                <input
                  id="state"
                  type="text"
                  value={settings.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-1.5">Zip / Postal Code</label>
                <input
                  id="zip"
                  type="text"
                  value={settings.zip}
                  onChange={(e) => handleChange('zip', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                <input
                  id="country"
                  type="text"
                  value={settings.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        </SettingsContentCard>

        {/* Locale & Fiscal Year */}
        <SettingsContentCard className="!mx-0 !my-0">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Calendar className="w-5 h-5 text-brand-navy" />
              <h2 className="text-base font-semibold text-gray-900">Locale & Fiscal Year</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1.5">Timezone</label>
                <select
                  id="timezone"
                  value={settings.timezone}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className={inputClass}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="fiscalYearStart" className="block text-sm font-medium text-gray-700 mb-1.5">Fiscal Year Starts</label>
                <select
                  id="fiscalYearStart"
                  value={settings.fiscalYearStart}
                  onChange={(e) => handleChange('fiscalYearStart', e.target.value)}
                  className={inputClass}
                >
                  {FISCAL_MONTHS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </SettingsContentCard>

        <div className="flex justify-end pt-2">
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
