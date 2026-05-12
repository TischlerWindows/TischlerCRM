# Proposal Builder — Phase 1: Inline Help & Quick Wins

**Date:** 2026-05-12
**Roadmap:** [docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md](docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md) — this is Phase 1 of 8.
**Status:** Plan, awaiting approval. No code changes yet.

## Context

The Proposal Builder editor has five concepts (Section, Driver Variable, Always Included, Active, Conditions) that admins need to use, but none are explained in the UI. A new admin opens the right panel and has to guess what each does. Variants and the conditional preview ("why is this block included or hidden?") are equally opaque.

This phase makes every existing control self-explanatory in one pass — no engine changes, no schema changes. While we're in there, we also kill leftover debug content ("Test Hardware Note" block).

## What I learned during exploration that changes the roadmap

Reading the actual code surfaced several things the investigation report mistakenly listed as missing. Recording them here so we can adjust later phases:

| Roadmap claim | Reality |
|---|---|
| "No section rendering — blocks flow as one numbered list" | **Wrong.** [letter-preview.tsx:158-303](apps/web/app/proposal-builder/_components/letter-preview.tsx) already renders distinct PRICING / ADDITIONS OR DEDUCTIONS / EXCLUSIONS / CLOSING / INSTALLATION sections. The reason these didn't show in my walkthrough is that the default template doesn't yet contain OPTION/EXCLUSION/INSTALLATION blocks. |
| "No itemized pricing table" | **Wrong.** Pricing table exists with Euro Windows / Double Hung / Euro Doors / BASE BID rows, and auto-hides zero rows. Showed `$0.00` only because the Gilchrist Avenue summary has zero totals. |
| "No add-on rows" | **Wrong.** Add-on rows (Magnetic Contacts, Final Finish, Window Screens, etc.) already render conditionally based on `pdfData.hasMagneticContacts`, etc. |
| "No installation appendix" | **Wrong.** Conditional INSTALLATION block already renders after a dashed page-break border. |
| "No AND/OR conditions" | **Wrong.** [condition-builder.tsx:87-98](apps/web/app/proposal-builder/_components/condition-builder.tsx) has AND/OR dropdown per row; [quote-conditions.ts:501-506](apps/web/lib/quote-conditions.ts) evaluates `(all ANDs pass) AND (at least one OR passes)`. |
| "evaluatePresetDecision is not surfaced" | **Partially right.** The function exists and already returns `{ included, reason, conditionResults }` — it just isn't shown to the admin. Phase 1 surfaces it. |
| "Warnings system not built" | **Wrong.** [letter-preview.tsx:313-322](apps/web/app/proposal-builder/_components/letter-preview.tsx) already renders an amber warnings banner under the paper. Reusable for missing-token lint in Phase 8. |

**Impact on later phases:**
- **Phase 4** (section rendering + page breaks) shrinks dramatically — most of it is already done. What remains: explicit page-break block, configurable section heading labels per template. Re-estimate Phase 4 as Small.
- **Phase 5** (pricing table block type) might be unnecessary as a new block kind — the renderer already does this. Re-evaluate whether the table should become editable per-template, or just stay hard-coded.
- **Phase 6** (conditional add-on rows) is also partly built — the renderer's `pdfData.hasMagneticContacts` checks already drive add-on row visibility. The remaining work is OPTION-section blocks for the *narrative* text that accompanies each add-on row (e.g. the "ADD: Magnetic Alarm Contacts. This system is used to detect…" paragraph).

I'll fold these adjustments into the roadmap after Phase 1 lands so we can talk about them with a more accurate baseline.

## Decisions baked into this plan

- **Help icon:** `lucide-react`'s `Info` icon at `w-3 h-3`, gray-400. Matches the existing icon style ([block-editor.tsx:3](apps/web/app/proposal-builder/_components/block-editor.tsx) already imports from `lucide-react`).
- **Tooltip mechanism:** native `title` attribute on the icon, paired with a small permanent hint paragraph for the most important concepts (Conditions, Driver Variable). Native tooltips keep this PR small and accessible; we can upgrade to a Radix Tooltip later if needed. **Not** introducing a tooltip library in this PR.
- **Inline hint style:** matches the existing pattern — `text-[10px] text-gray-400 mt-0.5` ([block-editor.tsx:128](apps/web/app/proposal-builder/_components/block-editor.tsx)).
- **"Test Hardware Note" removal:** soft-delete by setting `isActive=false` on the existing DB row — no schema or seed change. Reversible.

## Scope

### In scope

