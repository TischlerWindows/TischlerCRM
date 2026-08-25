/**
 * Appends the Tischler Impact Resistant Products sheet to the end of a
 * proposal PDF for Dade County jobs (jobType containing "Dade").
 *
 * Drop the source PDF at: ./dade-county-impact-products.pdf
 * The build script copies it to: dist/dade-county-impact-products.pdf
 *
 * pdf-lib's copyPages preserves the page's Link annotations (and their URI
 * actions) as-is, so the sheet's clickable FL#/drawing-number links keep
 * working after the merge. Missing file is a silent no-op so the proposal
 * still renders without the sheet present.
 */

import { PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const SHEET_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dade-county-impact-products.pdf');

/** Light-blue border color (RGB 0-1) applied to each link's hover/click box. */
const LINK_HIGHLIGHT_COLOR = [0.68, 0.85, 0.9];

/** Best-effort: give every Link annotation on a page a light-blue border. */
function highlightLinkAnnotations(page: { node: PDFDict }): void {
  try {
    const annots = page.node.lookup(PDFName.of('Annots'), PDFArray);
    if (!annots) return;
    const context = page.node.context;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookup(i, PDFDict);
      if (annot.lookup(PDFName.of('Subtype'))?.toString() !== '/Link') continue;
      annot.set(PDFName.of('C'), context.obj(LINK_HIGHLIGHT_COLOR));
      annot.set(PDFName.of('BS'), context.obj({ W: PDFNumber.of(1) }));
    }
  } catch {
    // best-effort styling only — never fail the append over this
  }
}

export async function appendDadeImpactSheet(mainBuffer: Buffer, jobType: string | undefined): Promise<Buffer> {
  if (!jobType || !/dade/i.test(jobType)) return mainBuffer;
  if (!existsSync(SHEET_PATH)) return mainBuffer;

  const merged = await PDFDocument.create();

  const mainDoc = await PDFDocument.load(mainBuffer);
  const mainPages = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
  for (const page of mainPages) merged.addPage(page);

  const sheetBytes = readFileSync(SHEET_PATH);
  const sheetDoc = await PDFDocument.load(sheetBytes);
  const sheetPages = await merged.copyPages(sheetDoc, sheetDoc.getPageIndices());
  for (const page of sheetPages) {
    merged.addPage(page);
    highlightLinkAnnotations(page);
  }

  return Buffer.from(await merged.save());
}
