export const metadata = {
  title: 'Tischler CRM',
  description: 'Tischler und Sohn CRM — Custom Windows & Doors',
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
