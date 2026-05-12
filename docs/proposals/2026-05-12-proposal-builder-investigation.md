# Proposal Builder — UX Investigation

**Date:** 2026-05-12
**Status:** Investigation only — no code changes.
**Sources reviewed:**
- Deployed builder at `https://tischlercrm.up.railway.app/proposal-builder` (logged in as Ben Mickool, "Standard Quote Letter (Default)" template, "Gilchrist Avenue #161/181" summary)
- Reference PDF *Little Club Rd 1 26489 Quote 1 (Julian Edits).pdf* — Julian's hand-annotated example showing what each section should be driven by
- Existing scope docs: [docs/proposals/little-club-rd-poc-map.md](docs/proposals/little-club-rd-poc-map.md), [docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md](docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md)

## TL;DR

The core engine is there — 20 blocks, a working live preview, a variant system, conditions, and a token library — and the UX shape (three-pane: blocks / preview / editor) is right. What's missing is mostly **comprehension** and **breadth**:

1. **Discoverability of complex features is poor.** The biggest concepts — Driver Variables, Variants, Conditions, Section types, "Always included" — have no inline explanation. A new admin opens the editor and sees five controls whose names don't match what they do.
2. **The user's mental model ("link to summary / opportunity / project / quote / products objects") doesn't match the builder's.** The token-creation modal only exposes Summary / Contact / Account / Opportunity / System as sources, and the field list under each is hand-curated rather than schema-driven. Project, Quote, and Products are not first-class sources.
3. **Formatting capability is text-only.** No bold/italic, no per-block font choice, no nested lists. The reference PDF uses bold spec titles, an indented sub-paragraph under #1, bulleted exclusions, and a cursive signature — none of which are achievable today.
4. **Several reference-PDF sections aren't built yet.** No itemized pricing breakdown (Double Hungs / Euro Windows / Doors → BASE BID), no OPTIONS section with add-on rows, no "Our Base Bid does not include" exclusions list, no signed closing, no installation appendix, no elevations attachment.

The shortest path to "looks simple, drives a complex system" is to (a) make every complex setting self-explanatory in the panel where it lives, (b) widen the token sources and let the field list come from the schema, and (c) layer light rich-text on top of the existing body field.

## 1. What the builder does today

### 1.1 Top-level layout

