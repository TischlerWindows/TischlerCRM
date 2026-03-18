'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const result = await apiClient.acceptInvite(token, password);
      apiClient.setToken(result.token);
      router.replace('/dashboard');
    } catch (e: any) {
      setError(
        e.message.includes('invalid or has expired')
          ? 'This invite link has expired or is invalid. Contact your administrator for a new invite.'
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center text-red-500 text-sm">
        Invalid invite link. Please contact your administrator.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <h1 className="text-2xl font-bold text-[#151f6d] mb-2">Set your password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a password to complete your account setup.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}
      <div className="mb-4">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
          required
          minLength={8}
          placeholder="Min. 8 characters"
        />
      </div>
      <div className="mb-6">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          Confirm Password
        </label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d]"
          required
          minLength={8}
          placeholder="Re-enter password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#151f6d] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1c2b99] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Setting up account…' : 'Create Account'}
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0eff8]">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Tischler und Sohn</div>
          <div className="text-xl font-bold text-[#151f6d]">TischlerCRM</div>
        </div>
        <Suspense fallback={<div className="text-sm text-gray-400 text-center py-4">Loading…</div>}>
          <AcceptInviteForm />
        </Suspense>
      </div>
    </div>
  );
}
