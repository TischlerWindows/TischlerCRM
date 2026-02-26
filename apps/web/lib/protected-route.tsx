'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

const isPublicRoute = (pathname: string) => {
  const publicRoutes = ['/login', '/signup', '/'];
  if (publicRoutes.includes(pathname)) return true;
  if (pathname.startsWith('/login') || pathname.startsWith('/signup')) return true;
  return false;
};

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    console.log('ProtectedRoute: Effect running', {
      pathname,
      isAuthenticated,
      loading,
      isPublic: isPublicRoute(pathname),
    });

    if (loading) {
      // Still loading auth state, don't do anything yet
      return;
    }

    // If not authenticated and not a public route, redirect to login
    if (!isAuthenticated && !isPublicRoute(pathname)) {
      console.log('ProtectedRoute: Redirecting to login');
      router.push('/login');
    }
  }, [isAuthenticated, loading, pathname, router]);

  // While loading auth state, show loading screen
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading…</div>
      </div>
    );
  }

  // If not authenticated and trying to access protected route, show nothing (will redirect)
  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return null;
  }

  return <>{children}</>;
}