Three-pane shell:
- **Left:** BLOCKS list (20 in the default template) with a VARIABLES panel below it. The Blocks/Variables divider is now draggable (PR #120, this session).
- **Center:** live letter preview rendered from the selected summary; highlights the currently-selected block.
- **Right:** block editor for whatever's selected.

Top bar: Settings / Proposal Builder / Template selector / Summary selector / Preview PDF / Save.

### 1.2 Block list

Each row shows: order number, title, a **section tag** (CONSTANT, SPECIFICATION, OPTION, EXCLUSION, INSTALLATION), and an optional "Always" tag. Drag-to-reorder appears to be supported (handle on the left). No grouping, no filtering, no search inside the blocks list itself.

The 20 blocks in the current template are spec paragraphs (Title, Intro, Impact Glass, Non-Impact Glass, Wood Species, Spacer Bar System, SDL Muntins, Sill Horns, Dip Impregnation, Finish Coat, Tempered Glass — Doors, Glazing Caulk, Security Hardware — Garden Doors, 90-Degree Stops, Hardware, Hinges, Weatherstripping, Bronze Thresholds — Doors, Lift & Roll Hardware, Warranty, Shipment, Installation Materials, Shop Drawings, Down Payment & Terms, Test Hardware Note) plus a "PRICING" footer with `BASE BID PRICE: $0.00`. Roughly maps to lines 1–22 of the reference PDF's letter body.

### 1.3 Block editor (right panel)

For a simple block (Driver Variable = None):
- **Title** — free text
- **Section** — segmented control: CONSTANT / SPECIFICATION / OPTION / EXCLUSION / INSTALLATION
- **Driver Variable** — dropdown: None / Glass Type / Job Type / Product Types / Wood Type / Finish Type / Spacer Bar Type / SDL Type
- **Body Text** — plain `<textarea>` with `{{token}}` placeholders (single-color monospace, no formatting toolbar)
- **Always included** / **Active** — two checkboxes
- **Conditions** — `Where [field] [operator] [value]` rows with **+ Add Condition**

When a Driver Variable is set, Body Text disappears and is replaced by **Variant** rows, each with `Match Value`, `Label (optional)`, and its own Body Text — plus **+ Add Variant**.

**Conditions vocabulary** is fixed and domain-aware:
- 35 condition fields: 24 product-presence flags (`hasWindows`, `hasDoors`, `hasDoubleHung`, …`hasJambExtensions`), 8 type/category fields (`glassType`, `jobType`, `finishType`, `woodType`, `sdlType`, `spacerBarType`, `spacerBarColors`, `productTypes`), 3 composites (`hardwareOptions`, `addOnItems`, `quoteType`), and `projectContains`.
- 5 operators: `CONTAINS`, `EQUALS`, `NOT_EMPTY`, `IS_TRUE`, `IS_FALSE`.

### 1.4 Variables panel

A flat-but-grouped chip library: **ADD-ONS, CONTACT, MATERIALS, PRICING** (and likely more below the fold). Each chip is a token (`grandTotal`, `contactSalutation`, `glassType`, …) that can be inserted into the body — although the *how* (click vs. drag vs. cursor-aware insert) is not visible in the UI.

### 1.5 New Token modal

Fields:
- **Source Object:** Summary / Contact / Account / Opportunity / System
- **Source Field:** hand-curated dropdown (e.g., for Summary: Project Name, Opportunity Number, Job Type, Quote Type, Glass Type, Wood Type, Finish, SDL, Spacer Bar Type, Spacer Bar Colors, Plans Dated, Salesman, Estimator, Address, Contact Name, Contact Email, Contact Phone, Company Name, Company Address — 19 items)
- **Token Name** + **Display Label** (free text)
- **Format:** Text / Currency / Date / Phone / Percentage
- **Category:** Custom, plus others (Project / Contact / …)

### 1.6 Live preview

Works well and is the strongest part of the builder. Re-renders on edit, highlights the selected block, and respects conditional inclusion (Non-Impact Glass disappears when its `Contains Non-Impact` condition fails). One page is rendered with header logo, recipient address block, salutation, opening paragraph, numbered spec list with bold spec titles + body, and a footer with sales/estimator names. No add-on options section, no exclusions list, no signature line.

## 2. What the goal is

Triangulated from the user story and the Julian-annotated reference PDF.

### 2.1 User story (their words, paraphrased)

- "Easily create new sections of the PDF, linking it to fields from the **summary, opportunity, project, quote, products** objects."
- "See a live preview of what we just added."
- "Easy to understand how to make complex blocks and what each setting means."
- "Builder appears simple, but drives a very complex system that is highly customizable."
- "All of the PDF should be customizable — choosing the font, even down to having some words bold."
- "Multiple pages are fine."

### 2.2 Reference PDF — Julian's annotations

The PDF is 5 letter pages + 3 elevations pages. Each section has a red-ink annotation describing the rule:

| Section / line | Annotation |
|---|---|
| Today's date | "Standard except date is pulled from Plans Dated" |
| Account block | "Generated by Account Receiving The Quote" |
| Individual block | "Generated by Individual Receiving The Quote" |
| Project heading | "Opportunity Name (Project Project Number)" |
| Base bid paragraph | "Standard when doors & windows are in the quote" |
| (1) Impact spec | "Generated with Job Type" |
| (1) sub-paragraph | "Information Generated when #28 Glass is Used" |
| Spacer bar sentence | "Generated by Spacer bar color" |
| (3) Unit types | "Generated by Product Type options — standard 72mm sizes, except Double Hung which is 59mm Concealed balance" |
| (6) Sprosse SDL | "SDL from Summary — could be Sprosse 44, custom sizes, or TDL. Only on quotes with fields/muntins" |
| (7) Window sills | "Standard for jobs with windows" |
| (9) Finish coat | "Based on summary finish field. This is finish 200" |
| (10) Tempered glass | "Standard if the job has doors" |
| (12) Security hardware | "Standard info if Garden Door product type with KFV RH off AND/OR L&R product type with SS RH off" |
| (12) Concealed balance | "Standard info if Double Hung Concealed Balance is a product type" |
| (13) 90-degree stops | "Standard for outswing windows and doors" |
| (14) Handles | Four sub-rules: Outswing Windows / L&R Door / Garden Doors / Standard for all quotes |
| (14b) Double hung locks | "Standard for all Double hungs" |
| (15) Outswing hinges | "Standard for all windows and doors except double hungs. Standard finial selected, also no finial" |
| (16) Weatherstrip | "Standard for double hungs" (for the Schlegel sentence) |
| (17) Bronze thresholds | "Standard for All doors" |
| (18) Warranty | "Standard for all jobs with glass" |
| (19) Shipment | "Standard for all jobs" |
| Pricing table | Double Hungs ← "From quote totals Final W/ADJ Column"; Euro Windows ← "From Quote Totals Grand total"; Doors ← "From Final W/ADJ Column"; Base Bid Price ← composite |
| OPTIONS — Magnetic Alarm | "When Add-on Item Magnetic contact is included" → "$2,670.00 From Add-on Items Final Column" |
| OPTIONS — Final Finish | "When Add-on Item Final Finish is included" → "$5,260.00" |
| OPTIONS — Installation | "When Add-on Item Installation is included" → with sub-breakdown |
| "Our Base Bid does not include" | 15-item static exclusions list — "Standard information for all quotes" |
| Sincerely + signature | Cursive *James G. Myers*, V.P. of Sales — SE USA & Caribbean Basin |
| Installation appendix (page 5) | "Included when installation is included" |
| Elevations (pages 6–8) | Technical CAD-style window/door drawings — likely attached, not generated |

### 2.3 Translated to capabilities

To produce this PDF end-to-end, the builder needs to support:
- (a) Conditional inclusion on **product-type presence**, **type-field equality**, and **add-on presence** — ✅ already in the conditions vocabulary.
- (b) Per-driver-value content swaps — ✅ Variants already cover this.
- (c) **Tokens from many objects' fields** (summary, opportunity, contact, account, add-on rows, quote totals) — partially done; Project/Quote/Products not first-class, and fields are hand-curated.
- (d) **Inline rich text** inside a paragraph (bold spec titles, italic notes, the cursive signature, possibly underlines) — ❌ not supported.
- (e) **Itemized pricing tables** that show only non-zero rows — ❌ no block type for tables; PRICING is hard-coded to one base-bid row.
- (f) **Bulleted/numbered nested lists** (sub-paragraph under spec #1, the 15-item exclusions, installation bullets) — ❌ flat textareas only.
- (g) **Multi-page output and multiple section types in flow** (letter body → OPTIONS heading → exclusions → signature → installation appendix) — Section enum exists (CONSTANT/SPECIFICATION/OPTION/EXCLUSION/INSTALLATION) but the preview currently flows them all as one continuous numbered list; no page break / section heading rendering verified.
- (h) **Attaching external artifacts** (elevations PDFs) — out of scope for the proposal builder per the original spec; flag as deferred.

## 3. Gap analysis — prioritized by user impact

### P0 — Blocks the user story directly

| # | Gap | Symptom | Fix direction (not a plan) |
|---|---|---|---|
| 1 | **Token sources too narrow.** Source Object is fixed to Summary / Contact / Account / Opportunity / System; user wanted Project, Quote, Products too. Field list is hand-curated (19 items for Summary). | "Linking to fields from… project, quote, products" is impossible without a developer adding fields to the curated list. | Drive Source Field from `CustomObject` + `CustomField` metadata (this is a custom-objects system — the metadata already exists). Add Project, Quote, Products as Source Objects, with deep lookup through Opportunity → Project, Opportunity → Quote, and Summary → product rows. Resolver chain belongs in the assembly layer, not the UI. |
| 2 | **No formatting at all.** Plain textarea body, no bold/italic/underline, no per-block font choice, no nested lists. The reference PDF uses bold spec titles, indented sub-paragraphs, bulleted exclusions, and a cursive signature. | "Format things to my exact specifications" / "even down to having some words bold" is impossible. | Replace the body textarea with a minimal contenteditable rich text component that supports **bold / italic / underline / nested lists / inline tokens as chips** and stores HTML or a structured doc (Tiptap/ProseMirror is the usual fit). Tokens should still render as `{{name}}` chips in the editor and resolve at render time. Font choice can live at the *template* level (one font for the whole proposal) — the user does not need per-character font control. |
| 3 | **Complex settings are unlabeled.** Driver Variable, Variants, Conditions, Sections, Always Included — no inline help, no tooltips, no example. A new admin sees five concepts and has to guess. | "Easy to understand what each setting means" is the explicit ask. | Add a small `?` tooltip + one-line plain-English description next to each control. Add an empty-state explanation under each section (e.g., the Conditions header could say *"Add conditions to include this block only for certain projects. Without any, the block appears only if 'Always included' is on."* — that explanation is already implied in code and would just need surfacing). Consider a "Why is this block here / hidden?" inline indicator on each row of the preview. |

### P1 — Reference-PDF features the user expects to ship eventually

| # | Gap | Fix direction |
|---|---|---|
| 4 | No itemized pricing table (Double Hungs / Euro Windows / Doors → BASE BID). Today there's a single PRICING footer with `$0.00` hard-coded. | New block type **PricingTable** with rows tied to summary totals; suppresses zero rows automatically. The token mapping for `doubleHungPrice / euroWindowsPrice / euroDoorsPrice / grandTotal` is already designed in [little-club-rd-poc-map.md](docs/proposals/little-club-rd-poc-map.md). |
| 5 | No OPTIONS section with per-add-on rows. Reference shows "ADD: Magnetic Alarm Contacts… $2,670.00" rows conditional on each add-on. | OPTION section blocks already exist as an enum value — wire them to add-on presence via a new condition family `addOnIncluded:{magneticContact,finalFinish,installation,…}` (the `addOnItems` condition field exists; the value-side semantics need to be designed). |
| 6 | No "Our Base Bid does not include" exclusions list. | New block type **List** (bulleted/numbered) — single rich-text block with list semantics. Reuses the Section=EXCLUSION enum. Or just achievable by gap #2 (rich text with lists). |
| 7 | No signature line / closing block. | A CONSTANT block with the cursive signature as either an image asset or a styled font + the signer name/title. Could be template-scoped (per-template default signer). |
| 8 | No installation appendix. The conditional appendix on page 5 has its own page break, its own header, and tabular pricing. | INSTALLATION section already exists. Once page-break and section-header rendering are in (gap #9), this is mostly content. |
| 9 | Sections (CONSTANT/SPEC/OPTION/EXCLUSION/INSTALLATION) don't seem to render with section breaks or headings in the live preview — all blocks flow as one numbered list. | Render section transitions: OPTION blocks under an "OPTIONS / ADDITIONS OR DEDUCTIONS TO OUR BASE BID" heading; EXCLUSION blocks under "Our Base Bid does not include:"; INSTALLATION starts on a new page. The data is there; the renderer treats it flat. |

### P2 — UX polish that compounds with the above

| # | Gap | Fix direction |
|---|---|---|
| 10 | The Block list doesn't visually group by Section. A user scanning 20 blocks can't see at a glance which are CONSTANT vs. SPECIFICATION vs. OPTION. | Group with collapsible headers (Section tag becomes the group). Keeps the drag-to-reorder model but reduces cognitive load. |
| 11 | Variable insertion mechanic is undocumented. Click? Drag? Cursor-aware? | A 1-line hint above the chip grid: *"Click to insert at cursor, or drag into the body."* And actually make both work, including in a rich-text editor. |
| 12 | "Always included" is one of the most important flags but lives as a small checkbox with no explanation of how it interacts with Conditions. | Move to top of editor next to a "Visibility" label; show its interaction explicitly: *"Always included" overrides all conditions. Otherwise, this block appears only when **all** conditions match.* (Confirm AND vs. OR behavior in the engine — not visible from the UI.) |
| 13 | No "Preview as different summary" UX — switching summaries is a top-bar dropdown, but you can't preview the same block against multiple summaries side-by-side, which is the natural debugging move. | Multi-summary preview tab strip, or a "preview against [summary]" picker in the editor itself. |
| 14 | No warning when a token references a field that's missing on the current summary (the spec [doc § Admin Builder Requirements](docs/proposals/little-club-rd-poc-map.md) calls this out as a requirement, and the preview today silently shows `{{glassType}}` literal in some blocks). | Lint the body on save and surface missing tokens in a small banner under the body field. |
| 15 | "Test Hardware Note" block (block 20) is visible in production with text *"This proposal uses $0.00 and $0.00"* — clearly leftover debug content. | Remove or hide before next demo. (Spinoff candidate.) |
| 16 | No undo/redo, no autosave indicator beyond the "Unsaved changes" pill. | Either autosave + status, or visible Undo. Low priority but reduces fear of editing. |

### Deferred — out of proposal-builder scope per the original spec

- Persisted generated proposal records, Dropbox save/upload, email/approval workflows, elevation-page attachment/rendering ([little-club-rd-poc-map.md § Deferred](docs/proposals/little-club-rd-poc-map.md#deferred-items)). These are mentioned in the user story by implication ("multiple pages is fine, but it needs to be simple") but were scoped out of the POC. Worth re-confirming with the user before promising.

## 4. Recommended sequencing

Order designed so each step ships visible value and unblocks the next:

1. **Comprehension first (P0 #3).** Cheap, high impact. Tooltips + empty-state explanations on Driver Variable / Variants / Conditions / Always Included / Sections. Same UI, more legible.
2. **Widen tokens (P0 #1).** Add Project / Quote / Products as Source Objects; drive Source Field from `CustomField` metadata. This is the single biggest unlock for "easily create new sections linking to fields from any object."
3. **Rich text in the body (P0 #2).** Bold/italic/underline/lists/inline token chips. This single change unlocks gaps #6 and most of #4–8. Defer per-character font choice; do per-template font.
4. **Section rendering + pricing table + add-on options (P1 #4–5, #9).** Now that sections render distinctly and the body supports lists, the OPTIONS section, the exclusions list, and the pricing table become content edits + one new block type (PricingTable).
5. **Signature + installation appendix (P1 #7–8).** Mostly content + page-break rendering. Last because everything else has to render right first.
6. **Polish pass (P2).** Group block list by Section, insertion-hint, multi-summary preview, missing-token lint, remove the debug "Test Hardware Note" block.

If the user has to pick **one** thing to do next, I would pick (1) — tooltips/empty-state copy — because it's hours of work, has no risk, and the rest of the gaps become easier to discuss once an admin can actually read the controls.

## 5. Open questions for the user

Things I'd want to confirm before any of the above turns into a plan:

- **Per-template font vs. per-block font.** The user said "choosing the font" — is one font per template (Tischler letterhead font for everything) enough, or do they want per-block font control? Per-template is much simpler and matches Tischler's brand consistency.
- **Page breaks.** The user said "if this requires multiple pages that is fine." Do you want explicit "page break here" blocks, or should the renderer auto-paginate?
- **Quote / Products as objects.** In the current CRM schema these are custom objects under Opportunity. Should the proposal builder query products **per summary** (i.e., the product rows inside a summary's `rows[]` / `doorRows[]`) or **per opportunity** (the Product records linked to Opportunity)? Different fields, different queries.
- **Signature.** Cursive image, image upload, or a typed signature with a script font? And is it template-scoped or sales-rep-scoped?
- **Are exclusions ever conditional?** Reference PDF treats them as 100% boilerplate ("Standard information for all quotes"). If always-static, the block can be a single CONSTANT block; if ever variable, gap #6 needs to support per-item conditions.

---

**Where to take this next:** if you'd like a concrete plan for any one of the P0 gaps (most likely #3 inline help, since it's the cheapest unlock for "appears simple but drives complex"), I can draft it in plan mode. If you'd like to walk the builder live together and triage where to invest first, the Chrome session is still open and pointed at the same template.
