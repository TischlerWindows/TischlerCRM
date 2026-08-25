/**
 * Open the proposal PDF blob URL in a new tab.
 * The PDF is set to open links in new windows at the file level via /NewWindow
 * true on each URI action, so this can be the top-level document.
 */
export function showPdfInPopup(previewWindow: Window, blobUrl: string): void {
  previewWindow.location.href = blobUrl;
}
