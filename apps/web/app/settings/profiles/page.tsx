'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Shield, Plus, Copy, Trash2, Lock, Users, X, ChevronRight } from 'lucide-react';
import { apiClient, type Profile } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getProfiles();
      setProfiles(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!formName || !formLabel) { setError('Name and Label are required.'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await apiClient.createProfile({ name: formName, label: formLabel, description: formDescription || undefined });
      setSuccess(`Profile "${created.label}" created`);
      setShowCreate(false);
      setFormName(''); setFormLabel(''); setFormDescription('');
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create profile');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async (profile: Profile) => {
    try {
      const cloned = await apiClient.cloneProfile(profile.id);
      setSuccess(`Profile "${cloned.label}" created as a clone`);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to clone profile');
    }
  };

  const handleDelete = async (profile: Profile) => {
    if (profile.isSystem) return;
    if (!confirm(`Delete profile "${profile.label}"? Users assigned to this profile will be unassigned.`)) return;
    try {
      await apiClient.deleteProfile(profile.id);
      setSuccess(`Profile "${profile.label}" deleted`);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete profile');
    }
  };

  return (
    <>
      <SettingsPageHeader
        icon={Shield}
        title="Profiles"
        subtitle="Define what users can see and do across the system"
        action={{ label: 'New Profile', icon: Plus, onClick: () => setShowCreate(true) }}
      />

      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-8 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <SettingsContentCard>
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading profiles…</div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No profiles defined</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafafa] border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Profile</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em] hidden sm:table-cell">Description</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-[0.04em]">Members</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {profiles.map(profile => (
                <tr key={profile.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/settings/profiles/${profile.id}`}
                        className="text-sm font-medium text-[#151f6d] hover:underline"
                      >
                        {profile.label}
                      </Link>
                      {profile.isSystem && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#151f6d]/10 text-[#151f6d]">
                          <Lock className="w-2.5 h-2.5" /> System
                        </span>
                      )}
                      {profile.grantsAdminAccess && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{profile.name}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm text-gray-500 line-clamp-1">{profile.description ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3.5 h-3.5" />
                      {profile._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleClone(profile)}
                        title="Clone"
                        className="p-1.5 text-gray-400 hover:text-[#151f6d] hover:bg-[#151f6d]/10 rounded transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {!profile.isSystem && (
                        <button
                          onClick={() => handleDelete(profile)}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <Link
                        href={`/settings/profiles/${profile.id}`}
                        className="p-1.5 text-gray-400 hover:text-[#151f6d] hover:bg-[#151f6d]/10 rounded transition-colors"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SettingsContentCard>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">New Profile</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  value={formLabel}
                  onChange={e => {
                    setFormLabel(e.target.value);
                    if (!formName) setFormName(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                  }}
                  placeholder="e.g. Sales Manager"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  API Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. sales_manager"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
                />
                <p className="text-[10px] text-gray-400 mt-1">Lowercase, underscores only. Cannot be changed after creation.</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="What can users with this profile do?"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d] resize-none"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              You can configure permissions after creating the profile.
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !formName || !formLabel}
                className="px-4 py-2 text-sm bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
