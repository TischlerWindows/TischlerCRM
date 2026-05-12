'use client';

import { Info } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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

const POPOVER_WIDTH = 256;
const POPOVER_MAX_HEIGHT = 240;
const VIEWPORT_PADDING = 8;
const TRIGGER_GAP = 6;

/**
 * Click-to-open help popover for editor settings.
 *
 * Rendered via a portal to document.body with fixed positioning so it escapes
 * any ancestor with `overflow: hidden|auto` — necessary because the editor's
 * scroll container clipped the previous absolute-positioned version on the
 * narrow right panel. Position is recomputed on open/scroll/resize with
 * viewport collision detection so the popover stays fully visible.
 */
export function HelpHint({ label, title, description, example }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();

    // Default: below the trigger, horizontally centered on it.
    let top = rect.bottom + TRIGGER_GAP;
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2;

    // Clamp inside the viewport horizontally.
    const maxLeft = window.innerWidth - POPOVER_WIDTH - VIEWPORT_PADDING;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
    if (left > maxLeft) left = maxLeft;

    // Flip above when there's not enough room below.
    if (top + POPOVER_MAX_HEIGHT > window.innerHeight - VIEWPORT_PADDING) {
      top = rect.top - POPOVER_MAX_HEIGHT - TRIGGER_GAP;
      if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;
    }

    setPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const onScroll = () => computePosition();
    const onResize = () => computePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
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

  const popoverNode = open && pos
    ? (
      <div
        ref={popoverRef}
        id={popoverId}
        role="dialog"
        aria-label={title}
        style={{ position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
        className="z-[60] rounded-lg border border-gray-200 bg-white p-3 text-[11px] leading-snug text-gray-700 shadow-xl"
      >
        <div className="text-[12px] font-semibold text-gray-900">{title}</div>
        <p className="mt-1 text-gray-600">{description}</p>
        {example && (
          <div className="mt-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-[10.5px] text-gray-600 whitespace-pre-wrap">
            {example}
          </div>
        )}
      </div>
    )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
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
      {typeof document !== 'undefined' && popoverNode
        ? createPortal(popoverNode, document.body)
        : null}
    </>
  );
}
