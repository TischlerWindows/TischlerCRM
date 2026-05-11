// Root layout for Tischler CRM web app
export const metadata = {
  title: 'Tischler CRM',
  description: 'Tischler und Sohn CRM — Custom Windows & Doors',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tischler CRM',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: '#151f6d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

import type { ReactNode } from 'react';
import './globals.css';
import AppWrapper from './app-wrapper';
import { AuthProvider } from '@/lib/auth-context';
import { PermissionsProvider } from '@/lib/permissions-context';
import { ProtectedRouteWrapper } from '@/lib/protected-route-wrapper';
import { ToastProvider } from '@/components/toast';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <PermissionsProvider>
            <ProtectedRouteWrapper>
              <ToastProvider>
                <AppWrapper>{children}</AppWrapper>
              </ToastProvider>
            </ProtectedRouteWrapper>
          </PermissionsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
