'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Plus, RefreshCw, Trash2, Ban, Send, ExternalLink, Copy, Check } from 'lucide-react';
import { apiClient, UserRow, CreateUserInput, InviteStatus } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsFilterBar } from '@/components/settings/settings-filter-bar';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

const AVATAR_COLORS = ['#151f6d', '#da291c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#0f1754'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    return (parts[0]![0] ?? '?').toUpperCase();
  }
  return email[0]?.toUpperCase() ?? '?';
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const map: Record<InviteStatus, { label: string; className: string }> = {
    PENDING:  { label: 'Invite Pending', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
    EXPIRED:  { label: 'Invite Expired', className: 'bg-red-50 text-red-600 border border-red-200' },
    ACCEPTED: { label: 'Active',         className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    LEGACY:   { label: 'Active',         className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    NOT_SENT: { label: 'Not Invited',    className: 'bg-gray-100 text-gray-500 border border-gray-200' },
  };
  const { label, className } = map[status];
  return <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${className}`}>{label}</span>;
}

interface Department { id: string; name: string; }

interface ConfirmAction {
  type: 'freeze' | 'delete';
  userId: string;
  userName: string;
  isActive?: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showNewModal, setShowNewModal] = useState(false);
  const [newForm, setNewForm] = useState<CreateUserInput>({ name: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [newUserResult, setNewUserResult] = useState<{ inviteUrl?: string; inviteSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, d] = await Promise.all([
        apiClient.getUsers(),
        apiClient.get<Department[]>('/departments'),
      ]);
      setUsers(u);
      setDepartments(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (u.name?.toLowerCase().includes(q) ?? false)
      || u.email.toLowerCase().includes(q);
    const matchDept = !deptFilter || u.department?.id === deptFilter;
    const matchStatus = !statusFilter
      || (statusFilter === 'active' && (u.inviteStatus === 'ACCEPTED' || u.inviteStatus === 'LEGACY') && u.isActive)
      || (statusFilter === 'pending' && (u.inviteStatus === 'PENDING' || u.inviteStatus === 'EXPIRED'))
      || (statusFilter === 'frozen' && !u.isActive);
    return matchSearch && matchDept && matchStatus;
  });

  async function handleCreate() {
    if (!newForm.name || !newForm.email) return;
    setSaving(true);
    setError(null);
    try {
      const result = await apiClient.createUser(newForm);
      setNewUserResult({ inviteUrl: result.inviteUrl, inviteSent: result.inviteSent });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResendInvite(userId: string) {
    try {
      const result = await apiClient.resendUserInvite(userId);
      if (!result.inviteSent && result.inviteUrl) {
        await navigator.clipboard.writeText(result.inviteUrl).catch(() => {});
        alert(`Invite link copied to clipboard:\n${result.inviteUrl}`);
      } else {
        alert('Invite email resent successfully.');
      }
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction.type === 'freeze') {
        await apiClient.freezeUser(confirmAction.userId);
      } else {
        await apiClient.deleteUser(confirmAction.userId);
      }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeNewModal() {
    setShowNewModal(false);
    setNewUserResult(null);
    setNewForm({ name: '', email: '' });
    setCopied(false);
  }

  return (
    <div className="flex flex-col h-full">
      <SettingsPageHeader
        icon={Users}
        title="Users"
        subtitle="Manage team members, profiles, and account access"
        action={{
          label: 'New User',
          icon: Plus,
          onClick: () => setShowNewModal(true),
        }}
      />

      <SettingsFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search users…"
        filters={[
          {
            value: deptFilter,
            onChange: setDeptFilter,
            options: [
              { label: 'All Departments', value: '' },
              ...departments.map(d => ({ label: d.name, value: d.id })),
            ],
          },
          {
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { label: 'All Statuses', value: '' },
              { label: 'Active', value: 'active' },
              { label: 'Invite Pending', value: 'pending' },
              { label: 'Frozen', value: 'frozen' },
            ],
          },
        ]}
        resultCount={`${filtered.length} user${filtered.length !== 1 ? 's' : ''}`}
      />

      <SettingsContentCard>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm text-gray-500 font-medium">No users found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search || deptFilter || statusFilter ? 'Try adjusting your filters.' : 'Create the first user to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eae8f5]">
                  {['User', 'Profile', 'Department', 'Status', 'Last Login', ''].map(h => (
                    <th key={h} className="text-left py-2.5 px-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => {
                  const color = getAvatarColor(user.name ?? user.email);
                  const initials = getInitials(user.name, user.email);
                  const canResend = user.inviteStatus === 'PENDING' || user.inviteStatus === 'EXPIRED';

                  return (
                    <tr key={user.id} className="border-b border-[#f5f3fb] hover:bg-[#faf9fc] transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {initials}
                          </div>
                          <div>
                            <Link
                              href={`/settings/users/${user.id}`}
                              className="font-semibold text-[#151f6d] hover:underline text-sm"
                            >
                              {user.name ?? 'Unnamed'}
                            </Link>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-600">
                          {user.profile?.label ?? <span className="text-gray-300 italic">No profile</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-600">
                          {user.department?.name ?? <span className="text-gray-300 italic">—</span>}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <InviteStatusBadge status={user.inviteStatus} />
                          {!user.isActive && (
                            <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200 w-fit">
                              Frozen
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs text-gray-400">
                          {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/settings/users/${user.id}`}
                            className="p-1.5 text-gray-400 hover:text-[#151f6d] rounded-md hover:bg-[#f0eeff] transition-colors"
                            title="Open record"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                          {canResend && (
                            <button
                              onClick={() => handleResendInvite(user.id)}
                              className="p-1.5 text-amber-500 hover:text-amber-700 rounded-md hover:bg-amber-50 transition-colors"
                              title="Resend invite"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setConfirmAction({ type: 'freeze', userId: user.id, userName: user.name ?? user.email, isActive: user.isActive })}
                            className="p-1.5 text-gray-400 hover:text-orange-600 rounded-md hover:bg-orange-50 transition-colors"
                            title={user.isActive ? 'Freeze account' : 'Unfreeze account'}
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmAction({ type: 'delete', userId: user.id, userName: user.name ?? user.email })}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsContentCard>

      {/* New User Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md mx-4">
            {newUserResult ? (
              <div>
                <h2 className="text-lg font-bold text-[#151f6d] mb-3">User Created</h2>
                {newUserResult.inviteSent ? (
                  <p className="text-sm text-gray-600 mb-5">
                    An invite email has been sent. The user can set their password using the link in the email.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-3">
                      Outlook is not configured. Copy this invite link and send it manually:
                    </p>
                    <div className="flex gap-2 mb-5">
                      <input
                        readOnly
                        value={newUserResult.inviteUrl ?? ''}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 font-mono text-gray-600"
                      />
                      <button
                        onClick={() => handleCopy(newUserResult.inviteUrl ?? '')}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </>
                )}
                <button
                  className="w-full text-sm text-center py-2.5 border border-[#e2dff2] rounded-lg text-gray-500 hover:text-gray-700 hover:bg-[#f7f6fd] transition-colors"
                  onClick={closeNewModal}
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-bold text-[#151f6d] mb-5">New User</h2>
                <div className="mb-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newForm.name ?? ''}
                    onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
                    placeholder="Jane Smith"
                  />
                </div>
                <div className="mb-5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={newForm.email ?? ''}
                    onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
                    placeholder="jane@company.com"
                  />
                </div>
                <p className="text-xs text-gray-400 mb-5">
                  An invite link will be generated to set their password. You can configure profile, department, and other details on their record page.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={closeNewModal}
                    className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving || !newForm.name || !newForm.email}
                    className="px-5 py-2.5 text-sm bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Creating…' : 'Create & Send Invite'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-sm mx-4">
            <h2 className="text-base font-bold text-gray-900 mb-2">
              {confirmAction.type === 'freeze'
                ? (confirmAction.isActive ? 'Freeze Account' : 'Unfreeze Account')
                : 'Delete User'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {confirmAction.type === 'freeze'
                ? `${confirmAction.isActive ? 'Freeze' : 'Unfreeze'} ${confirmAction.userName}? ${confirmAction.isActive ? 'They will not be able to log in until unfrozen.' : 'They will regain access immediately.'}`
                : `Permanently delete ${confirmAction.userName}? This moves them to the Recycle Bin.`}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-5 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`px-5 py-2.5 text-sm text-white rounded-lg disabled:opacity-50 transition-colors ${confirmAction.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                {actionLoading ? 'Please wait…' : confirmAction.type === 'freeze' ? (confirmAction.isActive ? 'Freeze' : 'Unfreeze') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
