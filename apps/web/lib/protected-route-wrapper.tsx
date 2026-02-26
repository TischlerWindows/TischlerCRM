'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const isPublicRoute = (pathname: string) => {
  // Only login and signup are fully public
  return pathname === '/login' || pathname === '/signup';
};

export function ProtectedRouteWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    console.log('ProtectedRouteWrapper effect:', {
      pathname,
      isAuthenticated,
      loading,
      isPublic: isPublicRoute(pathname),
    });

    // Don't redirect while loading
    if (loading) return;

    // If trying to access protected route without auth
    if (!isAuthenticated && !isPublicRoute(pathname)) {
      console.log('Redirecting to login');
      router.push('/login');
    }
  }, [pathname, router, isAuthenticated, loading]);

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-gray-600 text-lg">Loading…</div>
      </div>
    );
  }

  // If not authenticated and on protected route, show nothing (will redirect)
  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
