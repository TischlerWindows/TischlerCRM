# Proposal Builder — Phase 3 (Replanned): PDFKit + Rich Text

**Date:** 2026-05-12
**Roadmap:** [docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md](docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md) — Phase 3 of 8.
**Supersedes:** the earlier "rich text + per-template font (on jsPDF)" sketch in the roadmap.
**Predecessor PRs:** Phase 1 ([#121](https://github.com/TischlerWindows/TischlerCRM/pull/121)) merged inline help and the decision banner; Phase 2 ([#122](https://github.com/TischlerWindows/TischlerCRM/pull/122)) added schema-driven token sources.

## Context

Two decisions from the conversation reshape this phase:

1. **Replace jsPDF with PDFKit.** No more investment in jsPDF. PDFKit is pure Node.js, fits the existing stack with zero new infrastructure, and supports inline bold/italic via its `continued: true` text API. Render time stays under 1s, no Chromium in the Docker image, no Railway cost increase.
2. **The builder is admin-only.** End users never see the in-browser preview — they'll click "Create Proposal" and get a PDF. So preview/PDF pixel-perfect parity (the main reason to choose Puppeteer) stops mattering. The preview is just an admin sanity check.

This phase delivers: an admin can author bold/italic/lists in the block body, and the generated PDF actually renders that formatting. Everything ships in Node, server-side, in one focused PR.

## Scope

### In scope (this PR)

1. **Server-side PDFKit renderer.** New API route `POST /proposal-pdf/render` that takes a summary ID + template ID and returns a PDF binary. Implements the Tischler proposal layout — letterhead, addressee, numbered specs, pricing, options, exclusions, closing, conditional installation appendix — using PDFKit primitives.
2. **Rich text editor for block body.** Replace the plain textarea with Tiptap (StarterKit: Bold, Italic, BulletList, OrderedList, Paragraph). Same for variant body. Body storage becomes HTML; tokens stay as plain text (`{{tokenName}}`).
3. **Preview renders HTML safely.** Update [letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx) to render the rich body using a sanitized HTML approach (DOMPurify-cleaned, then injected via `dangerouslySetInnerHTML` with a strict allowlist).
4. **"Preview PDF" button wired to the new route.** The button calls the backend, downloads or opens the PDF.
5. **HTML → PDFKit parser.** A small (~150 LOC) walker that consumes Tiptap's HTML output (`<p>`, `<strong>`, `<em>`, `<ul>/<ol>/<li>`, `<br>`) and emits PDFKit `text({ continued: true })` calls with the right `.font()` style switches.
6. **jsPDF code path kept but unused.** Stays in the repo for emergency rollback; gets deleted in a small cleanup PR after we've verified the PDFKit path in prod.

### Deferred (separate follow-up PRs after this lands)

- **"Save to Dropbox" button** in the builder. Calls the existing [`POST /dropbox/upload/:objectApiName/:recordId`](apps/api/src/routes/dropbox.ts:1982) route with the rendered PDF bytes. Tiny PR.
- **"Create Proposal" end-user button** outside the builder (the user-facing entry point you mentioned). Also tiny — just a button on the Opportunity record that calls the render route.
- **Per-template font.** PDFKit's `doc.registerFont()` makes this trivial; add when there's a concrete font to use. Half-day PR.
- **Cleanup PR** deleting the jsPDF code path.

### Hard out of scope (no PR)

- Replacing the in-browser preview with a different renderer.
- Migrating existing plain-text bodies in the DB (handled lazily — see below).
- Changes to the conditions engine, variants engine, or token resolution from Phase 2.
- Underline (Tiptap StarterKit doesn't include it; add only if requested).

## Decisions baked into this plan

| Question | Decision | Why |
|---|---|---|
| Library: PDFKit or jsPDF? | **PDFKit.** | Inline `continued: true` text API for bold/italic; built-in font registration; mature; pure Node.js; lighter resource use than Puppeteer. |
| Where does PDFKit run? | **Server-side**, in the Fastify API. | Filesystem font access; Dropbox upload happens server-side anyway; clean separation; no client bundle bloat. |
| Body storage format | **HTML** in the existing `body` String column. No schema change. | Tiptap's natural output; no migration table change; backwards compatible. |
| Existing plain-text bodies | **Lazy upgrade.** Renderer treats body starting with `<` as HTML, else wraps in `<p>`. First save through Tiptap converts to HTML. | No migration script needed. No risk to existing data. |
| Token chips inside the editor | **Plain text `{{tokenName}}`.** Chip click inserts the literal token at cursor. | Simpler than Tiptap's Mention extension; matches today's behavior; tokens still get resolved at assembly time. |
| HTML parser (backend) | **node-html-parser** (~50 KB, lightweight). | Predictable Tiptap output; don't need cheerio's full jQuery surface. |
| HTML sanitization (frontend preview) | **isomorphic-dompurify** with a strict tag/attribute allowlist before `dangerouslySetInnerHTML`. | Defense in depth: even though admins write bodies, a compromised admin account or a future copy-paste from untrusted source should not be able to inject scripts. Industry-standard library, well-audited, tiny. |
| jsPDF code | **Keep in repo, unused.** Delete in a follow-up cleanup PR. | Rollback safety. |
| Per-template font | **Defer.** Out of this phase. | Smaller PR; PDFKit makes it trivial to add later. |
| "Save to Dropbox" | **Defer to follow-up PR.** | Pure UX layered on top of the renderer; doesn't need to ride along. |

## Files

### Backend

| File | Change |
|---|---|
| **New** [apps/api/src/routes/proposal-pdf.ts](apps/api/src/routes/proposal-pdf.ts) | Fastify route `POST /proposal-pdf/render` (auth required). Validates body with Zod (`summaryId`, `templateId`). Fetches summary from Settings, template + presets + token mappings from Prisma. Calls the renderer. Returns `application/pdf` stream. |
| **New** [apps/api/src/lib/proposal-pdf/](apps/api/src/lib/proposal-pdf/) | New directory. |
| **New** `apps/api/src/lib/proposal-pdf/renderer.ts` | Main renderer. Imports PDFKit, calls `assembleProposal` (the existing assembly layer ports cleanly), walks sections, draws blocks. ~400 LOC. |
| **New** `apps/api/src/lib/proposal-pdf/html-to-runs.ts` | HTML→styled-runs walker. Takes an HTML string, returns `Array<{ kind: 'paragraph' \| 'bullet' \| 'number'; runs: Array<{ text: string; bold: boolean; italic: boolean }> }>`. ~150 LOC. |
| **New** `apps/api/src/lib/proposal-pdf/layout.ts` | Layout helpers — page header, footer, section heading renderers. ~150 LOC. |
| **Modified** [apps/api/src/app.ts](apps/api/src/app.ts) | Register the new route. |
| **Modified** [apps/api/package.json](apps/api/package.json) | Add `pdfkit` + `@types/pdfkit` + `node-html-parser` dependencies. |
| **Modified** [apps/api/Dockerfile](apps/api/Dockerfile) (if needed) | PDFKit ships with its own font data — no system font install required. **Confirm during exploration.** If a custom font is needed for the Tischler brand, drop the file into `apps/api/assets/fonts/` and register at startup. |

The assembly layer ([apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts), [apps/web/lib/quote-conditions.ts](apps/web/lib/quote-conditions.ts), [apps/web/lib/quote-placeholders.ts](apps/web/lib/quote-placeholders.ts)) is currently in the **web** workspace. The backend route needs to call it. Two options to surface during exploration:

- **Option A:** Move assembly helpers to a shared package (`packages/proposal-assembly/`) imported by both web (for preview) and api (for PDF render). Cleaner.
- **Option B:** Duplicate the logic into the API workspace. Faster, more drift risk.

Option A is the right call. The move is mechanical — `mv apps/web/lib/{proposal-assembly,quote-conditions,quote-placeholders}.ts packages/proposal-assembly/src/`, update imports, add to workspace `package.json`s. This is its own work item inside Phase 3.

### Frontend

| File | Change |
|---|---|
| [apps/web/package.json](apps/web/package.json) | Add `@tiptap/react`, `@tiptap/starter-kit`, `isomorphic-dompurify`. |
| **New** `apps/web/app/proposal-builder/_components/body-editor.tsx` | Tiptap wrapper with toolbar (Bold, Italic, BulletList, OrderedList). Accepts `value: string` (HTML) and `onChange(html: string)`. Exposes an imperative ref for `insertText(token: string)` so the variable-chips panel can insert at the cursor. ~150 LOC. |
| **New** `apps/web/app/proposal-builder/_components/safe-rich-html.tsx` | Small component that DOMPurify-sanitizes an HTML string with a strict allowlist (`p, br, ul, ol, li, strong, em, b, i`) and renders via `dangerouslySetInnerHTML`. ~20 LOC. Centralized so we have ONE place that handles sanitization. |
| [apps/web/app/proposal-builder/_components/block-editor.tsx](apps/web/app/proposal-builder/_components/block-editor.tsx) | Replace the `<textarea>` with `<BodyEditor>`. Drop `bodyTextareaRef`; switch to a `bodyEditorRef` exposing `insertText`. |
| [apps/web/app/proposal-builder/_components/variant-editor.tsx](apps/web/app/proposal-builder/_components/variant-editor.tsx) | Same — `<textarea>` → `<BodyEditor>` for each variant body. |
| [apps/web/app/proposal-builder/_components/variable-chips.tsx](apps/web/app/proposal-builder/_components/variable-chips.tsx) | Keep the click-to-insert hint added in Phase 1. Click handler unchanged. |
| [apps/web/app/proposal-builder/_components/letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx) | Replace `<p className="whitespace-pre-wrap">{preset.body}</p>` with `<SafeRichHtml html={preset.body} />`. Add a tiny Tailwind prose-style block so the formatting actually looks right. Body still flows through `resolveTokens` in the assembly layer first, so token replacement is unchanged. |
| [apps/web/app/proposal-builder/page.tsx](apps/web/app/proposal-builder/page.tsx) | Replace the `generateTemplatePreviewPDF` import + call with a `fetch('/api/proposal-pdf/render', { method: 'POST', body: JSON.stringify({...}) })`. Show a spinner during the request. Open the returned blob in a new tab. |
| **No file change** — confirm pattern | [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts) stays for now, untouched. Marked deprecated in a JSDoc comment at the top so future readers know to use the backend route. |

## Implementation sketches

### Sanitized preview component (Frontend)

```tsx
// apps/web/app/proposal-builder/_components/safe-rich-html.tsx
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = ['p', 'br', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i'];
const ALLOWED_ATTR: string[] = []; // no attributes needed for our limited markup

export function SafeRichHtml({ html, className }: { html: string; className?: string }) {
  // Backwards compat: plain text (no <) is wrapped as a paragraph.
  const wrapped = html.trim().startsWith('<') ? html : `<p>${html}</p>`;
  const clean = DOMPurify.sanitize(wrapped, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

DOMPurify enforces the allowlist server-side and client-side — anything outside the allowed tags is stripped before it ever reaches the DOM. Even if a body somehow contained `<script>` or `<iframe>`, DOMPurify removes them. The `dangerouslySetInnerHTML` wrap is gated behind a one-line sanitization call that we trust.

### Backend route

```ts
// apps/api/src/routes/proposal-pdf.ts
const renderSchema = z.object({
  summaryId: z.string(),
  templateId: z.string(),
});

export async function proposalPdfRoutes(app: FastifyInstance) {
  app.post('/proposal-pdf/render', async (req, reply) => {
    if (!req.user?.sub) return reply.code(401).send({ error: 'Auth required' });

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid request' });

    const template = await prisma.quoteTemplate.findUnique({
      where: { id: parsed.data.templateId },
      include: { presets: { include: { conditions: true, variants: true } }, tokenMappings: true },
    });
    if (!template) return reply.code(404).send({ error: 'Template not found' });

    const summary = await loadSummaryFromSettings(parsed.data.summaryId);
    if (!summary) return reply.code(404).send({ error: 'Summary not found' });

    const { opportunity, project } = await fetchLinkedRecords(summary);

    const result = assembleProposal({
      summary, template,
      tokenMappings: template.tokenMappings,
      opportunity, project,
    });

    const pdfBuffer = await renderProposalPDF(result);
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${result.pdfData.projectName}_Quote.pdf"`)
      .send(pdfBuffer);
  });
}
```

### PDFKit renderer skeleton

```ts
// apps/api/src/lib/proposal-pdf/renderer.ts
export async function renderProposalPDF(result: ProposalAssemblyResult): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 56 /* ~0.78" */ });
  const chunks: Buffer[] = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  drawLetterhead(doc, result.pdfData);
  drawIntro(doc, result.sections.CONSTANT);
  drawSpecifications(doc, result.sections.SPECIFICATION);
  drawPricing(doc, result.pdfData);
  drawOptions(doc, result.sections.OPTION, result.pdfData);
  drawExclusions(doc, result.sections.EXCLUSION);
  drawClosing(doc, result.pdfData);
  if (result.pdfData.hasInstallation) {
    doc.addPage();
    drawInstallationAppendix(doc, result.sections.INSTALLATION, result.pdfData);
  }

  doc.end();
  return done;
}

