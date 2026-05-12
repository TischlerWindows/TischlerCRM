# Proposal Builder — Full Roadmap

**Date:** 2026-05-12
**Status:** Roadmap. Each phase below is a separate branch + PR; phases land sequentially. Individual phase plans get written when we drill in.
**Source:** [docs/proposals/2026-05-12-proposal-builder-investigation.md](docs/proposals/2026-05-12-proposal-builder-investigation.md) — investigation that produced the gap list.
**Reference materials:**
- Live builder: `https://tischlercrm.up.railway.app/proposal-builder`
- Target output: *Little Club Rd 1 26489 Quote 1 (Julian Edits).pdf* (Teams chat reference)
- Original design: [docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md](docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md)
- POC scope map: [docs/proposals/little-club-rd-poc-map.md](docs/proposals/little-club-rd-poc-map.md)

## Context

The Proposal Builder ([apps/web/app/proposal-builder/page.tsx](apps/web/app/proposal-builder/page.tsx)) ships with 20 spec blocks, a working live preview, a variant authoring system, a token library, and a conditions engine — the *engine* is right. The walkthrough on 2026-05-12 surfaced four classes of gaps:

1. **Comprehension** — admins can't tell what Driver Variable / Variants / Conditions / Sections / Always Included actually do.
2. **Breadth of token sources** — Project / Quote / Products are not first-class; field lists are hand-curated rather than schema-driven.
3. **Formatting** — no bold/italic, no nested lists, plain monospace textarea body.
4. **Missing PDF sections** — itemized pricing table, OPTIONS, exclusions list, signed closing, installation appendix, section headings between groups, multi-page support.

This roadmap addresses all four classes across 8 phases. The shape is "comprehension first, then capability, then content."

## Decisions confirmed with the user

| Question | Decision | Implication |
|---|---|---|
| Font control granularity | **Per-template font** (with per-character bold/italic inside it) | One `template.fontFamily` field + font picker in template settings; no per-block font UI. |
| Page break model | **Auto-paginate + explicit page-break block** | Renderer handles overflow; a new `PAGE_BREAK` section/block type forces a new page. Installation appendix uses one. |
| Quote / Products token data path | **Summary first, fall back to Opportunity** | Resolver checks summary `rows[]`/`doorRows[]`/`addOns` first; falls through to Opportunity-linked records when fields are missing. Token names live in a flat namespace (e.g. `products.doubleHung.qty`). |
| Signature mechanic | **Sales-rep-scoped (per-user)** | New `User.signatureImageUrl` field; the salesman on the summary supplies the signature on the generated PDF. |
| Are exclusions ever conditional? | **Default: no (deferred)** | Phase 5 ships exclusions as a single CONSTANT block with a bulleted list. Per-item conditional inclusion is deferred until a real use case appears. |

## Phase ordering — at a glance

| # | Phase | Type | Rough size | Risk |
|---|---|---|---|---|
| 1 | Inline help + quick wins | UI copy, small JSX | S | Low |
| 2 | Schema-driven token sources | API + modal | M | Medium (touches metadata fetch) |
| 3 | Rich-text body + per-template font | Editor swap + schema change + migration | **L (biggest)** | Medium-high |
| 4 | Section rendering + page breaks | Renderer | M | Medium |
| 5 | Pricing table block type | New block kind | M | Low |
| 6 | Conditional add-on rows (OPTIONS) | New condition family | S–M | Low |
| 7 | Signature + installation appendix | User schema + renderer | M | Low |
| 8 | Polish pass | UI niceties | S–M | Low |

Each phase is one branch + one PR named `claude/proposal-builder-phase-N-<slug>`.

---

## Phase 1 — Inline help & quick wins

**Goal:** Make every existing control in the editor self-explanatory in one pass, and clean up debug content. Zero engine changes — pure UI copy + small JSX.

