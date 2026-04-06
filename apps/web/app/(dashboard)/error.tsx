'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-brand-red" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-brand-dark">This page encountered an error</h2>
          <p className="mt-2 text-sm text-gray-500">
            Something went wrong loading this section. Your other data is safe.
          </p>
          {error.digest && (
            <p className="mt-1 text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-brand-dark hover:bg-gray-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