function drawBlockBody(doc: PDFKit.PDFDocument, html: string) {
  const blocks = htmlToRuns(html);
  for (const block of blocks) {
    if (block.kind === 'paragraph') {
      drawStyledLine(doc, block.runs);
    } else if (block.kind === 'bullet') {
      doc.text('• ', { continued: true });
      drawStyledLine(doc, block.runs);
    } else if (block.kind === 'number') {
      doc.text(`${block.index}. `, { continued: true });
      drawStyledLine(doc, block.runs);
    }
  }
}

function drawStyledLine(doc: PDFKit.PDFDocument, runs: StyledRun[]) {
  runs.forEach((run, i) => {
    const fontStyle = run.bold && run.italic ? 'Helvetica-BoldOblique'
                    : run.bold              ? 'Helvetica-Bold'
                    : run.italic            ? 'Helvetica-Oblique'
                    : 'Helvetica';
    const isLast = i === runs.length - 1;
    doc.font(fontStyle).text(run.text, { continued: !isLast });
  });
}
```

### HTML→runs walker

```ts
// apps/api/src/lib/proposal-pdf/html-to-runs.ts
import { parse } from 'node-html-parser';

export interface StyledRun { text: string; bold: boolean; italic: boolean }
export type Block =
  | { kind: 'paragraph'; runs: StyledRun[] }
  | { kind: 'bullet'; runs: StyledRun[] }
  | { kind: 'number'; index: number; runs: StyledRun[] };

