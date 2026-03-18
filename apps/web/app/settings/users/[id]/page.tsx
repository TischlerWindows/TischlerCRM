'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, User, Phone, Building2,
  Lock, Unlock, Trash2, RefreshCw, Send, Save, X,
  Clock, AlertCircle, CheckCircle,
} from 'lucide-react';
import { apiClient, type UserDetail, type LoginEventRow, type UpdateUserInput, type Profile, type UserRow } from '@/lib/api-client';

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Berlin', 'Europe/Zurich',
];

const LOCALES = [
  { value: 'en_US', label: 'English (US)' },
  { value: 'en_GB', label: 'English (UK)' },
  { value: 'de_DE', label: 'German' },
  { value: 'de_CH', label: 'German (Swiss)' },
  { value: 'fr_FR', label: 'French' },
  { value: 'es_ES', label: 'Spanish' },
  { value: 'it_IT', label: 'Italian' },
  { value: 'pt_BR', label: 'Portuguese (Brazil)' },
];

type Tab = 'details' | 'login-history';

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InviteBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:  { label: 'Invite Pending',  cls: 'bg-amber-100 text-amber-700' },
    EXPIRED:  { label: 'Invite Expired',  cls: 'bg-red-100 text-red-600' },
    ACCEPTED: { label: 'Invite Accepted', cls: 'bg-green-100 text-green-700' },
    LEGACY:   { label: 'Legacy Account',  cls: 'bg-gray-100 text-gray-600' },
    NOT_SENT: { label: 'Not Invited',     cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>;
}

