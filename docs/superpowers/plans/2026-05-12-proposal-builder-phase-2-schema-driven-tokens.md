# Proposal Builder — Phase 2: Schema-Driven Token Sources

**Date:** 2026-05-12
**Roadmap:** [docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md](docs/superpowers/plans/2026-05-12-proposal-builder-roadmap.md) — Phase 2 of 8.
**Predecessor:** [docs/superpowers/plans/2026-05-12-proposal-builder-phase-1-inline-help.md](docs/superpowers/plans/2026-05-12-proposal-builder-phase-1-inline-help.md) (merged in PR #121).
**Status:** Plan, awaiting approval.

## Context

The user's stated need: *"easily create new sections of the PDF, linking it to fields from the summary, opportunity, project, quote, products objects."* Today the New Token modal hand-curates 19 field names and the runtime resolver completely ignores `TokenMapping` rows — so any token created via the modal is decorative only. This phase makes the modal honest and the resolver dynamic.

## What I learned during exploration that changes the roadmap

The roadmap (and the Phase 1 plan's "follow-ups") understated this phase. Three concrete corrections:

1. **The resolver is fully hardcoded.** [`buildTokenMap` in quote-placeholders.ts](apps/web/lib/quote-placeholders.ts) constructs a static `Record<string, string>` from `summary` + `contact`. `TokenMapping` rows are never read at resolution time. **A token created in today's modal does nothing** — the chip appears, but `{{theToken}}` in a body resolves to itself. This is effectively a UX bug we'll fix in this phase.

2. **There is no Prisma `Opportunity` / `Project` / `Quote` / `Account` / `Contact` model.** All of those are `CustomObject` rows; their data lives in `Record.data` (JSON) filtered by `objectId`. [`ensure-core-objects.ts`](apps/api/src/ensure-core-objects.ts) seeds the schemas at startup, including `Opportunity` (lines 89–103), `Project` (lines 105–119, with an `opportunity` Lookup field), and `Quote` (lines 134–145).

3. **`Quote` has no built-in linkage to Opportunity or Summary.** Its core fields are `quoteNumber`, `quoteName`, `totalAmount`, `validUntil`, `status` — no Lookup back. So "Quote as a token source" is not viable without adding a relationship, which is custom-object schema territory and out of scope for the proposal builder.

4. **Products = `ProductLog` rows** (Prisma model), linked by `summaryId` and optionally `linkedOpportunityId`. Multi-row by nature (one log per product type per summary). Aggregation strategy matters; can't just resolve `products.qty` as a scalar.

## Decisions baked into this plan

| Question | Decision | Why |
|---|---|---|
| Built-in vs custom tokens | Built-in tokens (`contactName`, `projectName`, etc.) keep their hardcoded resolution. Custom tokens resolve via `TokenMapping` rows. | Zero regression risk. Built-ins are battle-tested. New mechanism only powers genuinely new tokens. |
| Async vs pre-fetched | Pre-fetch the needed CustomObject `Record`s once at the page level; pass them into `buildTokenMap` synchronously. | Keeps `buildTokenMap` sync (pure function). Pre-fetch is one extra round trip per page load, not per token. |
| Quote as a source | **Defer.** Surface "Quote" in the Source Object dropdown with a tooltip explaining it needs a relationship to Opportunity before it works. Don't break anything. | The user asked for it, but with no linkage it has nothing to resolve to. Adding one is custom-object work, not builder work. |
| Products as a source | **Defer to Phase 2b.** Multi-row aggregation deserves its own design (which product? which category?). Phase 2 ships scalar resolution only. | Avoids dragging Phase 2 over the line. Phase 2b is a focused next PR. |
| Field dropdown source | Drive Source Field dropdown from `GET /objects/:apiName/fields` (already exists at [apps/api/src/routes/fields.ts](apps/api/src/routes/fields.ts)). | No new API. |
| Existing hand-curated list | Replaced entirely for SUMMARY / OPPORTUNITY / PROJECT / CONTACT / ACCOUNT. Built-in token list is reproducible separately. | Single source of truth. |

## Scope

### In scope

1. **Dynamic resolver bridge.** `buildTokenMap` (or a sibling) reads `TokenMapping` rows for the active template. For any mapping whose `tokenName` isn't already produced by the hardcoded path, resolve it from the mapped source.
2. **Schema-driven Source Field dropdown.** Modal queries `GET /objects/:apiName/fields` based on Source Object. Falls back gracefully if the call fails.
3. **`PROJECT` as a Source Object.** Wired through pre-fetch of the linked Project record, resolved by `Record.data[sourcePath]`.
4. **`OPPORTUNITY` made real.** Currently in the enum but does nothing; now it actually resolves arbitrary Opportunity fields.
5. **`QUOTE` listed but disabled.** Shows in dropdown with a "Not connected to summaries — requires relationship setup" tooltip; no submit until a path exists.
6. **Token preview in the modal.** When Source Object + Field are chosen and the active summary is known, show the resolved value below the dropdown (e.g. *"Preview: 'Sipo'"*).
7. **Lint warning on save** if a body has a `{{token}}` that doesn't resolve against the current summary. Reuses the existing amber warnings banner under the preview ([letter-preview.tsx:313](apps/web/app/proposal-builder/_components/letter-preview.tsx)).

### Out of scope (deferred to Phase 2b)

- `PRODUCTS` as a Source Object — multi-row aggregation design.
- Repeater blocks (one block per product type with its own quantity/room).
- Migrating the current hand-curated Summary/Contact/Account field list to a dynamic one — those work fine today and aren't user-visible pain points.

### Hard out of scope

- Schema changes (no new Prisma models, no migration). [CLAUDE.md says schema is read-only by default](CLAUDE.md), and we don't need any.
- Repeater UI for arrays.
- Caching layer. Pre-fetch is per page load; if performance becomes an issue, add caching later.

## Files to modify

| File | Change |
|---|---|
| [packages/db/prisma/schema.prisma:933](packages/db/prisma/schema.prisma) | **Read-only check.** Confirm `TokenSourceObject` enum already includes `OPPORTUNITY`. Add `PROJECT` and `QUOTE` only if they aren't there. **Schema rule:** surface this change for approval before running `prisma migrate dev`. |
| [apps/api/src/routes/token-mappings.ts](apps/api/src/routes/token-mappings.ts) | Extend the Zod validator's `sourceObject` enum to match the Prisma enum. No behavior change. |
| [apps/web/lib/quote-placeholders.ts](apps/web/lib/quote-placeholders.ts) | Add a new `resolveCustomTokens(args)` function that takes the active tokenMappings + pre-fetched Record data and returns a `Record<string, string>` of *additional* tokens beyond the hardcoded ones. Existing `buildTokenMap` stays as-is. |
| [apps/web/lib/proposal-assembly.ts](apps/web/lib/proposal-assembly.ts) | Accept `tokenMappings`, `opportunityRecord`, `projectRecord` as inputs. Merge `resolveCustomTokens(...)` output into the token map. |
| [apps/web/app/proposal-builder/page.tsx](apps/web/app/proposal-builder/page.tsx) | Pre-fetch the linked Opportunity and Project `Record`s for the active summary (via `linkedOpportunityId` and the Project→Opportunity Lookup). Pass into `assembleProposal`. |
| [apps/web/app/proposal-builder/_components/new-token-modal.tsx](apps/web/app/proposal-builder/_components/new-token-modal.tsx) | Source Object: add `PROJECT` and `QUOTE` (last is disabled). Source Field: replace hardcoded list with a `useEffect` that fetches `GET /objects/:apiName/fields` for the selected source. Add a live preview row below the form. |
| **No file change** — confirm pattern | Modal POSTs to `/token-mappings` already; no API change needed. |

## Implementation sketches

### Resolver bridge

```ts
// apps/web/lib/quote-placeholders.ts
export interface CustomTokenResolverArgs {
  tokenMappings: TokenMappingData[];
  builtInKeys: Set<string>;             // tokenNames produced by buildTokenMap
  summary: SummaryForPlaceholders;
  contact?: ContactData;
  opportunity?: RecordData;             // pre-fetched Opportunity record's data
  project?: RecordData;                 // pre-fetched Project record's data
}

export function resolveCustomTokens(args: CustomTokenResolverArgs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of args.tokenMappings) {
    if (m.isBuiltIn || args.builtInKeys.has(m.tokenName)) continue;
    const raw = readSource(m.sourceObject, m.sourcePath, args);
    if (raw === undefined || raw === null) continue;
    out[m.tokenName] = formatValue(String(raw), m.format);
  }
  return out;
}

function readSource(sourceObject: string, path: string, args: CustomTokenResolverArgs): unknown {
  switch (sourceObject) {
    case 'SUMMARY':     return (args.summary as any)[path];
    case 'CONTACT':     return args.contact ? (args.contact as any)[path] : undefined;
    case 'OPPORTUNITY': return args.opportunity?.[path];
    case 'PROJECT':     return args.project?.[path];
    case 'ACCOUNT':     return undefined; // hardcoded path covers this today
    case 'SYSTEM':      return undefined; // hardcoded path covers this today
    default:            return undefined;
  }
}
```

### Pre-fetch in `page.tsx`

```ts
const linkedOpportunityId = selectedSummary?.linkedOpportunityId;

const { data: opportunityRecord } = useQuery({
  enabled: !!linkedOpportunityId,
  queryKey: ['opportunity-record', linkedOpportunityId],
  queryFn: () => apiClient.get(`/records/${linkedOpportunityId}`).then(r => r.data),
});

// Project linked TO the Opportunity (one-to-many; pick the most recently updated):
const { data: projectRecord } = useQuery({
  enabled: !!linkedOpportunityId,
  queryKey: ['project-for-opportunity', linkedOpportunityId],
  queryFn: () => apiClient.get(`/records`, { params: {
    objectApi: 'Project',
    filter: `data.opportunity=${linkedOpportunityId}`,
    limit: 1,
    sort: '-updatedAt',
  }}).then(r => r.data[0]),
});
```

**Confirm during exploration:** the actual records-list API shape. Filter syntax may differ.

### Modal — Source Field schema-driven

```tsx
const [fieldOptions, setFieldOptions] = useState<{ apiName: string; label: string }[]>([]);

useEffect(() => {
  if (!sourceObject || sourceObject === 'SYSTEM' || sourceObject === 'QUOTE') {
    setFieldOptions([]);
    return;
  }
  apiClient.get(`/objects/${sourceObject}/fields`)
    .then(res => setFieldOptions(res.data))
    .catch(() => setFieldOptions([])); // graceful fallback
}, [sourceObject]);
```

### Token preview row

```tsx
{sourceObject && sourcePath && (
  <div className="text-[11px] text-gray-500 mt-1">
    Preview against <span className="font-mono">{activeSummary?.name}</span>:{' '}
    <span className="font-mono text-gray-800">
      {resolvePreview(sourceObject, sourcePath, activeSummary, opportunity, project) ?? '—'}
    </span>
  </div>
)}
```

## Verification

1. Create a new token: Source Object = `OPPORTUNITY`, Source Field = `stage`, Token Name = `oppStage`. Insert `{{oppStage}}` into an existing block's body. Reload preview against a summary whose linked Opportunity has `stage="Proposal"` → preview shows `Proposal`.
2. Same flow with `PROJECT` + `status` → preview shows the project status.
3. Open the modal → select `QUOTE` → field dropdown is disabled with tooltip *"Quote isn't yet linked to summaries."*; Submit is disabled.
4. Existing built-in tokens (`{{contactName}}`, `{{projectName}}`, etc.) still resolve unchanged.
5. Create a token with `Source Object=SUMMARY, Field=jobType, tokenName=jobType2`. `{{jobType2}}` resolves to the same value as `{{jobType}}` (proves dynamic path works for SUMMARY too).
6. Type `{{nonexistent}}` into a body → save → an amber warnings banner appears under the preview noting the unresolved token.
7. `pnpm --filter web typecheck` and `pnpm --filter web lint` clean for files I touched.
8. New Jest test in `apps/web/lib/__tests__/quote-placeholders.test.ts` covers `resolveCustomTokens` for each source type, including missing-source fallback to undefined.

## Risk + rollback

- **Risk: medium.** Pre-fetching new data + new resolver path. Tightly bounded by the "built-in tokens unchanged" decision.
- **Schema:** none expected. If `PROJECT`/`QUOTE` need to be added to the enum, **stop and ask** — that's a schema change requiring approval.
- **Rollback:** revert the PR. Built-in tokens continue to work as before. Custom token rows in the DB go back to being decorative (no regression in current behavior).
- **N+1 query risk:** pre-fetching one Opportunity + one Project per page load. Constant, not N+1. Safe.

## Open questions to resolve during exploration

- **`/records` filter syntax** — confirm the actual query-param shape (`?objectApi=Project&data.opportunity=...`?). May need to use a POST search endpoint instead.
- **Is `TokenSourceObject` enum already extended with `PROJECT`?** If not, schema change requires approval. (Read schema, confirm.)
- **Does the existing `Project` core object actually have records in this deployment?** If not, the verification step for PROJECT won't pass without seeding test data first.
- **Multi-Project per Opportunity** — what if there's more than one? Plan picks "most recently updated." Confirm that's acceptable, or surface a picker.

## Branch + PR

- Branch: `claude/proposal-builder-phase-2-schema-driven-tokens` (already created from `main`).
- PR title: `feat: proposal builder phase 2 — schema-driven token sources (Opportunity, Project)`
- PR body: lists scope items, calls out that Quote is listed-but-disabled and Products is deferred to Phase 2b, includes the roadmap correction notes.

## After this lands

- **Update the roadmap** with the Phase 1+2 corrections.
- **Phase 2b (next PR):** Products as a Source Object with aggregation (start with category-level totals: `products.eurosWindows.totalQty`, etc.).
- **Phase 3 (rich text):** unchanged from the roadmap. Still the biggest remaining phase.
