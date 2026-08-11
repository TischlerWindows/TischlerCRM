/**
 * Appends the hung-window template PDF with dimension labels overlaid.
 *
 * Drop the original PDF at:  apps/api/src/lib/proposal-pdf/hung-window.pdf
 * The build script copies it to:  dist/hung-window.pdf
 *
 * If the file is absent the call is a no-op so the proposal still renders.
 */

import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEMPLATE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'hung-window.pdf');

export interface HungDiagramRow {
  widthFtIn: string;
  widthMM: string;
  heightFtIn: string;
  heightMM: string;
}

// ── Approximate label positions in the template PDF (letter, 612 × 792 pt) ──
// Width dim-line centre x ≈ 335, dots at y ≈ 96.
// Height dim-line at x ≈ 516, midpoint y ≈ 370.
const WIDTH_CENTER_X = 335;
const WIDTH_LABEL_Y  = 78;   // below width dimension dots
const HEIGHT_DIM_X   = 528;  // just right of height dimension line
const HEIGHT_MID_Y   = 370;  // vertical midpoint of height dim line

export async function appendHungDiagram(
  mainBuffer: Buffer,
  rows: HungDiagramRow[],
): Promise<Buffer> {
  if (rows.length === 0) return mainBuffer;
  if (!existsSync(TEMPLATE_PATH)) return mainBuffer;

  const row = rows[0]!;

  const templateBytes = readFileSync(TEMPLATE_PATH);
  const templateDoc   = await PDFDocument.load(templateBytes);
  const page          = templateDoc.getPage(0);
  const font          = await templateDoc.embedFont(StandardFonts.Helvetica);
  const sz            = 10;
  const black         = rgb(0, 0, 0);

  // Width label (horizontal, centred below the dimension line)
  const wLine1 = row.widthFtIn;
  const wLine2 = `[${row.widthMM} mm]`;
  page.drawText(wLine1, {
    x: WIDTH_CENTER_X - font.widthOfTextAtSize(wLine1, sz) / 2,
    y: WIDTH_LABEL_Y + 13,
    size: sz, font, color: black,
  });
  page.drawText(wLine2, {
    x: WIDTH_CENTER_X - font.widthOfTextAtSize(wLine2, sz) / 2,
    y: WIDTH_LABEL_Y,
    size: sz, font, color: black,
  });

  // Height label (rotated 90° CCW so text reads bottom-to-top)
  const hLine1 = row.heightFtIn;
  const hLine2 = `[${row.heightMM} mm]`;
  page.drawText(hLine1, {
    x: HEIGHT_DIM_X,
    y: HEIGHT_MID_Y - font.widthOfTextAtSize(hLine1, sz) / 2,
    size: sz, font, color: black,
    rotate: degrees(90),
  });
  page.drawText(hLine2, {
    x: HEIGHT_DIM_X + 13,
    y: HEIGHT_MID_Y - font.widthOfTextAtSize(hLine2, sz) / 2,
    size: sz, font, color: black,
    rotate: degrees(90),
  });

  const annotatedBuffer = Buffer.from(await templateDoc.save());

  // Merge annotated diagram page onto the end of the main proposal
  const merged   = await PDFDocument.create();
  const mainDoc  = await PDFDocument.load(mainBuffer);
  const mainPgs  = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
  for (const p of mainPgs) merged.addPage(p);

  const diagDoc  = await PDFDocument.load(annotatedBuffer);
  const diagPgs  = await merged.copyPages(diagDoc, diagDoc.getPageIndices());
  for (const p of diagPgs) merged.addPage(p);

  return Buffer.from(await merged.save());
}
