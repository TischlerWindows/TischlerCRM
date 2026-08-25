'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

// react-pdf/pdfjs-dist touch browser-only APIs (DOMMatrix, canvas, Worker) —
// must never be rendered/evaluated during SSR or the Next.js build.
const ProposalPdfViewer = dynamic(() => import('./pdf-viewer-client'), { ssr: false });

export default function ProposalPreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center bg-gray-500 text-sm text-white">
          Loading preview…
        </div>
      }
    >
      <ProposalPdfViewer />
    </Suspense>
  );
}
