'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
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
  const hiddenRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // After the hidden LetterPreview renders, copy its paper div innerHTML into
  // the contentEditable area. This gives exact visual fidelity — same Tailwind
  // classes, same inline styles, same brand fonts.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hiddenRef.current || !editRef.current) return;
      // The paper container is the white shadow div inside LetterPreview.
      const paper = hiddenRef.current.querySelector<HTMLElement>('.bg-white.shadow-md');
      if (paper) {
        editRef.current.innerHTML = paper.innerHTML;
      }
      setReady(true);
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePrint = () => {
    const content = editRef.current?.innerHTML ?? '';
    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) return;

    // Copy every stylesheet and <style> tag from the current document so that
    // all Tailwind classes and brand @font-face rules render identically.
    const headTags = Array.from(
      document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'),
    )
      .map((el) => el.outerHTML)
      .join('\n');

    win.document.write(
      `<!DOCTYPE html><html><head>` +
      `<meta charset="utf-8"><title>Proposal</title>` +
      headTags +
      `<style>` +
      // Hide browser chrome artifacts in print
      `@media print { @page { margin: 0.5in; } body { background: white !important; } }` +
      // Remove the scrollable-area padding we'd normally add
      `body { margin: 0; padding: 0; background: #f3f4f6; }` +
      `</style>` +
      `</head><body>` +
      // Replicate the paper container from LetterPreview exactly
      `<div class="mx-auto my-6 bg-white shadow-md border border-gray-200" ` +
      `style="width:min(816px,100%);padding:64px 76px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1e1e1e">` +
      content +
      `</div>` +
      `</body></html>`,
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/60"
      role="dialog"
      aria-modal
      aria-label="Hard Edit Proposal"
    >
      {/* Off-screen LetterPreview — rendered for DOM copying only */}
      <div
        ref={hiddenRef}
        aria-hidden
        style={{ position: 'fixed', left: '-99999px', top: 0, width: 816, pointerEvents: 'none' }}
      >
        <LetterPreview
          result={result}
          error={null}
          selectedPresetId={null}
          onSelectBlock={() => {}}
          brandFonts={brandFonts}
          pageLogos={pageLogos}
        />
      </div>

      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 bg-[#1e3a5f] px-5 py-3 text-white">
        <span className="text-sm font-semibold">Hard Edit</span>
        <span className="ml-1 text-xs text-white/50">
          Click any text to edit directly. Changes here do not affect the template.
        </span>
        <div className="flex-1" />
        <button
          onClick={handlePrint}
          disabled={!ready}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40"
        >
          <Printer className="h-3.5 w-3.5" />
          Print / Save as PDF
        </button>
        <button
          onClick={onClose}
          aria-label="Close hard edit"
          className="ml-1 rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Editable document */}
      <div className="flex-1 overflow-y-auto bg-gray-100 px-4 py-6">
        {!ready && (
          <div className="flex h-32 items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading proposal…
          </div>
        )}
        <div
          className="mx-auto border border-gray-200 bg-white shadow-md"
          style={{ width: 'min(816px, 100%)', minHeight: '1024px', padding: '64px 76px', display: ready ? undefined : 'none' }}
        >
          <div
            ref={editRef}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            className="min-h-full outline-none"
            style={{ fontSize: '10pt', lineHeight: '1.5', color: '#1e1e1e' }}
          />
        </div>
      </div>
    </div>
  );
}


