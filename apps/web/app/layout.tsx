export const metadata = {
  title: 'TCES',
  description: 'tishcler crm prototype'
};

import type { ReactNode } from 'react';
import './globals.css';
import AppWrapper from './app-wrapper';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
