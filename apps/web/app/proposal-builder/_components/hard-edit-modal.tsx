'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText } from 'lucide-react';
import type { ProposalAssemblyResult } from '@crm/proposal-assembly';
import type { PageLogoRule } from '@crm/types';
import { apiClient } from '@/lib/api-client';
import { LetterPreview, type BrandFontMap } from './letter-preview';

interface Props {
  result: ProposalAssemblyResult;
  brandFonts: BrandFontMap;
  pageLogos: PageLogoRule[];
  templateId: string | null;
  summaryId: string;
  onClose: () => void;
}

export function HardEditModal({ result, brandFonts, pageLogos, templateId, summaryId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const [capturedHtml, setCapturedHtml] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (generating) return;
    if (!templateId || !summaryId) {
      setError('Missing template or summary — reopen the preview and try again.');
      return;
    }

    // Collect edited block bodies, keyed by ordered-block index. These match
    // the data-hard-edit-body attributes stamped by SafeRichHtml in the
    // preview, and line up 1:1 with result.orderedBlocks on the server.
    const bodyOverrides: Record<string, string> = {};
    editRef.current
      ?.querySelectorAll<HTMLElement>('[data-hard-edit-body]')
      .forEach((el) => {
        const key = el.getAttribute('data-hard-edit-body');
        if (key) bodyOverrides[key] = el.innerHTML;
      });

    // Open the tab synchronously inside the click handler so popup blockers
    // don't kill it after the await (matches the proposal builder behaviour).
    const previewWindow = window.open('', '_blank');
    setGenerating(true);
    setError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/proposal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ templateId, summaryId, bodyOverrides }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(detail.error || `Failed to render PDF (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else {
        // Popup blocker killed the synchronous open — fall back to a download.
        const link = document.createElement('a');
        link.href = url;
        link.download = 'proposal.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      previewWindow?.close();
      setError(err instanceof Error ? err.message : 'Failed to generate proposal PDF');
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
        {error && (
          <span role="alert" className="text-xs text-red-300">{error}</span>
        )}
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