**Scope:**
- Add a `?` tooltip + one-line description next to: **Section**, **Driver Variable**, **Always included**, **Active**, **Conditions** header.
- Replace the current Conditions empty-state hint ("No conditions — this block will be excluded unless 'Always included' is on") with a richer explanation that clarifies AND vs. OR semantics across multiple condition rows. (Confirm the engine's behavior in [apps/api/src/workflow-engine.ts](apps/api/src/workflow-engine.ts) before writing the copy — *do not guess*.)
- Add a "Why is this block included / hidden?" tooltip on each preview block that shows the resolved conditions and Always-included state for the current summary.
- Add a short hint above the Variables chip grid: *"Click a chip to insert at cursor, or drag into the body."*
- Add an empty-state for the Variant editor when Driver Variable is first set: *"This block now changes based on `glassType`. Add one variant for each value — for example, `28` → glass spec for type 28."*
- Delete or hide the **"Test Hardware Note"** block (block 20) from the default template. It currently renders as *"This proposal uses $0.00 and $0.00"* — leftover debug content.

**Files to touch:**
- [apps/web/app/proposal-builder/_components/block-editor.tsx](apps/web/app/proposal-builder/_components/block-editor.tsx) (or wherever the editor lives — confirm during exploration)
- [apps/web/app/proposal-builder/_components/condition-builder.tsx](apps/web/app/proposal-builder/_components/condition-builder.tsx)
- [apps/web/app/proposal-builder/_components/variant-editor.tsx](apps/web/app/proposal-builder/_components/variant-editor.tsx)
- [apps/web/app/proposal-builder/_components/variable-chips.tsx](apps/web/app/proposal-builder/_components/variable-chips.tsx)
- [apps/web/app/proposal-builder/_components/letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx) (for the "why hidden" tooltip)
- One-time data fix: delete/deactivate the "Test Hardware Note" SpecPreset row.

**Verification:**
1. Hover every control in the editor — every one has a tooltip with one plain-English sentence.
2. Click a block in the preview → hover the "i" icon → see resolved conditions: e.g. *"Hidden because `hasDoors` is false on this summary"*.
3. New empty Variant state actually shows the example copy.
4. "Test Hardware Note" no longer appears in the preview.

**Out of scope (defer to later phases):**
- Any actual behavior changes to conditions/variants.
- Restructuring the editor layout.

---

## Phase 2 — Schema-driven token sources

**Goal:** Make "link to fields from summary / opportunity / project / quote / products" work. Replace the hand-curated New Token field list with one driven from the custom-object schema.

**Scope:**
- Extend Source Object dropdown from `Summary / Contact / Account / Opportunity / System` to include **Project, Quote, Products**.
- Drive Source Field dropdown from `CustomObject` + `CustomField` metadata for the chosen object. Reads use the existing CustomField API; no new tables.
- Token resolution: extend the proposal assembly resolver ([apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts)) so a token like `{{quote.someField}}` looks up the Quote record linked from the Opportunity.
- Products as a Source Object resolves to **summary-first, opportunity-fallback** (per decision above). Token names: `products.<typeSlug>.<field>` (e.g. `products.doubleHung.qty`, `products.doubleHung.firstRoom`). Where products are an array, expose either an aggregate (`products.doubleHung.totalQty`) or first-row reference, with a doc note that arrays need a future "repeater block" (deferred).
- Update the token preview to show a rendered example value pulled from the currently selected summary.

**Files to touch:**
- [apps/web/app/proposal-builder/_components/new-token-modal.tsx](apps/web/app/proposal-builder/_components/new-token-modal.tsx)
- [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) (resolver)
- [apps/api/src/routes/quote-token-mappings.ts](apps/api/src/routes/quote-token-mappings.ts) (or wherever token mappings POST lives — confirm)
- Possibly add a small API helper `GET /custom-objects/:api/fields` if not already exposed.

**Data model:**
- `TokenMapping` already stores `sourceObject` + `sourcePath` (per the existing schema). The change is widening the allowed `sourceObject` values and treating `sourcePath` as a CustomField api name rather than a hardcoded key. No migration needed if existing rows are already `sourceObject: SUMMARY` + `sourcePath: someField`.

**Verification:**
1. Open New Token modal → Source Object now lists Summary / Contact / Account / Opportunity / **Project / Quote / Products** / System.
2. Selecting Project loads its actual `CustomField` set from the schema (not a hardcoded list).
3. Create a `{{quote.someField}}` token, insert it into a block, see the resolved value in the preview.
4. Existing Summary-sourced tokens still work (regression check).

**Out of scope:**
- Repeater blocks (looping over `products.allTypes[]`) — deferred until needed.
- Cross-summary token resolution.

---

## Phase 3 — Rich-text body + per-template font  ⚠️ BIGGEST PHASE

**Goal:** Replace the plain textarea body with a minimal rich-text editor (bold / italic / underline / nested lists / inline token chips). Add one per-template font setting.

This is the most invasive change in the roadmap. It changes the body storage format and requires migrating 20 existing blocks. Plan to scope this carefully when we drill in.

**Scope:**
- Pick a small rich-text library that handles tokens as inline atoms cleanly. Recommended starting point: **Tiptap** (ProseMirror-based) — has a `Mention` extension that fits the "token chip" model, supports HTML serialization, ~50KB gzipped. Confirm during exploration that nothing else in the repo already pulls in a richer editor; reuse if so.
- Change `SpecPreset.body` storage from `String` (plain) to `String` (HTML serialized from the editor). Same column type, no migration on the DB side; values migrate in place via a one-time script that wraps existing plain text in `<p>` tags and converts `{{token}}` references to `<span data-token="...">{{token}}</span>` (or whatever the Mention serialization is).
- Toolbar in the editor: Bold, Italic, Underline, Bulleted list, Numbered list, Insert token (opens a chip picker that filters the existing Variables list).
- Same change applies to **Variant body text** — each variant's body becomes rich text.
- **Per-template font:** add `QuoteTemplate.fontFamily` (and optionally `fontScale`) fields. Template settings page gets a font picker (start with a curated list: Tischler letterhead font if licensed, a couple of professional serifs/sans-serifs). Renderer uses this font for the whole proposal.
- Preview renderer ([apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) and [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts)) must accept HTML body and render bold/italic/lists correctly in both the live preview and the generated PDF.

**Files to touch (expected):**
- New dependency: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention` (or equivalent).
- [apps/web/app/proposal-builder/_components/block-editor.tsx](apps/web/app/proposal-builder/_components/block-editor.tsx)
- [apps/web/app/proposal-builder/_components/variant-editor.tsx](apps/web/app/proposal-builder/_components/variant-editor.tsx)
- New component: `apps/web/app/proposal-builder/_components/body-editor.tsx` (Tiptap wrapper used by both block and variant editors).
- [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) — token resolver now operates over HTML or document JSON rather than raw string.
- [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts) — render bold/italic/lists in PDF output.
- [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) — `QuoteTemplate.fontFamily` (per-CLAUDE-md schema rule: surface this change and wait for approval before migrating).
- One-time migration script: `apps/api/scripts/migrate-proposal-body-to-html.ts`.

**Verification:**
1. Open Impact Glass block → see the existing body wrapped in `<p>`, tokens shown as chips.
2. Select a word, hit Cmd-B, save, preview → that word is bold in the rendered PDF.
3. Create a bulleted list inside the body → renders correctly in preview and PDF.
4. Change the template font in template settings → all blocks re-render with new font.
5. Run the migration script on prod → no body text is lost; every existing block renders identically (within whitespace).
6. **Rollback path:** if the migration produces visible regressions, revert by restoring the previous `body` values from a backup snapshot (snapshot the table before running the migration — non-negotiable).

**Risks:**
- Tiptap bundle size — confirm web bundle doesn't grow more than 100KB gzipped.
- Token chip insertion UX inside a rich editor is fiddlier than in a textarea (especially with keyboard focus). Allow extra QA time.
- PDF renderer may not handle HTML directly; might need an intermediate AST. Investigate during exploration.

**Open questions to resolve during exploration:**
- Does the existing PDF renderer use a HTML-to-PDF library (puppeteer, html-pdf, react-pdf)? If react-pdf, we render structured doc JSON rather than HTML.
- Is there a Tischler letterhead font we should license, or do we use a free professional alternative (e.g. Source Serif, EB Garamond)?

---

## Phase 4 — Section rendering + page breaks

**Goal:** Make the Section enum actually do something visually. Today CONSTANT / SPECIFICATION / OPTION / EXCLUSION / INSTALLATION all flow as one numbered list; the reference PDF treats them as distinct sections with their own headings and (sometimes) page breaks.

**Scope:**
- Group rendered blocks by Section. Render section transitions as configurable headings:
  - SPECIFICATION → no heading (the numbered list is the section)
  - OPTION → heading **"OPTIONS — ADDITIONS OR DEDUCTIONS TO OUR BASE BID"** (text editable per template)
  - EXCLUSION → heading **"Our Base Bid does not include:"** (text editable per template)
  - INSTALLATION → starts on a new page with its own letterhead block.
- Numbering resets per section (specifications are `(1)…(20)`, exclusions are `(1)…(15)`).
- New block type **PAGE_BREAK** (or a `pageBreakAfter: Boolean` flag on `SpecPreset`). When set, the renderer breaks before the next block. Useful for the installation appendix.
- Editor exposes a "Section Heading" inline editor in template settings (one editable string per Section enum value, stored on the template).

**Files to touch:**
- [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) — group by section, reset numbering, insert headings.
- [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts) — handle `pageBreakAfter`.
- [apps/web/app/proposal-builder/_components/letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx) — show section headings in live preview.
- [apps/web/app/proposal-builder/_components/block-editor.tsx](apps/web/app/proposal-builder/_components/block-editor.tsx) — `pageBreakAfter` checkbox.
- Possibly schema: `QuoteTemplate.sectionHeadings: Json` (or fixed strings per section).

**Verification:**
1. Live preview shows distinct headings between specifications, options, and exclusions.
2. Numbering resets between sections.
3. Toggle `pageBreakAfter` on the warranty block → installation appendix starts on page 2 of the preview.
4. Generated PDF matches the visual layout of the reference PDF's section breaks.

**Out of scope:**
- Per-section font/color overrides (deferred — per-template font is enough).

---

## Phase 5 — Pricing table block type

**Goal:** Add a structured pricing block instead of a one-line `BASE BID PRICE: $0.00` footer. Match the reference PDF's itemized table.

**Scope:**
- New block kind: `PRICING_TABLE`. Stores a list of rows (label + token-bound value). Rows with `$0.00` are hidden automatically.
- Default row set (configurable in the block editor):
  - "Double Hungs:" → `{{doubleHungPrice}}`
  - "Euro Windows:" → `{{euroWindowsPrice}}`
  - "Doors:" → `{{euroDoorsPrice}}`
  - **BASE BID PRICE:** → `{{grandTotal}}` (rendered in bold, with a top border)
- These tokens are already defined in the existing token mapping ([little-club-rd-poc-map.md § Initial Variable Map](docs/proposals/little-club-rd-poc-map.md#initial-variable-map)).
- Editor for the pricing block: a small grid (label / token / formatting flags), plus an order handle.

**Files to touch:**
- [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) — new `SpecPreset.blockKind` enum or a `pricingRows: Json` field; surface for approval.
- [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) — render PRICING_TABLE blocks specially.
- [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts) — table layout in PDF.
- New component: `apps/web/app/proposal-builder/_components/pricing-table-editor.tsx`.

**Verification:**
1. Replace the current PRICING footer with a `PRICING_TABLE` block on the default template.
2. Live preview shows the four-row pricing table with bold base-bid row.
3. Set a summary's `euroWindowsPrice` to 0 → that row disappears from the preview.

---

## Phase 6 — Conditional add-on rows (OPTIONS)

**Goal:** Build the OPTIONS section per the reference PDF — each row appears only when the corresponding add-on is included on the summary.

**Scope:**
- New condition family: `addOnIncluded:<addOnKey>` (e.g. `addOnIncluded:magneticContact`). The condition fires `IS_TRUE` when the summary's `addOns.<addOnKey>.final > 0`.
- The `addOnItems` condition field already exists in the engine vocabulary — extend it to support per-add-on resolution rather than only set-level checks. Confirm engine code in [apps/api/src/workflow-engine.ts](apps/api/src/workflow-engine.ts) during exploration.
- Three OPTION blocks ship as default content for the new template:
  - "ADD: Magnetic Alarm Contacts" with `addOnIncluded:magneticContact`
  - "ADD: Factory Applied Final Finish" with `addOnIncluded:finalFinish`
  - "ADD: Installation" with `addOnIncluded:installation`
- Each block's body is rich text (Phase 3 dependency) and ends with the add-on's `{{<addOn>Price}}` token rendered right-aligned.

**Files to touch:**
- [apps/api/src/workflow-engine.ts](apps/api/src/workflow-engine.ts) — condition evaluator extension.
- [apps/web/app/proposal-builder/_components/condition-builder.tsx](apps/web/app/proposal-builder/_components/condition-builder.tsx) — surface per-add-on options in the condition field dropdown.
- Seed data: three OPTION-section blocks added to the default template.

**Verification:**
1. Pick a summary with `addOns.magneticContact.final = 2670` → Magnetic Alarm Contacts row appears with `$2,670.00`.
2. Pick a summary with `addOns.magneticContact.final = 0` → row is gone.
3. Same behavior for Final Finish and Installation.

---

## Phase 7 — Signature + installation appendix

**Goal:** Replace the placeholder "Sincerely, Jim" close with a real signed closing. Add the installation appendix as a conditionally-included multi-block section.

**Scope:**
- **Signature:** add `User.signatureImageUrl` field (plus a `signatureLabel` for the title line like "V.P. of Sales – SE USA & Caribbean Basin"). Add a settings page where each user uploads their own signature image (via the existing Dropbox storage). The closing block on the proposal pulls the salesman's signature based on `summary.salesman`. The closing block renders: cursive signature image, then the salesman's typed name, then their signature label.
- **Installation appendix:** a sequence of INSTALLATION-section blocks (already enum-supported) that ship as default content. Includes:
  - Letterhead block
  - Project name / date / "Installation Quote" line
  - Pricing table (Phase 5) with installation breakdown rows
  - Bulleted installation notes (Phase 3 rich text)
  - "Hoisting Equipment / Exclusions / Final Adjustments / NOTE" paragraphs
- The entire appendix is gated on `addOnIncluded:installation` (Phase 6 dependency) — when installation isn't included, the appendix doesn't render at all.
- Auto page-break (Phase 4 dependency) ensures the appendix starts on a new page.

**Files to touch:**
- [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) — `User.signatureImageUrl` + `signatureLabel`.
- New page: `apps/web/app/settings/profile/signature/page.tsx` (or extend an existing profile page).
- [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) — resolve summary.salesman → User → signature.
- [apps/web/lib/quote-pdf-renderer.ts](apps/web/lib/quote-pdf-renderer.ts) — render image signature.
- Seed: installation appendix blocks added to default template.

**Verification:**
1. Upload a signature in user settings.
2. Generate a proposal with `summary.salesman = <self>` → the rendered closing shows the uploaded signature image + name + title.
3. Generate a proposal with `addOns.installation.final = 8900` → installation appendix appears on page 2 with the right pricing.
4. Generate a proposal with installation not included → no appendix.

**Out of scope:**
- Elevations attachment (pages 6–8 of the reference PDF) — deferred. The reference shows CAD-style window drawings that are produced externally; integrating them is a separate body of work.

---

## Phase 8 — Polish pass

**Goal:** Round off the remaining P2 friction points from the investigation.

**Scope:**
- Block list grouped by Section with collapsible headers (CONSTANT / SPECIFICATION / OPTION / EXCLUSION / INSTALLATION).
- Filter / search box at the top of the block list.
- Missing-token lint: scan each block's body on save; if a `{{tokenName}}` isn't in the token mappings or doesn't resolve on the current summary, show a yellow banner under the body field. (Already called out as a requirement in [little-club-rd-poc-map.md § Admin Builder Requirements](docs/proposals/little-club-rd-poc-map.md#admin-builder-requirements).)
- Multi-summary preview: switch summaries in the top bar; on the next iteration, add a side-by-side compare mode (two summaries shown stacked).
- Autosave indicator: replace the "Unsaved changes" pill with autosave-on-blur + a "Saved 5s ago" timestamp.
- Optional: drag handle for reordering across sections (today, reorder only seems to work within the list).

**Verification:**
1. Block list collapses by section.
2. Type a non-existent token like `{{junk}}` → see a lint warning on save.
3. Side-by-side preview shows two summaries' renderings.
4. Edit a block, click away → see "Saved Xs ago".

---

## Cross-phase concerns

- **Backups before destructive changes.** Phase 3's body migration and any seed-data edits in Phases 5–7 must take a DB snapshot first. Use Railway's Postgres snapshots.
- **Schema changes always surfaced for approval first.** Phases 3, 5, 7 each add new columns ([CLAUDE.md "Schema is read-only by default"](CLAUDE.md)). Each phase plan will pause for explicit approval before running `prisma migrate dev`.
- **Mobile.** The Proposal Builder is a desktop admin tool. Mobile responsiveness is not a goal of any phase; assert this once in Phase 1 and don't revisit.
- **Backend tests.** Per CLAUDE.md, there's no backend test suite and we're not adding one. New frontend logic (resolver, condition evaluator additions) gets unit tests via Jest in the `apps/web` workspace.
- **Test Hardware Note debug block** is killed in Phase 1, not later.

## Sequencing rationale (why this order)

1. **Phase 1 first** because every later phase is easier to discuss when admins can read the controls.
2. **Phase 2 before Phase 3** because rich text is more expensive to scope correctly when you don't yet know how many fields tokens need to reach.
3. **Phase 3 before 4–7** because almost every later phase needs the rich-text body (lists for exclusions, bold for spec titles, image for signature).
4. **Phase 4 (section rendering) before 5–7** because pricing tables, OPTIONS rows, exclusions, and the installation appendix all rely on section grouping + page breaks to look right.
5. **Phase 5 → 6 → 7** in this order because each phase depends on the previous (pricing table → conditional add-on rows that reuse the pricing-table block → installation appendix that reuses both).
6. **Phase 8 last** because polish is cheap to defer and most beneficial when the underlying surface stops moving.

## How to use this roadmap

For each phase:
1. Branch from `main`: `claude/proposal-builder-phase-N-<slug>`.
2. Write a phase-specific implementation plan in `docs/superpowers/plans/2026-MM-DD-proposal-builder-phase-N-<slug>.md` (drill-in plan) — this will go through plan-mode approval before any code.
3. Implement → open PR → merge after review.
4. Update this roadmap's phase status as PRs land.

If a phase reveals new gaps not covered here, surface them and we adjust the roadmap rather than scope-creeping the phase PR.

## Open items deferred from this roadmap

- **Per-item conditional exclusions** — defaulted to "always boilerplate". Revisit if a real case appears.
- **Repeater blocks** for product rows (e.g. one block per product type with its own quantity/room) — deferred. Current approach is to define aggregate tokens per product type.
- **Elevations attachment** (CAD drawings, pages 6–8 of the reference PDF). Out of proposal-builder scope per the original design spec.
- **Persisted generated-proposal records, Dropbox save/upload, email send, approval workflows** — all deferred per the original POC scope ([little-club-rd-poc-map.md § Deferred Items](docs/proposals/little-club-rd-poc-map.md#deferred-items)).
- **Backend-side test runner** — not introduced.

## Where to start

Phase 1 is the cheapest, lowest-risk, highest-comprehension-per-hour change in the entire plan. When you're ready, the next step is a focused plan for Phase 1 ready for execution.
