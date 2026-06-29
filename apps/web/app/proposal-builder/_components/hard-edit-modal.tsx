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
  const [generating, setGenerating] = useState(false);

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

  const handlePreviewPDF = async () => {
    const paper = editRef.current?.querySelector<HTMLElement>('.bg-white.shadow-md') ?? editRef.current;
    if (!paper || generating) return;
    setGenerating(true);

    try {
      // Clone so we can strip editing artefacts without mutating the live DOM.
      const clone = paper.cloneNode(true) as HTMLElement;
      clone.removeAttribute('contenteditable');
      clone.style.outline = '';
      clone.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
        el.style.cursor = '';
        el.style.pointerEvents = '';
      });

      // Helper: Blob → base64 data-URL
      const blobToDataUrl = (b: Blob): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(b);
        });

      // 1. Inline every image so the standalone blob page doesn't need
      //    any external requests (images load in the editing context already).
      await Promise.all(
        Array.from(clone.querySelectorAll<HTMLImageElement>('img')).map(async (img) => {
          const src = img.getAttribute('src');
          if (!src || src.startsWith('data:')) return;
          try {
            const resp = await fetch(src, { credentials: 'include' });
            if (resp.ok) img.setAttribute('src', await blobToDataUrl(await resp.blob()));
          } catch { /* leave original src – better than crashing */ }
        }),
      );

      // 2. Collect all stylesheet text.  For <style> tags grab textContent; for
      //    <link rel="stylesheet"> fetch the file so the blob is self-contained.
      const cssChunks: string[] = [];
      await Promise.all(
        Array.from(
          document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
            'link[rel="stylesheet"], style',
          ),
        ).map(async (el) => {
          if (el.tagName === 'STYLE') {
            cssChunks.push((el as HTMLStyleElement).textContent ?? '');
          } else {
            const href = (el as HTMLLinkElement).href;
            if (!href) return;
            try {
              const r = await fetch(href);
              if (r.ok) cssChunks.push(await r.text());
            } catch { /* skip failed sheets */ }
          }
        }),
      );

      // 3. Within the collected CSS, replace font url(...) with data-URLs so
      //    custom brand fonts render correctly in the blob page.
      const rawCss = cssChunks.join('\n');
      const fontUrlRe = /url\(["']?(https?:[^"')]+\.(?:woff2?|ttf|otf|eot)[^"')"]*)["']?\)/g;
      const fontUrls = [...new Set([...rawCss.matchAll(fontUrlRe)].map((m) => m[1]))];
      const fontDataMap = new Map<string, string>();
      await Promise.all(
        fontUrls.map(async (u) => {
          try {
            const r = await fetch(u, { credentials: 'include' });
            if (r.ok) fontDataMap.set(u, await blobToDataUrl(await r.blob()));
          } catch { /* keep URL */ }
        }),
      );
      const inlinedCss = rawCss.replace(fontUrlRe, (match, url) => {
        const d = fontDataMap.get(url);
        return d ? `url("${d}")` : match;
      });

      const html = [
        '<!DOCTYPE html><html><head>',
        '<meta charset="utf-8"><title>Proposal</title>',
        // Single fully-inlined stylesheet — no external requests needed.
        `<style>${inlinedCss}</style>`,
        '<style>',
        'body { margin: 0; padding: 0; background: white; }',
        '@media print { @page { margin: 0.5in; } body { background: white !important; } }',
        '</style>',
        '</head><body>',
        clone.outerHTML,
        // Auto-trigger print dialog so the experience mirrors the proposal
        // builder's Preview PDF button.
        '<script>window.addEventListener("load", function() { setTimeout(function() { window.print(); }, 1200); });<\/script>',
        '</body></html>',
      ].join('');

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 300_000);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal aria-label="Hard Edit Proposal">
      <div className="flex shrink-0 items-center gap-3 bg-[#1e3a5f] px-5 py-3 text-white">
        <span className="text-sm font-semibold">Hard Edit</span>
        <span className="ml-1 text-xs text-white/50">Click any text to edit directly. Changes here do not affect the template.</span>
        <div className="flex-1" />
        {(!ready || generating) && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
            <FileText className="h-3.5 w-3.5 animate-pulse" />
            {generating ? 'Preparing…' : 'Loading...'}
          </span>
        )}
        <button onClick={handlePreviewPDF} disabled={!ready || generating} className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-40">
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
