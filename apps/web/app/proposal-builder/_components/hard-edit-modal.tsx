'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText } from 'lucide-react';
import type { ProposalAssemblyResult } from '@crm/proposal-assembly';
import type { PageLogoRule } from '@crm/types';
import { LetterPreview, type BrandFontMap } from './letter-preview';

interface Props {
  result: ProposalAssemblyResult;
  brandFonts: BrandFontMap;
  pageLogos: PageLogoRule[];
  onClose: () => void;
}

export function HardEditModal({ result, brandFonts, pageLogos, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // After the LetterPreview has rendered visibly (images + fonts load because
  // it is on-screen), find the paper div and flip it to contentEditable so the
  // user can click anywhere and type. We also neutralise the block-select
  // click handlers that LetterPreview attaches (they'd fight text selection).
  useEffect(() => {
    const timer = setTimeout(() => {
      const paper = containerRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md');
      if (!paper) return;

      paper.contentEditable = 'true';
      paper.style.outline = 'none';

      // Turn block-wrapper cursor-pointer divs into text cursors so editing
      // feels natural and the React onClick handlers don't interrupt selection.
      paper.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]').forEach((el) => {
        el.style.cursor = 'text';
        el.style.pointerEvents = 'none';
        el.querySelectorAll<HTMLElement>('p, span, strong, em, li, div:not([class*="cursor-pointer"])')
          .forEach((leaf) => { leaf.style.pointerEvents = 'auto'; });
      });

      setReady(true);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  // Capture the edited paper DOM as a self-contained HTML blob and open it
  // in a new tab. Using blob: URL (not about:blank) means the browser sets a
  // unique opaque origin and all link[href] stylesheet URLs are resolved using
  // their absolute form (link.href property is always absolute). The logo img
  // src is already an absolute API URL so it loads normally.
  const handlePreviewPDF = () => {
    const paper = containerRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md');
    if (!paper) return;

    // Build link tags with absolute hrefs so they load from the blob origin.
    const headTags = Array.from(
      document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'),
    )
      .map((el) => {
        if (el.tagName === 'LINK') {
          return `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`;
        }
        return el.outerHTML;
      })
      .join('\n');

    const html = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8"><title>Proposal Preview</title>',
      headTags,
      '<style>',
      '@media print { @page { margin: 0.5in; } body { background: white !important; } }',
      'body { margin: 0; padding: 24px; background: #f3f4f6; }',
      '</style>',
      '</head><body>',
      paper.outerHTML,
      '</body></html>',
    ].join('');

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      role="dialog"
      aria-modal
      aria-label="Hard Edit Proposal"
    >
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-3 bg-[#1e3a5f] px-5 py-3 text-white">
        <span className="text-sm font-semibold">Hard Edit</span>
        <span className="ml-1 text-xs text-white/50">
          Click any text to edit directly. Changes here do not affect the template.
        </span>
        <div className="flex-1" />
        {!ready && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
            <FileText className="h-3.5 w-3.5 animate-pulse" />
            Loading…
          </span>
        )}
        <button
          onClick={handlePreviewPDF}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <FileText className="h-3.5 w-3.5" />
          Preview PDF
        </button>
        <button
          onClick={onClose}
          aria-label="Close hard edit"
          className="ml-1 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Proposal preview — rendered visibly so images + fonts load, then made editable */}
      <div ref={containerRef} className="flex flex-1 min-h-0">
        <LetterPreview
          result={result}
          error={null}
          selectedPresetId={null}
          onSelectBlock={() => {}}
          brandFonts={brandFonts}
          pageLogos={pageLogos}
        />
      </div>
    </div>
  );
}

