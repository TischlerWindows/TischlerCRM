# Proposal Builder — Roadmap

**Original date:** 2026-05-12
**Last updated:** 2026-05-12 (post-Phase 3)
**Source:** [docs/proposals/2026-05-12-proposal-builder-investigation.md](docs/proposals/2026-05-12-proposal-builder-investigation.md) — the walkthrough investigation that produced the gap list.
**Reference materials:**
- Live builder: `https://tischlercrm.up.railway.app/proposal-builder`
- Target output: *Little Club Rd 1 26489 Quote 1 (Julian Edits).pdf*
- Original design: [docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md](docs/superpowers/specs/2026-05-07-quote-pdf-builder-design.md)
- POC scope map: [docs/proposals/little-club-rd-poc-map.md](docs/proposals/little-club-rd-poc-map.md)

## Status snapshot

| # | Phase | Status | PR |
|---|---|---|---|
| 1 | Inline help & quick wins | **Merged** | [#121](https://github.com/TischlerWindows/TischlerCRM/pull/121) |
| 2 | Schema-driven token sources | **In review** | [#122](https://github.com/TischlerWindows/TischlerCRM/pull/122) |
| 3 | PDFKit renderer + Tiptap rich text | **In review** | [#123](https://github.com/TischlerWindows/TischlerCRM/pull/123) |
| 4 | PDFKit polish + jsPDF cleanup | Pending | — |
| 5 | Per-user signature | Pending | — |
| 6 | Seed default OPTION + INSTALLATION blocks (data task) | Pending | — |
| 7 | Per-template font | Pending | — |
| 8 | Polish pass | Pending | — |

The shape of the roadmap changed significantly after Phase 3. The "Status snapshot" reflects the *current* plan. The "Why the roadmap changed" section below explains how we got here.

## Why the roadmap changed after Phase 3

Phase 3 (PDFKit + Tiptap) absorbed work that the original roadmap had spread across phases 4–7. Two reasons:

1. **Moving to server-side PDFKit meant rewriting the whole renderer from scratch.** While doing that, it was simpler to draw the right structure once than to ship it incrementally. The PDFKit renderer ([apps/api/src/lib/proposal-pdf/renderer.ts](apps/api/src/lib/proposal-pdf/renderer.ts)) already handles section headings, pricing table, add-on rows, installation appendix, and page breaks (via `doc.addPage()`).
2. **The Phase 1 investigation surfaced** that the in-browser preview ([apps/web/app/proposal-builder/_components/letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx)) was already doing the section grouping, pricing table, add-on rows, and installation appendix the original Phase 4–7 had planned to build. Phase 3 carried that work over to the PDF side.

What's left in each former phase:

| Original phase | What's done | What's left |
|---|---|---|
| **Phase 4** Section rendering + page breaks | Section headings, installation appendix new-page break — all done in PDFKit + preview | The `bufferPages: true` fix surfaced by code review on PR #123; optional `pageBreakAfter` flag on SpecPreset |
| **Phase 5** Pricing table block type | Auto-rendered + zero-row suppression already working in PDFKit + preview | Making the rows admin-editable per template (deferred — no current need) |
| **Phase 6** Conditional add-on rows | Add-on rows render conditionally based on summary `addOns.*.final` already | Default OPTION blocks (the narrative text) need seeding — data task, not code |
| **Phase 7** Signature + installation appendix | Installation appendix renders conditionally on a new page already | Per-user signature image upload + render |

Net effect: phases 4 / 5 / 6 / 7 collapse to one polish PR + one feature (signature) + one data task. The roadmap below replaces the original 8-phase plan with **5 remaining items** that are each smaller and more focused.

## Decisions still in effect from the original roadmap

| Question | Decision | Implication |
|---|---|---|
| PDF library | **PDFKit, server-side** (Phase 3 changed this from jsPDF) | Pure Node.js, ~$0–3/month Railway cost, <1s renders |
| Font control granularity | **Per-template font** | One `QuoteTemplate.fontFamily` field; no per-block font UI |
| Page break model | **Auto-paginate** (PDFKit handles overflow) + optional explicit `pageBreakAfter` on SpecPreset | PDFKit handles overflow naturally; explicit flag for forced breaks |
| Token data path | **Summary first, fall back to Opportunity** | Done in Phase 2 |
| Signature mechanic | **Sales-rep-scoped (per-user)** | Phase 5: new `User.signatureImageUrl` field |
| Are exclusions ever conditional? | **Default: no** | EXCLUSION blocks are CONSTANT-style content |

---

## Remaining phases

### Phase 4 — PDFKit polish + jsPDF cleanup

**Size:** Small. One focused PR.

**Goal:** Address the unresolved issues from the PR #123 code review and remove the deprecated jsPDF code.

**Scope:**
- **Fix `bufferPages: true` in PDFKit renderer.** Currently the renderer constructs `new PDFDocument(...)` without `bufferPages: true`, which means `bufferedPageRange()` returns the wrong range and `switchToPage()` won't reach earlier pages. Footer page numbers will drop on earlier pages of multi-page proposals. (Code review issue, scored 75.)
- **Optional `pageBreakAfter: Boolean` flag on `SpecPreset`** — schema change, surfaces in the block editor as a checkbox. Lets admins force a page break after a specific block. Defer if not needed yet; can ship in a separate small PR.
- **HTML-escape mismatch fix** in `SafeRichHtml` — server-side `htmlToBlocks` escapes plain-text bodies before wrapping in `<p>` (apps/api/src/lib/proposal-pdf/html-to-runs.ts); the client-side `SafeRichHtml` does not. Adding `escapeHtml` to the client wrapper makes preview and PDF render identically for legacy bodies that contain `<`, `>`, `&`. (Code review issue, scored 75.)
- **Delete `apps/web/lib/quote-pdf-renderer.ts`** — the deprecated jsPDF renderer. All in-app callers were switched to the backend route in Phase 3's fix commit (proposal-builder page + opportunity widget). One remaining caller in [apps/web/app/summary/page.tsx](apps/web/app/summary/page.tsx) needs to be switched OR confirmed unused; the `generateQuotePDF` export from there is separate from the proposal flow.
- **Remove the `jspdf` dependency** from `apps/web/package.json` after deletion.

**Risk:** Low. The `bufferPages` fix is a one-line addition to the PDFKit constructor; the cleanup is a delete.

**Out of scope:**
- The "Test Hardware Note" debug block removal — Phase 1 left this as a manual in-prod action. Worth confirming it's done; not blocking.

---

### Phase 5 — Per-user signature

**Size:** Small-medium. One PR.

**Goal:** Replace the placeholder closing block with a real signed closing using each sales rep's signature.

**Scope:**
- **Schema change** (requires approval per CLAUDE.md): add `User.signatureImageUrl: String?` and `User.signatureLabel: String?` (e.g. "V.P. of Sales – SE USA & Caribbean Basin"). Pure additive change, no migration risk.
- **Signature settings page** for each user to upload their own PNG (re-uses the existing Dropbox storage layer at [apps/api/src/routes/dropbox.ts](apps/api/src/routes/dropbox.ts)).
- **Backend resolver:** in [apps/api/src/routes/proposal-pdf.ts](apps/api/src/routes/proposal-pdf.ts), after loading the summary, look up `User` by name matching `summary.salesman` to find their signature URL + label.
- **PDFKit renderer:** in `drawClosing`, fetch the signature image, draw it via `doc.image()` above the typed name and signature label.
- **Preview:** similarly show the signature image in `letter-preview.tsx` for parity.

**Risk:** Medium. Image fetching can fail; needs a fallback (skip the image if not found, render the typed name). Schema change requires approval.

**Verification:**
1. Upload a signature PNG in user settings.
2. Generate a proposal where `summary.salesman` matches the uploaded user → PDF closing shows the image, typed name, and label.
3. Generate against a summary where the salesman has no signature → text closing only, no broken-image placeholder.

---

### Phase 6 — Default OPTION + INSTALLATION block content (data task)

**Size:** Tiny. Can be done entirely in the in-prod builder UI by an admin — no code PR required.

**Goal:** Seed the default template with the standard OPTION blocks (Magnetic Alarm Contacts, Final Finish, Installation) and INSTALLATION-appendix blocks per the reference Tischler PDF.

Scope is purely content authoring — the infrastructure (conditions, sections, renderer) is all already in place after Phase 3.

**If desired as a code PR:** write a one-off seed script in [apps/api/seed.ts](apps/api/seed.ts) that idempotently upserts these default blocks on a known template ID. Each block gets:
- `section: 'OPTION'` or `'INSTALLATION'`
- `isAlwaysIncluded: false`
- A condition like `hasMagneticContacts IS_TRUE`
- A rich-text body with the standard narrative text

**Risk:** Low.

---

### Phase 7 — Per-template font

**Size:** Small. One PR.

**Goal:** Let each template pick its own font (per the original "per-template font" decision).

**Scope:**
- **Schema change** (requires approval): add `QuoteTemplate.fontFamily: String?` (default `null` → Helvetica).
- **Drop a font file** into `apps/api/assets/fonts/` for the Tischler brand (or use a curated list of free professionals like Source Serif, EB Garamond, Inter). Surface a font picker in template settings.
- **PDFKit renderer:** call `doc.registerFont('Brand', path)` at startup if the brand font exists; pass the font name through to the renderer.
- **Preview:** `letter-preview.tsx` already uses a hard-coded font stack; switch to the template's choice via CSS variable.

**Open question to resolve before this phase:** does Tischler have a specific brand font they want to use? If yes, drop the `.ttf` file in. If not, ship with the existing Helvetica.

**Risk:** Low. Adds zero infrastructure cost.

---

### Phase 8 — Polish pass

**Size:** Medium. Could split into 2-3 small PRs.

**Goal:** Round off the remaining P2 friction points from the original investigation.

**Scope:**
- **Block list grouped by Section** with collapsible headers. Today admins see 20 blocks as one flat list — grouping by section (CONSTANT / SPECIFICATION / OPTION / EXCLUSION / INSTALLATION) makes the list scannable.
- **Filter / search** at the top of the block list.
- **Missing-token lint UI.** The assembly layer already produces `warnings` (unresolved tokens) and the preview surfaces them in an amber banner. Add the same lint warning *inline* on the body editor when an admin types a token that doesn't resolve.
- **Multi-summary preview.** Pick two summaries from the top bar; render them side-by-side. Useful when authoring a block to confirm it renders correctly across different summary configurations.
- **Autosave indicator.** Replace the "Unsaved changes" pill with autosave-on-blur + a "Saved Xs ago" timestamp.
- **Drag handle for cross-section reordering** in the block list (today reorder works only within a section).

**Risk:** Low. Pure UI/UX, no engine changes.

---

## Cross-phase concerns

- **Backups before destructive changes.** Phase 5's schema additions are additive (zero risk). Any future migrations should snapshot Railway Postgres first.
- **Schema changes always surfaced for approval first** per [CLAUDE.md "Schema is read-only by default"](CLAUDE.md). Phases 4 (optional) and 5 add columns; surface a diff before running `prisma migrate dev`.
- **Mobile.** The Proposal Builder is a desktop admin tool. Mobile responsiveness is not a goal of any phase.
- **Backend tests.** Per CLAUDE.md, there's no backend test suite. Frontend logic gets Jest tests in `apps/web` only.
- **"Test Hardware Note" debug block.** Phase 1 left this as a manual in-prod cleanup. Worth verifying it was done. Not blocking.

## Sequencing rationale

1. **Phase 4 (PDFKit polish + cleanup) first** because the `bufferPages: true` fix is a real bug that affects multi-page renders, and the jsPDF cleanup is genuinely safe now (no in-app callers).
2. **Phase 5 (signature) next** because it's the most visible feature improvement and the schema change is low-risk.
3. **Phase 6 (default content)** is a data task — can be done in parallel by an admin in the prod UI. Not on the critical path.
4. **Phase 7 (per-template font)** is gated on font choice. Can happen anytime after a font is selected.
5. **Phase 8 (polish)** last because it's most beneficial when the underlying surface stops moving.

## Open items deferred from this roadmap

- **Per-item conditional exclusions** — defaulted to "always boilerplate". Revisit if a real case appears.
- **Repeater blocks** for product rows. Current approach: aggregate tokens per product type.
- **Elevations attachment** (CAD drawings). Out of proposal-builder scope.
- **Persisted generated-proposal records, email send, approval workflows** — per the original POC scope.
- **Save-to-Dropbox** — explicitly dropped per user direction in the Phase 3 discussion. Could re-add later as a small follow-up.
- **End-user "Create Proposal" button** on the Opportunity page — actually delivered in the Phase 3 fix commit (the header-highlights widget). End users on an Opportunity record can hit the existing **Proposal PDF** button and get a server-rendered PDF.
- **Pricing-table admin editability** — the auto-rendered pricing table works; making the rows user-configurable is a different feature.
- **Backend test runner** — not introduced.

## Where to start next

**Phase 4 (PDFKit polish + cleanup)** is the cheapest, lowest-risk, highest-value next step. It addresses real production bugs (the bufferPages issue) and removes the deprecated jsPDF dependency now that nothing in app code uses it. Estimated effort: half a day.
