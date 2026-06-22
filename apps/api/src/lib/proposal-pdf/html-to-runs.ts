/**
 * Convert Tiptap-style HTML into a structured list of paragraph/list blocks
 * with styled text runs. The output is consumed by the PDFKit renderer to
 * emit `doc.text({ continued: true })` calls with the right `.font()` switches.
 *
 * Tiptap's StarterKit emits a constrained tag set: `<p>`, `<strong>`, `<em>`,
 * `<ul><li>`, `<ol><li>`, `<br>`. Anything else falls back to plain text.
 *
 * Backwards-compatible with legacy plain-text bodies: anything that doesn't
 * start with `<` is wrapped in a single `<p>` before parsing.
 */

import { parse, type HTMLElement, type Node, NodeType } from 'node-html-parser';

export interface StyledRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  /** Font size override in points. Undefined = use block default. */
  fontSize?: number;
}

export type Block =
  | { kind: 'paragraph'; runs: StyledRun[]; align?: 'left' | 'center' | 'right' }
  | { kind: 'bullet'; runs: StyledRun[] }
  | { kind: 'number'; index: number; runs: StyledRun[] };

export function htmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const wrapped = html.trim().startsWith('<') ? html : `<p>${escapeHtml(html)}</p>`;
  const root = parse(wrapped);
  const blocks: Block[] = [];

  for (const node of root.childNodes) {
    if (node.nodeType !== NodeType.ELEMENT_NODE) {
      // Stray top-level text: treat as a paragraph.
      const text = node.text?.trim();
      if (text) blocks.push({ kind: 'paragraph', runs: [{ text, bold: false, italic: false }] });
      continue;
    }
    const el = node as HTMLElement;
    pushBlocks(el, blocks);
  }

  return blocks;
}

function pushBlocks(el: HTMLElement, out: Block[]): void {
  const tag = el.tagName?.toUpperCase();
  if (tag === 'P') {
    const runs = collectRuns(el);
    // Parse text-align from TipTap's inline style (e.g. text-align: right)
    const style = el.getAttribute('style') ?? '';
    const alignMatch = /text-align:\s*(left|center|right)/i.exec(style);
    const align = alignMatch ? (alignMatch[1].toLowerCase() as 'left' | 'center' | 'right') : undefined;

    // Split on \n runs produced by <br> tags. PDFKit's doc.text('\n', {continued:true})
    // is unreliable — it can silently drop the line advance. Splitting at <br>
    // positions creates separate paragraph blocks, each rendered with their own
    // doc.text({continued:false}) call, which reliably advances the cursor.
    const segments: StyledRun[][] = [[]];
    for (const run of runs) {
      if (run.text === '\n') {
        segments.push([]);
      } else {
        segments[segments.length - 1].push(run);
      }
    }

    for (const seg of segments) {
      if (seg.length === 0 || seg.every((r) => !r.text.trim())) {
        out.push({ kind: 'paragraph', runs: [{ text: '', bold: false, italic: false }], align });
      } else {
        out.push({ kind: 'paragraph', runs: seg, align });
      }
    }
    return;
  }
  if (tag === 'UL') {
    for (const li of el.querySelectorAll('li')) {
      out.push({ kind: 'bullet', runs: collectRuns(li) });
    }
    return;
  }
  if (tag === 'OL') {
    const items = el.querySelectorAll('li');
    items.forEach((li, idx) => {
      out.push({ kind: 'number', index: idx + 1, runs: collectRuns(li) });
    });
    return;
  }
  // Unknown top-level tag — flatten its text as a paragraph.
  const runs = collectRuns(el);
  if (runs.length > 0) out.push({ kind: 'paragraph', runs });
}

function collectRuns(
  el: HTMLElement,
  ctx: { bold: boolean; italic: boolean; underline?: boolean; fontSize?: number } = { bold: false, italic: false },
): StyledRun[] {
  const runs: StyledRun[] = [];

  for (const child of el.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const raw = decodeEntities(child.text);
      // PDFKit's word-layout collapses runs of ASCII spaces into a single
      // word gap. Preserve intentional multi-space runs by replacing every
      // second space in a sequence with a non-breaking space (\u00A0),
      // which PDFKit renders at full glyph width.
      const text = raw.replace(/ {2,}/g, (m) =>
        m.split('').map((_, i) => (i % 2 === 0 ? ' ' : '\u00A0')).join(''),
      );
      if (text.length > 0) {
        runs.push({ text, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, fontSize: ctx.fontSize });
      }
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;

    const childEl = child as HTMLElement;
    const tag = childEl.tagName?.toUpperCase();

    if (tag === 'BR') {
      runs.push({ text: '\n', bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, fontSize: ctx.fontSize });
      continue;
    }

    const next = { ...ctx };
    if (tag === 'STRONG' || tag === 'B') next.bold = true;
    if (tag === 'EM' || tag === 'I') next.italic = true;
    if (tag === 'U') next.underline = true;
    // Parse font-size from <span style="font-size: Xpt"> (TipTap TextStyle output)
    if (tag === 'SPAN') {
      const style = childEl.getAttribute('style') ?? '';
      const match = /font-size:\s*([\d.]+)pt/i.exec(style);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed) && parsed > 0) next.fontSize = parsed;
      }
    }
    runs.push(...collectRuns(childEl, next));
  }

  return runs;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function decodeEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Non-breaking spaces from TipTap: preserve as \u00A0 so PDFKit renders
    // them at full glyph width rather than collapsing them.
    .replace(/&nbsp;/g, '\u00A0');
}

// Used by callers that just need the plain text (e.g. for header lines).
export function plainTextFromBlocks(blocks: Block[]): string {
  return blocks
    .map((b) => b.runs.map((r) => r.text).join(''))
    .filter((t) => t.length > 0)
    .join('\n');
}

// Re-export the types from `node-html-parser` consumers can use without
// reaching in directly.
export { Node as HtmlNode };
