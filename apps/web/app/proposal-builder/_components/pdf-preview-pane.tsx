'use client';

import { AlertCircle, FileText, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  blobUrl: string | null;
  isRendering: boolean;
  error: string | null;
  /** Last successful render time (ms epoch) — used to show "rendered Xs ago". */
  lastRenderedAt: number | null;
  onRefresh: () => void;
  hasTemplate: boolean;
  hasSummary: boolean;
}

export function PdfPreviewPane({
  blobUrl,
  isRendering,
  error,
  lastRenderedAt,
  onRefresh,
  hasTemplate,
  hasSummary,
}: Props) {
  if (!hasTemplate || !hasSummary) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-100">
        <div className="text-center max-w-md">
          <FileText className="mx-auto mb-2 h-6 w-6 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">
            Pick a template and a summary
          </p>
          <p className="mt-1 text-xs text-gray-500">
            The PDF will render here once both are selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col bg-gray-100">
      {/* Status strip — mirrors the LintPanel positioning above the preview */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-1.5 text-[11px]">
        <span className="text-gray-500">
          {isRendering ? (
            <span className="inline-flex items-center gap-1.5 text-gray-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              Rendering…
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1.5 text-red-700">
              <AlertCircle className="h-3 w-3" />
              Render failed
            </span>
          ) : lastRenderedAt ? (
            <span>Rendered just now</span>
          ) : (
            <span>True PDF preview</span>
          )}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRendering}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${isRendering ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        {error ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <div className="font-semibold">Couldn&rsquo;t render the PDF</div>
                  <div className="mt-1 text-xs text-red-600">{error}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                className="mt-3 inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </div>
          </div>
        ) : blobUrl ? (
          <iframe
            title="Proposal PDF preview"
            src={blobUrl}
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Rendering first preview…
          </div>
        )}

        {/* Soft overlay during refresh so the iframe isn't blank */}
        {isRendering && blobUrl && (
          <div className="pointer-events-none absolute inset-0 flex items-start justify-end p-3">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm backdrop-blur">
              <Loader2 className="h-3 w-3 animate-spin" />
              Updating…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
