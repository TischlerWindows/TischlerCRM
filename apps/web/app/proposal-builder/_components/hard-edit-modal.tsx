'use client';

import { useEffect, useRef, useState } from 'react';
import { X, FileText, Loader2 } from 'lucide-react';
import type { ProposalAssemblyResult } from '@crm/proposal-assembly';
import type { PageLogoRule } from '@crm/types';
import { apiClient } from '@/lib/api-client';
import { LetterPreview, type BrandFontMap } from './letter-preview';

interface Props {
  result: ProposalAssemblyResult;
  brandFonts: BrandFontMap;
  pageLogos: PageLogoRule[];
  templateId: string;
  summaryId: string;
  onClose: () => void;
}

export function HardEditModal({ result, brandFonts, pageLogos, templateId, summaryId, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  // Server-side PDF render — identical to the proposal builder's Preview PDF.
  // window.open() must be called synchronously before any await so popup
  // blockers treat it as a direct user-gesture response.
  const handlePreviewPDF = async () => {
    setPreviewError(null);
    const previewWindow = window.open('', '_blank');
    setIsPreviewing(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/proposal-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ templateId, summaryId }),
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
        const link = document.createElement('a');
        link.href = url;
        link.download = 'proposal.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      previewWindow?.close();
      setPreviewError(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setIsPreviewing(false);
    }
  };

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
        {(!ready || isPreviewing) && (
          <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {isPreviewing ? 'Generating…' : 'Loading…'}
          </span>
        )}
        {previewError && (
          <span className="text-xs text-red-300">{previewError}</span>
        )}
        <button
          onClick={handlePreviewPDF}
          disabled={!ready || isPreviewing}
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