1. **Tooltip + inline hint on every editor control.** Section pills, Driver Variable, Always included, Active, Conditions.
2. **Smarter Conditions empty-state copy** (clarifies AND/OR + Always-included interaction with the actual engine semantics).
3. **"Why is this block included or hidden?" indicator** in the preview — surfaces the `reason` already produced by `evaluatePresetDecision`.
4. **Variable insertion hint** above the chip grid.
5. **Variant editor example** in the empty state.
6. **Soft-delete the "Test Hardware Note" debug block.**

### Out of scope (later phases or never)

- Any actual behavior change to conditions, variants, or rendering.
- Replacing native `title` tooltips with a tooltip library.
- Mobile responsiveness for the editor.
- Restructuring the editor layout.
- Backend changes.

## Files to modify

| File | Change |
|---|---|
| [apps/web/app/proposal-builder/_components/block-editor.tsx](apps/web/app/proposal-builder/_components/block-editor.tsx) | Add `Info` icon next to Section / Driver Variable / Always Included / Active labels, each with a `title=` tooltip. Expand the existing inline hint under Driver Variable. Add a one-line hint under "Always included" explaining its precedence over conditions. |
| [apps/web/app/proposal-builder/_components/condition-builder.tsx](apps/web/app/proposal-builder/_components/condition-builder.tsx) | Replace lines 80–82 (empty-state copy) with a fuller explanation: AND/OR semantics + Always-included precedence. Add an `Info` icon next to the "Conditions" label with a tooltip summarizing the rule. |
| [apps/web/app/proposal-builder/_components/variant-editor.tsx](apps/web/app/proposal-builder/_components/variant-editor.tsx) | Replace line 76 ("No variants. Add one…") with a more concrete example: *"No variants yet. Add one for each value of `{driverField}` — e.g., `28` for type-28 glass, with the spec text that applies in that case."* |
| [apps/web/app/proposal-builder/_components/variable-chips.tsx](apps/web/app/proposal-builder/_components/variable-chips.tsx) | Add a one-line hint above the chip grid: *"Click a chip to insert at cursor, or drag into the body."* (Verify both behaviors actually work; if drag doesn't, omit "or drag".) |
| [apps/web/app/proposal-builder/_components/letter-preview.tsx](apps/web/app/proposal-builder/_components/letter-preview.tsx) | Add a small `Info` icon in the top-right of each selected preview block's wrapper that shows the `evaluatePresetDecision` reason on hover. The decision is already computed in [proposal-assembly.ts:159](apps/web/lib/proposal-assembly.ts) — we just need to thread the result through to the preview. |
| [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) | Expose the per-block decision (reason + conditionResults) in the assembly result so the preview can show it. May already be there — confirm during implementation. |
| **Data fix** (no file change, runs once) | Soft-delete the "Test Hardware Note" block via `PATCH /spec-presets/:id` with `isActive=false`, OR via the UI's existing Delete button on that block. Pick whichever the existing API supports without DB access. |

## Concrete edits — sketches

These are pseudo-diff sketches to make the intent unambiguous. Real edits will use Edit/MultiEdit on existing file content.

### `block-editor.tsx` — Section label

```tsx
{/* Section pills */}
<div>
  <div className="flex items-center gap-1 mb-1.5">
    <label className="text-[10px] font-semibold text-gray-500">Section</label>
    <Info
      className="w-3 h-3 text-gray-400"
      title="Groups this block in the rendered PDF. SPECIFICATION blocks become the numbered list; OPTION blocks become 'ADDITIONS OR DEDUCTIONS'; EXCLUSION blocks become 'Our Base Bid does not include'; INSTALLATION blocks go to the installation appendix; CONSTANT blocks render without a number (intro and closing)."
    />
  </div>
  {/* …existing pills… */}
</div>
```

### `block-editor.tsx` — Driver Variable hint (expanded)

```tsx
<p className="text-[10px] text-gray-400 mt-0.5">
  {isVariantMode
    ? `Content varies by ${driverField} — define one variant per value below.`
    : 'A simple block has one Body Text. Set a Driver Variable to switch the body text based on a summary field (e.g., different wording for each Glass Type).'}
</p>
```

### `block-editor.tsx` — Always Included tooltip + hint

```tsx
<label className="flex items-center gap-1.5 cursor-pointer">
  <input type="checkbox" checked={alwaysIncluded} onChange={…} … />
  <span className="text-xs text-gray-700">Always included</span>
  <Info
    className="w-3 h-3 text-gray-400"
    title="When on, this block is always included regardless of conditions. When off, the block is included only if its conditions pass (all ANDs and at least one OR)."
  />
</label>
```

### `condition-builder.tsx` — Empty state + Conditions label tooltip

```tsx
<div className="flex items-center justify-between mb-2">
  <div className="flex items-center gap-1">
    <label className="text-xs font-semibold text-gray-600">Conditions</label>
    <Info
      className="w-3 h-3 text-gray-400"
      title="A block is included only when all AND conditions pass and (if any OR conditions exist) at least one OR passes. 'Always included' overrides this entirely."
    />
  </div>
  <button …>+ Add Condition</button>
</div>

{conditions.length === 0 ? (
  <p className="text-xs text-gray-400 italic leading-relaxed">
    No conditions yet. Without conditions, this block is excluded unless <span className="font-semibold">Always included</span> is on.
    Add a condition like <span className="font-mono text-gray-500">hasDoors IS_TRUE</span> to include this block only when the summary has doors.
  </p>
) : ( … )}
```

### `letter-preview.tsx` — Per-block "why" indicator

The simplest version: when a block is selected, show a small `Info` icon in the top-right with the decision's `reason` as a tooltip:

```tsx
const blockWrap = (id: string, children: React.ReactNode) => {
  const isSelected = id === selectedPresetId;
  const decision = decisionById.get(id); // threaded in from props

  return (
    <div onClick={() => onSelectBlock(id)} className={…}>
      {children}
      {isSelected && decision && (
        <Info
          className="absolute top-1 right-1 w-3 h-3 text-gray-400"
          title={`Included: ${decision.included}. ${decision.reason}`}
        />
      )}
    </div>
  );
};
```

Thread the decisions through from `assembleProposal` — already computed inline at [proposal-assembly.ts:159](apps/web/lib/proposal-assembly.ts), just include them in the result object.

### Data fix — soft-delete "Test Hardware Note"

Two options, pick whichever is simpler at the time:
1. In the deployed UI, select the "Test Hardware Note" block and click the Delete button in the editor header. This calls the existing `DELETE /spec-presets/:id` route.
2. If we'd rather keep the row for history: `PATCH /spec-presets/:id` with `{ isActive: false }`. Block disappears from the rendered preview; row remains.

Either way: **manual, one-off action against prod**, not code. Verify by reloading the builder and confirming block #20 is gone from the BLOCKS list and the preview.

## Verification

In a local dev session pointed at a non-prod DB (or against the deployed app for the data fix only):

1. Open `/proposal-builder` → hover the `Info` icon next to every control (Section, Driver Variable, Always Included, Active, Conditions). Each shows a tooltip with a one-sentence plain-English explanation.
2. Open a block with no conditions and Always Included off → see the new conditions empty-state copy with the example.
3. Open a block with conditions → no empty state copy shown; UI unchanged.
4. Open the Variant editor with zero variants → see the new example copy mentioning `{driverField}`.
5. Hover the Variables chip grid → see the new insertion hint.
6. Select a block in the preview → see a small `Info` icon top-right; hover → see the decision reason (e.g. *"Included: false. Conditions failed: hasNonImpact = false."* or whatever the engine reports).
7. Toggle "Always included" on a previously-excluded block → preview updates AND the indicator reason updates to "Always included presets bypass conditions."
8. After the data fix: block #20 "Test Hardware Note" is gone from the BLOCKS list and the preview.
9. `pnpm --filter web typecheck` and `pnpm --filter web lint` clean (no new errors in the files we touched).
10. No Jest tests added (no testable logic added — only copy and prop wiring).

## Risk + rollback

- **Risk: low.** Pure UI copy + prop threading; no engine changes, no schema, no API.
- **Bundle impact:** zero (Lucide `Info` icon already used elsewhere in this app).
- **Rollback:** revert the single PR. The data fix (deleting/deactivating "Test Hardware Note") is independently reversible by toggling the block back to `isActive=true` if it's a soft-delete, or by recreating it via the UI if it's a hard delete.

## Open questions to confirm during implementation

- **Does drag-to-insert work for variable chips?** If yes, hint mentions both click and drag. If not, hint only mentions click. (Test by attempting a drag in the live builder.)
- **Is the decision-per-block already on the assembly result?** Likely yes (per the warnings + included flag pattern), but worth checking before threading it through.
- **Variant empty state — should the example use the actual `driverField` name (e.g. "glassType") or a generic one?** I lean toward the actual name (it's already in scope), which makes the hint feel custom.

## Branch + PR

- Branch: `claude/proposal-builder-phase-1-inline-help`
- PR title: `feat: inline help and copy clarifications for proposal builder editor`
- PR body: lists the six scope items + the screenshot showing tooltips visible.

## After this lands

Two follow-ups will get scheduled before Phase 2:
1. **Update the roadmap** with the "what's already built" findings above. The biggest revision: Phases 4 / 5 / 6 partially exist; we should re-scope them before drilling in.
2. **Re-confirm Phase 2 (schema-driven token sources) is still the right next step** vs. jumping straight to Phase 3 (rich text). Phase 2 still feels right because the user explicitly asked for Project / Quote / Products as token sources — but worth double-checking with you once you can read the controls.
