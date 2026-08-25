/**
 * Open the dedicated react-pdf proposal preview in a new tab.
 * react-pdf's annotation layer sets target="_blank" on all external links
 * so clicking them never navigates the preview tab away.
 */
export function showPdfInPopup(templateId: string, summaryId: string): void {
  const url = `/proposal-preview?templateId=${encodeURIComponent(templateId)}&summaryId=${encodeURIComponent(summaryId)}`;
  window.open(url, '_blank');
}
