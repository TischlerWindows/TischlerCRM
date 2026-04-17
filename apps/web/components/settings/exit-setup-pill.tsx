'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readCameFrom, clearCameFrom } from '@/lib/setup-return-to';

interface ExitSetupPillProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function ExitSetupPill({ variant = 'light', className }: ExitSetupPillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleExit = () => {
    const returnTo = searchParams?.get('returnTo');
    const cameFrom = readCameFrom();
    const target = returnTo || cameFrom || '/';
    clearCameFrom();
    router.push(target);
  };

  const styles = variant === 'dark'
    ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
    : 'bg-gray-100 hover:bg-gray-200 text-brand-dark border-gray-200';

  return (
    <button
      onClick={handleExit}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
        styles,
        className
      )}
      title="Exit Setup"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>Exit Setup</span>
    </button>
  );
}
