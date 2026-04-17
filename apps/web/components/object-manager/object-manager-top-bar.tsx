'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { ExitSetupPill } from '@/components/settings/exit-setup-pill';

interface Crumb {
  label: string;
  href?: string;
}

interface ObjectManagerTopBarProps {
  crumbs: Crumb[];
  children?: React.ReactNode;
}

export function ObjectManagerTopBar({ crumbs, children }: ObjectManagerTopBarProps) {
  return (
    <div className="bg-brand-navy shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[48px]">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0" title="Home">
              <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden">
                <Image
                  src="/tces-logo.png"
                  alt="Tischler"
                  width={32}
                  height={32}
                  priority
                  className="object-contain"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
              <span className="text-white/80 text-sm font-semibold group-hover:text-white transition-colors hidden sm:inline">
                Tischler CRM
              </span>
            </Link>
            <span className="text-white/30">|</span>
            <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />}
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="text-white/70 hover:text-white transition-colors whitespace-nowrap"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-white font-semibold whitespace-nowrap truncate">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {children}
            <ExitSetupPill variant="dark" />
          </div>
        </div>
      </div>
    </div>
  );
}
