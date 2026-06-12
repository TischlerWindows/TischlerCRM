'use client';

import sanitizeHtml from 'sanitize-html';
import parse from 'html-react-parser';

/**
 * Tags Tiptap's StarterKit emits that we render in the proposal body.
 * Anything outside this list is stripped before parsing.
 */
const ALLOWED_TAGS = ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'span'];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    // Allow span with style restricted to font-size only (for TextStyle/font-size extension).
    span: ['style'],
  },
  allowedStyles: {
    span: {
      'font-size': [/^\d+(\.\d+)?pt$/],
    },
  },
  // Drop disallowed tags entirely (no fallback to plain text inside <script>).
  disallowedTagsMode: 'discard',
};

interface Props {
  /** Rich text body — either HTML (Tiptap output) or plain text (legacy). */
  html: string;
  /** Tailwind classes applied to the wrapper. */
  className?: string;
}

/**
 * Render a proposal block body safely.
 *
 * Two layers of defense:
 *  1. sanitize-html strips anything outside the strict allowlist (no script,
 *     no iframe, no event handlers, no inline styles, no attributes at all).
 *     Pure Node — no JSDOM, no DOM polyfills — so it works in Next.js SSR
 *     without the issues that isomorphic-dompurify exhibits.
 *  2. html-react-parser converts the cleaned HTML into real React elements,
 *     so the rendered output is plain JSX — never a raw HTML string injected
 *     into the DOM.
 *
 * Backwards-compatible: plain-text bodies (no leading `<`) are wrapped in
 * `<p>` before sanitization so legacy non-HTML content still renders. The
 * wrapper applies `whitespace-pre-wrap` so embedded newlines in legacy bodies
 * are preserved (rich-text content with explicit block tags is unaffected).
 */
export function SafeRichHtml({ html, className }: Props) {
  const isPlainText = !html.trim().startsWith('<');
  // Escape `<`, `>`, `&` in plain-text legacy bodies so they survive sanitize-html
  // as literal characters. Matches the server-side wrapper in html-to-runs.ts so
  // the preview and the PDF render identically for bodies that contain those
  // characters (e.g. "AC < 200 amps", "B & B Restoration").
  const wrapped = isPlainText ? `<p>${escapeHtml(html)}</p>` : html;
  const clean = sanitizeHtml(wrapped, SANITIZE_OPTIONS);
  return (
    <div className={className} style={isPlainText ? { whiteSpace: 'pre-wrap' } : undefined}>
      {parse(clean)}
    </div>
  );
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
