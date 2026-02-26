export const metadata = {
  title: 'TCES',
  description: 'tishcler crm prototype'
};

import type { ReactNode } from 'react';
import './globals.css';
import AppWrapper from './app-wrapper';
import { AuthProvider } from '@/lib/auth-context';
import { ProtectedRouteWrapper } from '@/lib/protected-route-wrapper';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <ProtectedRouteWrapper>
            <AppWrapper>{children}</AppWrapper>
          </ProtectedRouteWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
