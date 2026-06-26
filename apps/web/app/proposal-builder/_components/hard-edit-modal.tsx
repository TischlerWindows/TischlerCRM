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
  const editRef = useRef<HTMLDivElement>(null);
  const [capturedHtml, setCapturedHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const capture = () => {
      const paper = containerRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md');
      if (!paper || cancelled) return;

      const imgs = Array.from(paper.querySelectorAll<HTMLImageElement>('img'));

      // Wait for every image to finish loading (or fail) before capturing so
      // that the logo is fully loaded rather than hidden by the onError handler.
      Promise.all(
        imgs.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) { resolve(); return; }
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            }),
        ),
      ).then(() => {
        if (cancelled) return;
        const p = containerRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md');
        if (!p) return;
        // Clear any display:none that onError handlers may have applied.
        p.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
          img.style.display = '';
        });
        setCapturedHtml(p.outerHTML);
        setReady(true);
      });
    };

    // Short initial delay so React finishes the first paint before we start
    // watching image load events.
    const timer = setTimeout(capture, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Populate editRef exactly once — bypasses React reconciler so edits stick.
  useEffect(() => {
    if (capturedHtml && editRef.current) {
      editRef.current.innerHTML = capturedHtml;

      // Ensure no img is left hidden and force a fresh src load so images
      // that previously failed (e.g. auth errors) are retried.
      editRef.current.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        img.style.display = '';
        const src = img.getAttribute('src') ?? '';
        if (src) { img.setAttribute('src', ''); img.setAttribute('src', src); }
      });

      const paper = editRef.current.querySelector<HTMLElement>('.bg-white.shadow-md');
      if (paper) {
        paper.contentEditable = 'true';
        paper.style.outline = 'none';
        paper.querySelectorAll<HTMLElement>('[class*="cursor-pointer"]').forEach((el) => {
          el.style.cursor = 'text';
          el.style.pointerEvents = 'none';
          el.querySelectorAll<HTMLElement>('p, span, strong, em, li, div:not([class*="cursor-pointer"])')
            .forEach((leaf) => { leaf.style.pointerEvents = 'auto'; });
        });
      }
    }
  }, [capturedHtml]);

  const handlePreviewPDF = () => {
    const paper = editRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md') ?? editRef.current;
    if (!paper) return;
    const headTags = Array.from(
      document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'),
    ).map((el) => {
      if (el.tagName === 'LINK') return `<link rel="stylesheet" href="${(el as HTMLLinkElement).href}">`;
      return el.outerHTML;
    }).join('\n');
    const html = [
      '<!DOCTYPE html><html><head>',
      '<meta charset="utf-8"><title>Proposal Preview</title>',
      headTags,
      '<style>@media print { @page { margin: 0.5in; } body { background: white !important; } } body { margin: 0; padding: 24px; background: #f3f4f6; }</style>',
      '</head><body>',
      paper.outerHTML,
      '</body></html>',
    ].join('');
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal aria-label="Hard Edit Proposal">
      <div className="flex shrink-0 items-center gap-3 bg-[#1e3a5f] px-5 py-3 text-white">
        <span className="text-sm font-semibold">Hard Edit</span>
        <span className="ml-1 text-xs text-white/50">Click any text to edit directly. Changes here do not affect the template.</span>
        <div className="flex-1" />
        {!ready && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
            <FileText className="h-3.5 w-3.5 animate-pulse" />
            Loading...
          </span>
        )}
        <button onClick={handlePreviewPDF} disabled={!ready} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40">
          <FileText className="h-3.5 w-3.5" />
          Preview PDF
        </button>
        <button onClick={onClose} aria-label="Close hard edit" className="ml-1 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={containerRef} className="flex flex-1 min-h-0" style={capturedHtml !== null ? { display: 'none' } : undefined}>
        <LetterPreview result={result} error={null} selectedPresetId={null} onSelectBlock={() => {}} brandFonts={brandFonts} pageLogos={pageLogos} />
      </div>
      {capturedHtml !== null && (
        <div ref={editRef} className="flex-1 overflow-y-auto bg-gray-100" />
      )}
    </div>
  );
}
