/**
 * Opens a client-generated PDF Blob in a browser tab via the server's
 * one-time /pdf-echo handoff instead of a blob: URL. Browsers' built-in PDF
 * viewers don't reliably use a blob: URL's title/filename for the tab title
 * or "Save as" suggestion — they show the blob's raw id — but they DO
 * respect a real HTTP response's Content-Disposition filename.
 *
 * Falls back to a direct blob: URL if the upload fails, so a temporary API
 * hiccup doesn't block the user from seeing the PDF at all (just with the
 * old naming quirk).
 */
import { apiClient } from './api-client';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function openPdfPreview(
  previewWindow: Window | null,
  blob: Blob,
  filename: string,
): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const token = apiClient.getToken();
    const dataBase64 = await blobToBase64(blob);
    const response = await fetch(`${apiBase}/pdf-echo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ filename, dataBase64 }),
    });
    if (!response.ok) throw new Error('Failed to prepare PDF preview');
    const { id } = await response.json();
    const url = `${apiBase}/pdf-echo/${id}`;
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = url;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    }
  } catch {
    const url = URL.createObjectURL(blob);
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = url;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
