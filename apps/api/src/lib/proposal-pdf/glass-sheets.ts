/**
 * Appends Tischler Glass Type data-sheet PDFs to the end of a proposal PDF.
 *
 * PDFs must be placed in ./glass-types/ as `type-{num}.pdf`:
 *   type-1.pdf, type-2.pdf, type-2.1.pdf, type-28.pdf …
 *
 * Missing files are silently skipped so the proposal still renders without
 * every sheet present.
 */

import { PDFDocument } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// In dev (tsx), import.meta.url resolves to this source file → glass-types/ lives next to it.
// In prod (esbuild bundle dist/server.js), import.meta.url resolves to dist/ → glass-types/ is
// copied there by the build script.
const SHEETS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'glass-types');

/** Extract the canonical numeric key from any glass type string. */
function glassTypeKey(raw: string): string | null {
  const stripped = (raw || '').replace(/^#/, '').trim();
  const m = stripped.match(/^(\d+(?:\.\d+)?)/);
  return m?.[1] ?? null;
}

/**
 * Collect unique glass-type numeric keys from a summary object.
 * Covers primary glass type, additional glass types, and hung type.
 */
export function collectGlassTypeKeys(summary: Record<string, unknown>): string[] {
  const candidates: string[] = [];

  const main = (summary.glassTypeCustom as string) || (summary.glassType as string) || '';
  if (main) candidates.push(main);

  if (Array.isArray(summary.additionalGlassTypes)) {
    for (const t of summary.additionalGlassTypes as string[]) {
      if (t) candidates.push(t);
    }
  }

  const hung = (summary.hungTypeCustom as string) || (summary.hungType as string) || '';
  if (hung && hung !== 'Custom Option') candidates.push(hung);

  const seen = new Set<string>();
  const keys: string[] = [];
  for (const c of candidates) {
    const k = glassTypeKey(c);
    if (k && !seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return keys;
}

/**
 * Merge the main proposal buffer with the relevant glass type data sheets.
 * Returns the original buffer unchanged if no sheets are found.
 */
export async function appendGlassSheets(mainBuffer: Buffer, keys: string[]): Promise<Buffer> {
  const sheetPaths = keys
    .map((k) => ({ key: k, path: join(SHEETS_DIR, `type-${k}.pdf`) }))
    .filter(({ path }) => existsSync(path));

  if (sheetPaths.length === 0) return mainBuffer;

  const merged = await PDFDocument.create();

  const mainDoc = await PDFDocument.load(mainBuffer);
  const mainIndices = mainDoc.getPageIndices();
  const mainPages = await merged.copyPages(mainDoc, mainIndices);
  for (const page of mainPages) merged.addPage(page);

  for (const { path } of sheetPaths) {
    try {
      const sheetBytes = readFileSync(path);
      const sheetDoc = await PDFDocument.load(sheetBytes);
      const sheetPages = await merged.copyPages(sheetDoc, sheetDoc.getPageIndices());
      for (const page of sheetPages) merged.addPage(page);
    } catch {
      // skip unreadable sheets rather than failing the whole render
    }
  }

  return Buffer.from(await merged.save());
}