export function htmlToRuns(html: string): Block[] {
  const wrapped = html.trim().startsWith('<') ? html : `<p>${html}</p>`;
  const root = parse(wrapped);
  const blocks: Block[] = [];

  for (const node of root.childNodes) {
    if (node.nodeType !== 1) continue;
    const el = node as any;
    if (el.tagName === 'P') {
      blocks.push({ kind: 'paragraph', runs: collectRuns(el) });
    } else if (el.tagName === 'UL') {
      for (const li of el.querySelectorAll('li')) blocks.push({ kind: 'bullet', runs: collectRuns(li) });
    } else if (el.tagName === 'OL') {
      el.querySelectorAll('li').forEach((li: any, idx: number) =>
        blocks.push({ kind: 'number', index: idx + 1, runs: collectRuns(li) }),
      );
    }
  }
  return blocks;
}

function collectRuns(el: any, ctx: { bold?: boolean; italic?: boolean } = {}): StyledRun[] {
  const runs: StyledRun[] = [];
  for (const child of el.childNodes) {
    if (child.nodeType === 3) {
      runs.push({ text: child.text, bold: !!ctx.bold, italic: !!ctx.italic });
    } else if (child.nodeType === 1) {
      const tag = child.tagName;
      const next = { ...ctx };
      if (tag === 'STRONG' || tag === 'B') next.bold = true;
      if (tag === 'EM' || tag === 'I') next.italic = true;
      runs.push(...collectRuns(child, next));
    }
  }
  return runs;
}
```

### Frontend BodyEditor

```tsx
// apps/web/app/proposal-builder/_components/body-editor.tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { forwardRef, useImperativeHandle } from 'react';

