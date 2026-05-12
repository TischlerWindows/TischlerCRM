'use client';

import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  /** Short accessible label for the trigger, e.g. "Section help". */
  label: string;
  /** Bold heading inside the popover. */
  title: string;
  /** Plain explanation paragraph. */
  description: string;
  /** Optional concrete example block rendered in a faint card under the description. */
  example?: string;
}

/**
 * Click-to-open help popover for editor settings. Replaces native `title=""`
 * tooltips which were slow to appear and rendered poorly for multi-line text.
 */
export function HelpHint({ label, title, description, example }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        className="inline-flex h-4 w-4 items-center justify-center rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-navy/30"
      >
        <Info className="w-3 h-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={title}
          className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-snug text-gray-700 shadow-xl"
        >
          <div className="text-[12px] font-semibold text-gray-900">{title}</div>
          <p className="mt-1 text-gray-600">{description}</p>
          {example && (
            <div className="mt-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-[10.5px] text-gray-600 whitespace-pre-wrap">
              {example}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
