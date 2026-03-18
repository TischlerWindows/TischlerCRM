'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await apiClient.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => router.replace('/login'), 2500);
    } catch (e: any) {
      setError(
        e.message.includes('invalid or has expired')
          ? 'This reset link has expired or is invalid. Please request a new one.'
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-500 mb-4">
          Invalid reset link. Please request a new one.
        </p>
        <Link href="/auth/forgot-password" className="text-[#151f6d] text-sm font-semibold hover:underline">
          Request new link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-[#151f6d] mb-2">Password updated</h2>
        <p className="text-sm text-gray-500">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold text-[#151f6d] mb-2">Set new password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Choose a strong password for your account.
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3 mb-4">
          {error}{' '}
          {error.includes('expired') && (
            <Link href="/auth/forgot-password" className="underline font-medium">
              Request new link
            </Link>
          )}
        </div>
      )}
      <div className="mb-4">
        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
          New Password
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
        className="w-full bg-[#151f6d] text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-[#1c2b99] disabled:opacity-50 transition-colors mb-4"
      >
        {loading ? 'Updating password…' : 'Update Password'}
      </button>
      <div className="text-center">
        <Link href="/login" className="text-[#151f6d] text-sm font-semibold hover:underline">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f0eff8]">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-1">Tischler und Sohn</div>
          <div className="text-xl font-bold text-[#151f6d]">TischlerCRM</div>
        </div>
        <Suspense fallback={<div className="text-sm text-gray-400 text-center py-4">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
