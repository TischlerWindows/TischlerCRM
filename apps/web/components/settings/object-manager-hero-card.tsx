'use client';

import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';

export function ObjectManagerHeroCard() {
  return (
    <Link
      href="/object-manager"
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white rounded-2xl border border-brand-navy/15 hover:border-brand-navy/30 p-6 transition-all duration-200 hover:shadow-md relative overflow-hidden mb-8"
      style={{ backgroundImage: 'linear-gradient(135deg, rgba(21,31,109,0.05), rgba(21,31,109,0.01))' }}
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-7 h-7 text-brand-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-brand-dark">Object Manager</h2>
          <p className="text-sm text-brand-gray mt-0.5">
            Create and configure objects, fields, layouts, record types, and automations
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy group-hover:translate-x-1 transition-transform">
          <span>Open</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