export default function UserRecordPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('details');
  const [isAdmin, setIsAdmin] = useState(false);

  const [loginHistory, setLoginHistory] = useState<LoginEventRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmAction, setConfirmAction] = useState<'freeze' | 'delete' | 'resetpw' | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formMobilePhone, setFormMobilePhone] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formAlias, setFormAlias] = useState('');
  const [formTimezone, setFormTimezone] = useState('');
  const [formLocale, setFormLocale] = useState('');
  const [formProfileId, setFormProfileId] = useState('');
  const [formDepartmentId, setFormDepartmentId] = useState('');
  const [formManagerId, setFormManagerId] = useState('');

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = await apiClient.getUser(id);
      setUser(u);
      setFormName(u.name ?? '');
      setFormEmail(u.email);
      setFormTitle(u.title ?? '');
      setFormPhone(u.phone ?? '');
      setFormMobilePhone(u.mobilePhone ?? '');
      setFormNickname(u.nickname ?? '');
      setFormAlias(u.alias ?? '');
      setFormTimezone(u.timezone ?? '');
      setFormLocale(u.locale ?? '');
      setFormProfileId(u.profile?.id ?? '');
      setFormDepartmentId(u.department?.id ?? '');
      setFormManagerId(u.manager?.id ?? '');
      setDirty(false);

      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setIsAdmin(payload.role === 'ADMIN');
        } catch { /* noop */ }
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      apiClient.getProfiles().catch(() => [] as Profile[]),
      apiClient.get<{ id: string; name: string }[]>('/departments').catch(() => []),
      apiClient.getUsers().catch(() => [] as UserRow[]),
    ]).then(([p, d, u]) => {
      setProfiles(p);
      setDepartments(d);
      setAllUsers(u);
    });
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await apiClient.getUserLoginHistory(id);
      setLoginHistory(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load login history');
    } finally {
      setHistoryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'login-history' && isAdmin) loadHistory();
  }, [tab, isAdmin, loadHistory]);

  const markDirty = () => setDirty(true);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data: UpdateUserInput = {
        name: formName || undefined,
        title: formTitle || null,
        phone: formPhone || null,
        mobilePhone: formMobilePhone || null,
        nickname: formNickname || null,
        alias: formAlias || null,
        timezone: formTimezone || null,
        locale: formLocale || null,
        profileId: formProfileId || null,
        departmentId: formDepartmentId || null,
        managerId: formManagerId || null,
      };
      await apiClient.updateUser(id, data);
      setSuccess('User saved');
      setDirty(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleFreeze = async () => {
    try {
      await apiClient.freezeUser(id);
      setSuccess(user?.isActive ? 'User frozen' : 'User reactivated');
      setConfirmAction(null);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to freeze/unfreeze user');
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.deleteUser(id);
      router.replace('/settings/users');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    setPwError(null);
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    try {
      await apiClient.adminSetUserPassword(id, newPassword);
      setSuccess('Password updated');
      setConfirmAction(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setPwError(e.message ?? 'Failed to reset password');
    }
  };

  const handleResendInvite = async () => {
    try {
      const result = await apiClient.resendUserInvite(id);
      if (result.inviteUrl) {
        setSuccess(`Invite link: ${result.inviteUrl}`);
      } else {
        setSuccess('Invite email sent');
      }
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to resend invite');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading user…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-500 text-sm">User not found</p>
        <Link href="/settings/users" className="text-[#151f6d] text-sm font-semibold hover:underline">
          Back to Users
        </Link>
      </div>
    );
  }

  const initials = (user.name ?? user.email).split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <Link
            href="/settings/users"
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#151f6d] mb-3 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> All Users
          </Link>
          <div className="w-12 h-12 rounded-full bg-[#151f6d] flex items-center justify-center text-white font-bold text-base mb-3">
            {initials}
          </div>
          <h2 className="text-sm font-bold text-gray-900 leading-tight">{user.name ?? '(no name)'}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">{user.email}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {user.isActive ? 'Active' : 'Frozen'}
            </span>
            <InviteBadge status={user.inviteStatus} />
          </div>
        </div>

        <div className="p-4 border-b border-gray-100 space-y-2.5">
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Profile</div>
            <div className="text-xs text-gray-700">{user.profile?.label ?? '—'}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Department</div>
            <div className="text-xs text-gray-700">{user.department?.name ?? '—'}</div>
          </div>
          {user.title && (
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Title</div>
              <div className="text-xs text-gray-700">{user.title}</div>
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="p-4 space-y-1.5">
            <button
              onClick={() => setConfirmAction('resetpw')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reset Password
            </button>
            {(user.inviteStatus === 'PENDING' || user.inviteStatus === 'EXPIRED' || user.inviteStatus === 'NOT_SENT') && (
              <button
                onClick={handleResendInvite}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> {user.inviteStatus === 'NOT_SENT' ? 'Send Invite' : 'Resend Invite'}
              </button>
            )}
            <button
              onClick={() => setConfirmAction('freeze')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            >
              {user.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {user.isActive ? 'Freeze User' : 'Reactivate User'}
            </button>
            <button
              onClick={() => setConfirmAction('delete')}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete User
            </button>
          </div>
        )}
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#f8f8fc]">
        {/* Sticky save bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{user.name ?? user.email}</h1>
            <p className="text-[11px] text-gray-400">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] disabled:opacity-40 transition-colors font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />{success}</span>
            <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-0 border-b border-gray-200">
            {(['details', ...(isAdmin ? ['login-history'] : [])] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t ? 'border-[#151f6d] text-[#151f6d]' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'details' ? 'User Information' : 'Login History'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {tab === 'details' && (
            <>
              {/* Personal Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Full Name">
                    <input value={formName} onChange={e => { setFormName(e.target.value); markDirty(); }} className={inputCls} placeholder="Full name" />
                  </Field>
                  <Field label="Email">
                    <input value={formEmail} disabled className={`${inputCls} bg-gray-50 text-gray-400 cursor-default`} />
                  </Field>
                  <Field label="Title / Job Title">
                    <input value={formTitle} onChange={e => { setFormTitle(e.target.value); markDirty(); }} className={inputCls} placeholder="e.g. Sales Manager" />
                  </Field>
                  <Field label="Nickname">
                    <input value={formNickname} onChange={e => { setFormNickname(e.target.value); markDirty(); }} className={inputCls} placeholder="Informal name" />
                  </Field>
                  <Field label="Alias">
                    <input value={formAlias} onChange={e => { setFormAlias(e.target.value); markDirty(); }} className={inputCls} placeholder="Short display alias" />
                  </Field>
                </div>
              </div>

              {/* Contact */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-400" /> Contact
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Work Phone">
                    <input value={formPhone} onChange={e => { setFormPhone(e.target.value); markDirty(); }} className={inputCls} placeholder="+1 (555) 000-0000" />
                  </Field>
                  <Field label="Mobile Phone">
                    <input value={formMobilePhone} onChange={e => { setFormMobilePhone(e.target.value); markDirty(); }} className={inputCls} placeholder="+1 (555) 000-0000" />
                  </Field>
                </div>
              </div>

              {/* Organization */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" /> Organization
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Profile">
                    <select value={formProfileId} onChange={e => { setFormProfileId(e.target.value); markDirty(); }} className={inputCls}>
                      <option value="">— None —</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Department">
                    <select value={formDepartmentId} onChange={e => { setFormDepartmentId(e.target.value); markDirty(); }} className={inputCls}>
                      <option value="">— None —</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Manager">
                    <select value={formManagerId} onChange={e => { setFormManagerId(e.target.value); markDirty(); }} className={inputCls}>
                      <option value="">— None —</option>
                      {allUsers.filter(u => u.id !== id).map(u => <option key={u.id} value={u.id}>{u.name ?? u.email}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* Locale */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Locale & Time</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Timezone">
                    <select value={formTimezone} onChange={e => { setFormTimezone(e.target.value); markDirty(); }} className={inputCls}>
                      <option value="">— Select —</option>
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </Field>
                  <Field label="Language / Locale">
                    <select value={formLocale} onChange={e => { setFormLocale(e.target.value); markDirty(); }} className={inputCls}>
                      <option value="">— Select —</option>
                      {LOCALES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {/* System info */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" /> System Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <InfoRow label="Created" value={formatDate(user.createdAt)} />
                  <InfoRow label="Created By" value={user.createdBy?.name ?? '—'} />
                  <InfoRow label="Last Login" value={formatDate(user.lastLoginAt)} />
                  <InfoRow label="Invite Sent" value={formatDate(user.inviteSentAt)} />
                  <InfoRow label="Invite Accepted" value={formatDate(user.inviteAcceptedAt)} />
                </div>
              </div>
            </>
          )}

          {tab === 'login-history' && isAdmin && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {historyLoading ? (
                <div className="p-12 text-center text-gray-400 text-sm">Loading history…</div>
              ) : loginHistory.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">No login history recorded</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Date / Time</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">IP Address</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">User Agent</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loginHistory.map(ev => (
                      <tr key={ev.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDate(ev.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600">{ev.ip}</td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[220px] truncate">{ev.userAgent ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ev.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                            {ev.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Reset Password Modal ──────────────────────────────────────── */}
      {confirmAction === 'resetpw' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Reset Password</h3>
            {pwError && <p className="text-sm text-red-600 mb-3">{pwError}</p>}
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputCls} minLength={8} placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputCls} minLength={8} placeholder="Re-enter password" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setConfirmAction(null); setPwError(null); setNewPassword(''); setConfirmPassword(''); }} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleResetPassword} className="px-4 py-2 text-sm bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99]">Update Password</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Freeze / Delete Confirm ──────────────────────────────────── */}
      {(confirmAction === 'freeze' || confirmAction === 'delete') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {confirmAction === 'freeze' ? (user.isActive ? 'Freeze User?' : 'Reactivate User?') : 'Delete User?'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              {confirmAction === 'freeze'
                ? user.isActive
                  ? 'This user will no longer be able to log in. You can reactivate them at any time.'
                  : 'This user will be able to log in again.'
                : 'This action cannot be undone. All data associated with this user will be removed.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={confirmAction === 'freeze' ? handleFreeze : handleDelete}
                className={`px-4 py-2 text-sm rounded-lg text-white ${confirmAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                {confirmAction === 'freeze' ? (user.isActive ? 'Freeze' : 'Reactivate') : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 w-28 mt-0.5 flex-shrink-0">{label}</span>
      <span className="text-gray-700">{value}</span>
    </div>
  );
}
