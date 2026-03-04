'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth();
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Login failed');
      }

      const data = await res.json();
      if (data.token && data.user) {
        setAuth(data.token, data.user);
        router.push('/');
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
        <h2 className="text-lg font-semibold text-brand-dark mb-6">Sign in to your account</h2>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-brand-navy text-white text-sm font-semibold rounded-lg hover:bg-brand-navy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-sm text-brand-dark/60">
            Don't have an account?{' '}
            <Link href="/signup" className="text-brand-navy hover:text-brand-red font-semibold transition-colors">
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-5 pt-5 border-t border-gray-100 text-xs text-brand-dark/40 space-y-0.5">
          <p className="font-medium text-brand-dark/50 mb-1">Demo credentials:</p>
          <p>test@example.com / password123</p>
        </div>
      </div>
    </div>
  );
}
