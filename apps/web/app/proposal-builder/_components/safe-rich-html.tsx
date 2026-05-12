'use client';

import DOMPurify from 'isomorphic-dompurify';
import parse from 'html-react-parser';

/**
 * Tags emitted by Tiptap's StarterKit that we render in the proposal body.
 * Anything outside this list is stripped before parsing.
 */
const ALLOWED_TAGS = ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i'];

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
 *  1. DOMPurify strips anything outside the strict allowlist (no script, no
 *     iframe, no event handlers, no data: URLs, no attributes at all).
 *  2. html-react-parser converts the cleaned HTML into real React elements,
 *     so the rendered output is plain JSX — never a raw HTML string injected
 *     into the DOM.
 *
 * Backwards-compatible: plain-text bodies (no leading `<`) are wrapped in
 * `<p>` before sanitization so legacy non-HTML content still renders.
 */
export function SafeRichHtml({ html, className }: Props) {
  const wrapped = html.trim().startsWith('<') ? html : `<p>${html}</p>`;
  const clean = DOMPurify.sanitize(wrapped, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
  });
  return <div className={className}>{parse(clean)}</div>;
}