export interface BodyEditorHandle {
  insertText: (text: string) => void;
}

export const BodyEditor = forwardRef<BodyEditorHandle, {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}>(({ value, onChange, placeholder }, ref) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useImperativeHandle(ref, () => ({
    insertText: (text) => editor?.chain().focus().insertContent(text).run(),
  }), [editor]);

  if (!editor) return null;

  return (
    <div className="border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-brand-navy/20">
      <div className="flex gap-0.5 px-1.5 py-1 border-b border-gray-200 bg-gray-50">
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3 h-3" /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3 h-3" /></ToolbarBtn>
        <div className="w-px bg-gray-200 mx-1" />
        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3 h-3" /></ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3 h-3" /></ToolbarBtn>
      </div>
      <EditorContent editor={editor} className="prose prose-sm max-w-none px-2.5 py-2 text-xs min-h-[180px] focus:outline-none" />
    </div>
  );
});
```

## Pre-work that has to happen first

**Move assembly to a shared package.** This is mechanical but needs to happen before the backend route can call `assembleProposal`. The work:

1. `mkdir packages/proposal-assembly`
2. Move [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts), [apps/web/lib/quote-conditions.ts](apps/web/lib/quote-conditions.ts), [apps/web/lib/quote-placeholders.ts](apps/web/lib/quote-placeholders.ts) into the new package.
3. Create `packages/proposal-assembly/package.json` + `tsconfig.json` matching the pattern of `packages/types/` or `packages/storage/`.
4. Update all import paths in `apps/web` from `@/lib/proposal-assembly` → `@crm/proposal-assembly`.
5. Re-run typecheck + lint.
6. Add the package to both `apps/web` and `apps/api` `package.json`s.

This is one commit in the same PR. ~30 minutes of mechanical work.

## Security

- **All rich-text body content runs through DOMPurify** before any DOM injection. The allowlist permits exactly the tags Tiptap StarterKit emits (`p, br, ul, ol, li, strong, em, b, i`) and zero attributes. Anything else gets stripped.
- **The PDFKit renderer never executes scripts** — it only walks the HTML AST for text and basic structural tags. Even if a malicious body slipped through, the PDF output is plain text + style metadata; no executable surface.
- **Auth on the new render route**: requires `req.user?.sub` (matches the existing JWT pattern from CLAUDE.md). Anonymous calls get 401.
- **No URL parameters carry sensitive data** — summaryId + templateId are in the POST body, not the URL.

## Verification

1. `pnpm install` succeeds; PDFKit + Tiptap + node-html-parser + isomorphic-dompurify are in the lockfile.
2. `pnpm --filter @crm/proposal-assembly build` and `pnpm --filter web typecheck` pass.
3. In `/proposal-builder`, the body field shows a toolbar with Bold / Italic / Bullet List / Numbered List.
4. Type "Hello", select it, click Bold → text becomes bold. Save the block → reload → still bold.
5. Click "Preview PDF" → API call to `/proposal-pdf/render` → PDF downloads/opens. Bold text is bold in the PDF.
6. Click a variable chip → `{{tokenName}}` is inserted at cursor in the body editor.
7. Bulleted list rendered correctly in PDF.
8. Variant body editor works the same way.
9. Existing plain-text bodies (the 20 default blocks) render correctly in the preview AND the PDF without any migration.
10. Switch to a different summary → preview + Preview PDF both re-resolve tokens.
11. Sanity-check: open browser DevTools, inspect the preview DOM, confirm that body content only contains the allowlisted tags. Try to save a block with body `<script>alert(1)</script>foo` via the API directly → the rendered preview shows only `foo`.
12. jsPDF-based `generateTemplatePreviewPDF` is no longer called from anywhere (grep returns zero hits).

## Risk + rollback

- **Risk: medium-high.** New backend route, new dependency set, new editor library, shared package extraction, and a behavior change all at once. Mitigated by:
  - Keeping the jsPDF code in the repo as a fallback (only the import is removed from page.tsx)
  - Tiptap's content model degrades gracefully — plain text bodies render as-is in the new editor
  - HTML-to-runs handles both HTML and plain text input
  - Server-side rendering means the failure surface is contained — no client-side crashes
  - DOMPurify is well-audited; we use it with a strict allowlist
- **Rollback**: revert the PR. Block bodies that have been saved as HTML render fine via the HTML walker; if rolled back to a textarea, those bodies would display HTML literal tags in the textarea. **Mitigation:** the HTML walker logic is in the shared package and survives a frontend-only rollback. If we need a full rollback after some bodies have been saved as HTML, run a quick one-time DB script that strips tags. Document this in the PR.
- **Schema:** none. Body stays a String.
- **Resource impact on Railway:** negligible (PDFKit per-render is ~30 MB peak, <1s).

## Open questions to confirm during implementation

- **Custom font for the Tischler brand.** PDFKit ships with Helvetica/Times/Courier built in. If there's a brand font to use, drop the `.ttf` into `apps/api/assets/fonts/` and we'll register it. For Phase 3 I'll start with Helvetica unless told otherwise.
- **PDF download vs inline open.** The "Preview PDF" button can either download the file or open in a new tab. Default to opening in a new tab — feels less disruptive — but it's a one-line change.
- **`Content-Disposition` filename.** `<ProjectName>_Quote_<YYYY-MM-DD>.pdf` is a reasonable default; flag if you want something else.
- **Underline.** Tiptap StarterKit doesn't include underline. Add it (`@tiptap/extension-underline`) only if you actively want it; otherwise skip — fewer formats = simpler UX.

## Branch + PR

- Branch: `claude/proposal-builder-phase-3-pdfkit-rich-text` (already created from main).
- PR title: `feat: proposal builder phase 3 — PDFKit renderer + rich text editor`
- PR body: scope items + the "jsPDF kept but unused" disclaimer + the rollback note + the security note about DOMPurify.

## After this lands

Three small follow-up PRs in order:

1. **"Save to Dropbox" button** in the builder (and on the Opportunity record, eventually) — calls render + the existing Dropbox upload route. Small.
2. **Per-template font picker** in template settings → `doc.registerFont()` in the renderer. Half-day.
3. **Delete jsPDF code path** — cleanup PR. Small.

After all three: jsPDF is gone, end users can hit "Create Proposal" wherever we put that button, and the result is auto-saved to Dropbox under the right Opportunity folder.
