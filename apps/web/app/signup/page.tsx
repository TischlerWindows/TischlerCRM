'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${apiBase}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Signup failed');
      }

      const data = await res.json();
      setSuccess(true);

      if (data.token) {
        document.cookie = `auth-token=${data.token}; path=/; max-age=28800`;
        sessionStorage.setItem('user', JSON.stringify(data.user));
        setTimeout(() => router.push('/'), 1500);
      } else {
        setTimeout(() => router.push('/login'), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-navy flex flex-col items-center justify-center p-4">
      {/* Logo Block */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-lg bg-brand-navy border border-white/20 flex items-center justify-center overflow-hidden mb-4 shadow-lg">
          <Image
            src="/tces-logo.png"
            alt="Tischler"
            width={48}
            height={48}
            priority
            className="object-contain"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-wide">Tischler CRM</h1>
        <p className="text-white/50 text-sm mt-1">Windows & Doors — Custom Engineered</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl p-8">
        <h2 className="text-lg font-semibold text-brand-dark mb-6">Create your account</h2>

        {success && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Account created! Redirecting…</span>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-dark/70 uppercase tracking-wider mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy outline-none transition text-brand-dark"
              placeholder="Jane Smith"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-dark/70 uppercase tracking-wider mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy outline-none transition text-brand-dark"
              placeholder="you@tischlerwindows.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-dark/70 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy outline-none transition text-brand-dark"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-dark/70 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy outline-none transition text-brand-dark"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-brand-navy text-white text-sm font-semibold rounded-lg hover:bg-brand-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-brand-dark/60">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-navy hover:text-brand-red font-semibold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
