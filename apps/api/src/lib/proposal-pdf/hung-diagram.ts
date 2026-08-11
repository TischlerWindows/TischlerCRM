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

  const row = rows[0]!;
  const diagramBuffer = existsSync(TEMPLATE_PATH)
    ? await buildFromTemplate(row)
    : await buildFallback(row);

  const merged  = await PDFDocument.create();
  const mainDoc = await PDFDocument.load(mainBuffer);
  const mainPgs = await merged.copyPages(mainDoc, mainDoc.getPageIndices());
  for (const p of mainPgs) merged.addPage(p);

  const diagDoc = await PDFDocument.load(diagramBuffer);
  const diagPgs = await merged.copyPages(diagDoc, diagDoc.getPageIndices());
  for (const p of diagPgs) merged.addPage(p);

  return Buffer.from(await merged.save());
}

async function buildFromTemplate(row: HungDiagramRow): Promise<Buffer> {
  const templateDoc = await PDFDocument.load(readFileSync(TEMPLATE_PATH));
  const page        = templateDoc.getPage(0);
  const font        = await templateDoc.embedFont(StandardFonts.Helvetica);
  const sz          = 10;
  const black       = rgb(0, 0, 0);

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

  return Buffer.from(await templateDoc.save());
}

// Programmatic fallback used when hung-window.pdf has not yet been committed.
async function buildFallback(row: HungDiagramRow): Promise<Buffer> {
  const doc  = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const black = rgb(0, 0, 0);
  const red   = rgb(0.85, 0.16, 0.11);

  // Window geometry (pdf-lib: y=0 bottom, y increases upward)
  const WX = 185, WY = 215, WW = 235, WH = 360;
  const midY  = WY + WH / 2;
  const sillY = WY - 14;

  // Outer frame
  page.drawRectangle({ x: WX, y: WY, width: WW, height: WH, borderColor: black, borderWidth: 3.5 });
  // Inner frame
  page.drawRectangle({ x: WX + 7, y: WY + 7, width: WW - 14, height: WH - 14, borderColor: black, borderWidth: 1.5 });
  // Mid rail
  page.drawLine({ start: { x: WX, y: midY }, end: { x: WX + WW, y: midY }, color: black, thickness: 3.5 });
  // Top sash glass
  const sg = 16;
  page.drawRectangle({ x: WX + sg, y: midY + 3, width: WW - sg * 2, height: WH / 2 - sg - 3, borderColor: black, borderWidth: 1 });
  // Bottom sash glass
  page.drawRectangle({ x: WX + sg, y: WY + sg, width: WW - sg * 2, height: WH / 2 - sg - 3, borderColor: black, borderWidth: 1 });
  // Sill
  page.drawRectangle({ x: WX - 10, y: sillY, width: WW + 20, height: 14, borderColor: black, borderWidth: 2 });

  // Down arrow (top sash)
  const ax = WX + WW / 2;
  const topArrowTip = midY - 14;
  const topArrowBase = topArrowTip - 16;
  page.drawLine({ start: { x: ax, y: WY + WH - 20 }, end: { x: ax, y: topArrowTip + 16 }, color: red, thickness: 5 });
  page.drawLine({ start: { x: ax - 11, y: topArrowBase + 16 }, end: { x: ax, y: topArrowBase }, color: red, thickness: 5 });
  page.drawLine({ start: { x: ax + 11, y: topArrowBase + 16 }, end: { x: ax, y: topArrowBase }, color: red, thickness: 5 });

  // Up arrow (bottom sash)
  const botArrowTip = midY + 14;
  const botArrowBase = botArrowTip + 16;
  page.drawLine({ start: { x: ax, y: WY + 20 }, end: { x: ax, y: botArrowTip - 16 }, color: red, thickness: 5 });
  page.drawLine({ start: { x: ax - 11, y: botArrowBase - 16 }, end: { x: ax, y: botArrowBase }, color: red, thickness: 5 });
  page.drawLine({ start: { x: ax + 11, y: botArrowBase - 16 }, end: { x: ax, y: botArrowBase }, color: red, thickness: 5 });

  // Width dimension line
  const DOT_R = 3.5;
  const wDimY = sillY - 18;
  page.drawLine({ start: { x: WX, y: wDimY }, end: { x: WX + WW, y: wDimY }, color: black, thickness: 1 });
  page.drawCircle({ x: WX, y: wDimY, size: DOT_R, color: black });
  page.drawCircle({ x: WX + WW, y: wDimY, size: DOT_R, color: black });

  const sz = 9;
  const wLine1 = row.widthFtIn;
  const wLine2 = `[${row.widthMM} mm]`;
  page.drawText(wLine1, { x: WX + WW / 2 - font.widthOfTextAtSize(wLine1, sz) / 2, y: wDimY - 14, size: sz, font, color: black });
  page.drawText(wLine2, { x: WX + WW / 2 - font.widthOfTextAtSize(wLine2, sz) / 2, y: wDimY - 26, size: sz, font, color: black });

  // Height dimension line
  const hDimX = WX + WW + 28;
  page.drawLine({ start: { x: hDimX, y: WY }, end: { x: hDimX, y: WY + WH }, color: black, thickness: 1 });
  page.drawCircle({ x: hDimX, y: WY, size: DOT_R, color: black });
  page.drawCircle({ x: hDimX, y: WY + WH, size: DOT_R, color: black });

  const hLine1 = row.heightFtIn;
  const hLine2 = `[${row.heightMM} mm]`;
  const hMid = WY + WH / 2;
  page.drawText(hLine1, {
    x: hDimX + 6,
    y: hMid - font.widthOfTextAtSize(hLine1, sz) / 2,
    size: sz, font, color: black, rotate: degrees(90),
  });
  page.drawText(hLine2, {
    x: hDimX + 18,
    y: hMid - font.widthOfTextAtSize(hLine2, sz) / 2,
    size: sz, font, color: black, rotate: degrees(90),
  });

  return Buffer.from(await doc.save());
}
