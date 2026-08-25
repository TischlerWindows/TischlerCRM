/**
 * Open the proposal PDF preview in a dedicated /proposal-preview tab that
 * uses react-pdf with externalLinkTarget="_blank", ensuring all annotation
 * links (e.g. the Dade County impact-products sheet) open in a new tab
 * instead of replacing the preview tab.
 */
export function showPdfInPopup(templateId: string, summaryId: string): void {
  const url = `/proposal-preview?templateId=${encodeURIComponent(templateId)}&summaryId=${encodeURIComponent(summaryId)}`;
  window.open(url, '_blank');
}
