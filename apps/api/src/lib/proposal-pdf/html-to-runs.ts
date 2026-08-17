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
  /**
   * Render with a monospace font (PDFKit's built-in Courier). Used for the
   * nbsp-padded pricing blocks ({{FinalPrice}} / {{MultipleLocationsFinalPrice}})
   * where columns must line up — proportional fonts don't have uniform
   * character widths, so nbsp-count padding only produces real alignment in
   * a monospace font.
   */
  monospace?: boolean;
}

export type Block =
  | { kind: 'paragraph'; runs: StyledRun[]; align?: 'left' | 'center' | 'right'; marginLeft?: number }
  | { kind: 'bullet'; runs: StyledRun[]; marginLeft?: number }
  | { kind: 'number'; index: number; runs: StyledRun[]; marginLeft?: number }
  /** Two-column key-value row rendered with right-aligned amount. */
  | { kind: 'pricing-row'; label: string; value: string; bold?: boolean; underline?: boolean };

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
    const style = el.getAttribute('style') ?? '';
    const alignMatch = /text-align:\s*(left|center|right)/i.exec(style);
    const align = alignMatch ? (alignMatch[1].toLowerCase() as 'left' | 'center' | 'right') : undefined;
    const mlMatch = /margin-left:\s*([\d.]+)px/i.exec(style);
    const marginLeft = mlMatch ? parseFloat(mlMatch[1]) : undefined;

    // If this paragraph contains <pricingrow> children (from a token substituted
    // inline), split around them so each emits the correct block type. Runs
    // before/after the pricingrow tags become their own paragraph blocks.
    const hasPricingRows = el.childNodes.some(
      (n) => n.nodeType === NodeType.ELEMENT_NODE && (n as HTMLElement).tagName?.toUpperCase() === 'PRICINGROW',
    );
    if (hasPricingRows) {
      const flushRuns = (runs: StyledRun[]) => {
        const segments: StyledRun[][] = [[]];
        for (const r of runs) {
          if (r.text === '\n') segments.push([]);
          else segments[segments.length - 1].push(r);
        }
        for (const seg of segments) {
          if (seg.length > 0 && seg.some((r) => r.text.trim())) {
            out.push({ kind: 'paragraph', runs: seg, align, ...(marginLeft ? { marginLeft } : {}) });
          }
        }
      };
      let pending: StyledRun[] = [];
      for (const child of el.childNodes) {
        const childEl = child as HTMLElement;
        if (child.nodeType === NodeType.ELEMENT_NODE && childEl.tagName?.toUpperCase() === 'PRICINGROW') {
          flushRuns(pending);
          pending = [];
          out.push({
            kind: 'pricing-row',
            label: childEl.getAttribute('label') ?? '',
            value: childEl.getAttribute('value') ?? '',
            bold: childEl.getAttribute('bold') === 'true',
            underline: childEl.getAttribute('underline') === 'true',
          });
        } else {
          pending.push(...collectRuns(childEl));
        }
      }
      flushRuns(pending);
      return;
    }

    const runs = collectRuns(el);
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
        out.push({ kind: 'paragraph', runs: [{ text: '', bold: false, italic: false }], align, ...(marginLeft ? { marginLeft } : {}) });
      } else {
        out.push({ kind: 'paragraph', runs: seg, align, ...(marginLeft ? { marginLeft } : {}) });
      }
    }
    return;
  }
  if (tag === 'PRICINGROW') {
    const label = el.getAttribute('label') ?? '';
    const value = el.getAttribute('value') ?? '';
    const bold = el.getAttribute('bold') === 'true';
    const underline = el.getAttribute('underline') === 'true';
    out.push({ kind: 'pricing-row', label, value, bold, underline });
    return;
  }
  if (tag === 'UL') {
    pushListItems(el, out, 'bullet', 0);
    return;
  }
  if (tag === 'OL') {
    pushListItems(el, out, 'number', 0);
    return;
  }
  // Unknown top-level tag — flatten its text as a paragraph.
  const runs = collectRuns(el);
  if (runs.length > 0) out.push({ kind: 'paragraph', runs });
}

// Walk direct <li> children of a <ul>/<ol>, recursing into nested lists with
// increasing marginLeft so nesting depth maps to PDF indent (20 px/level ≈ 15 pt).
function pushListItems(
  el: HTMLElement,
  out: Block[],
  kind: 'bullet' | 'number',
  depth: number,
): void {
  let index = 0;
  for (const child of el.childNodes) {
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const childEl = child as HTMLElement;
    if (childEl.tagName?.toUpperCase() !== 'LI') continue;
    index++;
    // Collect text for this item, skipping nested UL/OL so their text doesn't bleed up.
    const runs = collectRuns(childEl, { bold: false, italic: false }, new Set(['UL', 'OL']));
    const marginLeft = depth > 0 ? depth * 20 : undefined;
    if (kind === 'bullet') {
      out.push({ kind: 'bullet', runs, ...(marginLeft !== undefined ? { marginLeft } : {}) });
    } else {
      out.push({ kind: 'number', index, runs, ...(marginLeft !== undefined ? { marginLeft } : {}) });
    }
    // Recurse into nested lists found as direct children of this LI.
    for (const nested of childEl.childNodes) {
      if (nested.nodeType !== NodeType.ELEMENT_NODE) continue;
      const nestedEl = nested as HTMLElement;
      const nestedTag = nestedEl.tagName?.toUpperCase();
      if (nestedTag === 'UL') pushListItems(nestedEl, out, 'bullet', depth + 1);
      else if (nestedTag === 'OL') pushListItems(nestedEl, out, 'number', depth + 1);
    }
  }
}

function collectRuns(
  el: HTMLElement,
  ctx: { bold: boolean; italic: boolean; underline?: boolean; fontSize?: number; monospace?: boolean } = { bold: false, italic: false },
  skipTags: Set<string> = new Set(),
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
        runs.push({ text, bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, fontSize: ctx.fontSize, monospace: ctx.monospace });
      }
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;

    const childEl = child as HTMLElement;
    const tag = childEl.tagName?.toUpperCase();

    if (skipTags.has(tag)) continue;

    if (tag === 'BR') {
      runs.push({ text: '\n', bold: ctx.bold, italic: ctx.italic, underline: ctx.underline, fontSize: ctx.fontSize, monospace: ctx.monospace });
      continue;
    }

    const next = { ...ctx };
    if (tag === 'STRONG' || tag === 'B') next.bold = true;
    if (tag === 'EM' || tag === 'I') next.italic = true;
    if (tag === 'U') next.underline = true;
    // Parse font-size / font-family from <span style="..."> (TipTap TextStyle
    // output, plus our own monospace pricing-column spans).
    if (tag === 'SPAN') {
      const style = childEl.getAttribute('style') ?? '';
      const sizeMatch = /font-size:\s*([\d.]+)pt/i.exec(style);
      if (sizeMatch) {
        const parsed = parseFloat(sizeMatch[1]);
        if (!isNaN(parsed) && parsed > 0) next.fontSize = parsed;
      }
      if (/font-family:\s*monospace/i.test(style)) next.monospace = true;
    }
    runs.push(...collectRuns(childEl, next, skipTags));
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
