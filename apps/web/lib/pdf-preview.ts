/**
 * Render a PDF blob URL inside an iframe in an already-opened popup window,
 * instead of navigating the popup directly to the PDF (`location.href = url`).
 *
 * Browsers' built-in PDF viewers treat a top-level PDF document differently
 * from an embedded one: when the PDF IS the top-level document, clicking a
 * link inside it navigates that same tab away from the PDF. When the PDF is
 * embedded in an iframe, the same click opens in a new tab instead. This
 * keeps the preview tab open when a user clicks a link inside the PDF (e.g.
 * the Dade County impact-products sheet's FL#/drawing links).
 */
export function showPdfInPopup(previewWindow: Window, blobUrl: string): void {
  const doc = previewWindow.document;
  doc.title = 'Proposal Preview';
  doc.documentElement.style.height = '100%';
  doc.body.style.margin = '0';
  doc.body.style.height = '100%';
  const iframe = doc.createElement('iframe');
  iframe.src = blobUrl;
  iframe.style.position = 'fixed';
  iframe.style.inset = '0';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  doc.body.appendChild(iframe);
}
