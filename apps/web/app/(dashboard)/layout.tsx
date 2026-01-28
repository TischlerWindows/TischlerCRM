'use client';

import { ReactNode } from 'react';
import { ToastProvider } from '@/components/toast';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
