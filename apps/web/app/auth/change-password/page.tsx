'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

function PasswordInput({ id, label, value, onChange, placeholder, minLength }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg pl-3 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
          required
          minLength={minLength}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          title={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-[#151f6d]"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('New password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      router.replace('/');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0eff8]">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Tischler und Sohn</div>
          <div className="text-xl font-bold text-[#151f6d]">TischlerCRM</div>
        </div>
        <form onSubmit={handleSubmit} className="w-full">
          <h1 className="text-2xl font-bold text-[#151f6d] mb-2">Change your password</h1>
          <p className="text-sm text-gray-500 mb-6">
            Your administrator set a temporary password. Please choose a new one to continue.
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}
          <div className="mb-4">
            <PasswordInput
              id="current-password"
              label="Current Password"
              value={currentPassword}
              onChange={setCurrentPassword}
              placeholder="Enter temporary password"
            />
          </div>
          <div className="mb-4">
            <PasswordInput
              id="new-password"
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              minLength={8}
              placeholder="Min. 8 characters"
            />
          </div>
          <div className="mb-6">
            <PasswordInput
              id="confirm-password"
              label="Confirm New Password"
              value={confirm}
              onChange={setConfirm}
              minLength={8}
              placeholder="Re-enter new password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#151f6d] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1c2b99] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Updating password…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
