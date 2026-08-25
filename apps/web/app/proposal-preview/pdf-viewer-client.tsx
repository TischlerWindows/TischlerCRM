'use client';

import { useState, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

// Must be set in the same file that renders react-pdf components.
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ProposalPdfViewerClient() {
  const params = useSearchParams();
  const templateId = params.get('templateId');
  const summaryId = params.get('summaryId');

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch once on first render if params are present
  const [fetched, setFetched] = useState(false);
  if (!fetched && templateId && summaryId && !loading && !pdfBytes && !error) {
    setFetched(true);
    setLoading(true);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const token = apiClient.getToken();
    fetch(`${apiBase}/proposal-pdf/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ templateId, summaryId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const detail = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(detail.error || `Failed to render PDF (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((buf) => {
        setPdfBytes(new Uint8Array(buf));
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
        setLoading(false);
      });
  }

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  }, []);

  if (!templateId || !summaryId) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-800 text-white text-sm">
        Missing templateId or summaryId query parameters.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-700">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-800 p-8">
        <div className="max-w-md rounded-lg border border-red-400 bg-red-50 p-6 text-sm text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-semibold mb-1">Failed to render proposal</div>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-gray-700">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-600 bg-gray-800 px-4 py-2 text-white text-sm">
        <span className="opacity-70">Proposal Preview</span>
        {numPages > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              disabled={pageNumber <= 1}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
              disabled={pageNumber >= numPages}
              className="rounded p-1 hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* PDF canvas — externalLinkTarget="_blank" forces all annotation links to new tabs */}
      <div className="flex-1 overflow-auto flex justify-center py-6">
        {pdfBytes && (
          <Document
            file={pdfBytes}
            onLoadSuccess={onLoadSuccess}
            externalLinkTarget="_blank"
            loading={
              <div className="flex items-center gap-2 text-white">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Rendering pages…</span>
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              width={Math.min(window?.innerWidth ? window.innerWidth - 48 : 816, 816)}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        )}
      </div>
    </div>
  );
}
