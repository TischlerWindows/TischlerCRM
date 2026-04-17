# Settings & Object Manager Navigation / UX Overhaul

**Date:** 2026-04-17
**Status:** Design — awaiting review
**Scope:** Navigation between main CRM ↔ Settings ↔ Object Manager, Settings information architecture, Settings landing page, Setup search, and a visual polish baseline.

## Problem

Settings feels "sticky and slow" — especially getting out of Object Manager. Concretely:

1. `/object-manager/[objectApi]/*` pages show only a "Back to Object Manager" link. No Tischler logo, no link to Settings, no link home. Exiting to the main CRM from a detail page requires: Back to Object Manager (1) → Tischler logo (2). Exiting to Settings requires: back (1) → logo (2) → Cog (3) → Settings (4).
2. The Settings breadcrumb starts at "Settings" — there is no clickable path back to the main CRM.
3. The Settings sidebar groups are inconsistent: a "Settings" group lives inside the Settings page; Automations and Notifications are filed under "Integrations"; Object Manager floats outside any group.
4. `/settings` is a flat grid of ~11 cards with no visual grouping, no recently-used shortcut, and no way to pin frequent destinations. Object Manager isn't on it at all.
5. The sidebar search only filters visible sidebar items. It does not surface objects, object sub-sections, users, or profiles.
6. Visual treatment drifts across Settings subpages — inconsistent page headers, card styles, spacing, button hierarchy, empty states, and loading states.

## Goals

- From any Setup or Object Manager page, the main CRM is always exactly 1 click away, and the Settings hub is always 1 click away.
- Settings sidebar groupings reflect mental model, not accidental history.
- The Settings landing page makes the 2–3 destinations a user returns to most reachable in one click.
- A sidebar typeahead search gets a user to any deep setting (object field, user, profile) without memorizing where it lives.
- All Settings subpages share a single visual rhythm (headers, cards, spacing, states) that the `impeccable` polish pass can amplify.

## Non-Goals

- No change to Object Manager's distinct visual identity (its own left sidebar inside `/object-manager/[objectApi]`). Object Manager remains a separate visual workspace.
- No new global chrome (no utility rail, no new top-level tab). The existing global header (`app-wrapper.tsx`) is unchanged.
- No redesign of the Page Editor (`/object-manager/[objectApi]/page-editor/[layoutId]`). Its toolbar stays as-is.
- No changes to brand palette (navy `#151f6d`, red `#da291c`), font stack, or logo.

## Design

### 1. Navigation & exit paths

**Settings pages (`/settings/*`)**

- Keep the global header (`app-wrapper.tsx`'s navy bar) visible as today.
- `SettingsBreadcrumb` becomes clickable end-to-end, rooted at the main CRM:
  `Tischler CRM › Setup › <group> › <page>` — every segment except the last is a `Link`.
- `SettingsSidebar` gets an **"Exit Setup"** pill at the bottom (above the sidebar's scroll area footer). It links to the stored "came from" path (set on entry into `/settings/*` or `/object-manager/*`), falling back to `/`.

**Object Manager index (`/object-manager`)**

- Existing top bar keeps the Tischler logo (→ `/`) and "Object Manager" title.
- Add a **"Setup"** link (→ `/settings`) between the logo area and the title, styled as a breadcrumb crumb.
- Add an **"Exit Setup"** pill on the right (mirrors the sidebar pill).

**Object Manager detail pages (`/object-manager/[objectApi]`)**

- Replace the sidebar's navy header (currently a single "Back to Object Manager" link) with a full top-bar pattern matching the index:
  ```
  [T logo] Tischler CRM  |  Setup  ›  Object Manager  ›  <object label>     [Exit Setup]
  ```
- Logo → `/`. "Setup" → `/settings`. "Object Manager" → `/object-manager`. Current object label is non-link, bold.
- The internal sidebar below this bar (Data Model / Layouts & UI / Automation / Security & Access groups) is unchanged.
- Honor `?returnTo=` param on Exit Setup when present (used when Page Editor deep-links from a record page).

**"Came from" tracking**

- A small module (`lib/setup-return-to.ts`) stores `tischler-setup-came-from` in `sessionStorage` whenever the user navigates *into* a Setup path from a non-Setup path. Cleared when they exit.
- `Exit Setup` reads this value, falls back to `/` if absent.

### 2. Settings sidebar IA

Replace the current three groups with seven, plus the pinned Object Manager button.

**Structure (top to bottom):**

- **Object Manager** — prominent button at top (same visual treatment as today: briefcase icon, elevated card-like block, hover/active states).
- Sidebar search input (Section 4).
- **Company** — Company Settings, Departments, Security, Privacy Center *(disabled)*
- **Users & Access** — Users, Profiles
- **Data Model** — Backups, Recycle Bin, Data *(disabled)*
- **Automation** — Automations, Notifications, Widgets
- **Connections** — Connected Apps, Offline *(disabled)*
- **Monitoring** — Audit Log, Error Log
- Footer: **Exit Setup** pill.

**Behaviour:**

- Active-item indicator unchanged (purple bg `#ede9f5` + red left inset bar `#da291c`).
- Disabled items remain rendered with "Coming soon" treatment (40% opacity, no link).
- Collapse/expand button and persisted `tischler-settings-sidebar-collapsed` behaviour unchanged.

### 3. Settings landing page (`/settings`)

**Layout, top to bottom:**

1. **Overview header** — unchanged card with gear icon, title "Settings Overview", tagline.
2. **Object Manager hero card** — full-width card directly below the overview, distinct visual weight (larger icon, slightly tinted background using brand-navy at 6% alpha, right-arrow CTA). Single click to `/object-manager`.
3. **Recently Visited strip** — horizontal row of up to 4 compact cards (icon + title + relative timestamp). Hidden when the recent list is empty. Overflows horizontally with no visible scrollbar.
4. **Pinned strip** — same layout as Recently Visited. Hidden when empty; shows a muted hint row "Pin any setting to keep it here" only if the user has visited Settings before (i.e. recent list is non-empty) but never pinned.
5. **All Settings** — grouped card grid. Group headings match sidebar IA (Company, Users & Access, Data Model, Automation, Connections, Monitoring). Cards use the existing pattern (icon tile, title, description, optional count badge, hover "Open →" affordance).

**Card interactions:**

- Each card gets a pin icon on hover (top-right corner). Clicking toggles pinned state.
- Clicking anywhere else on the card navigates to the setting.
- Pinned cards in the Pinned strip get an "Unpin" icon in the same slot.

**Persistence:**

- `localStorage['tischler-setup-recent']` — array of `{ href, title, icon, visitedAt }`. Capped at 8 entries internally; displays up to 4. Deduped by href (most-recent wins). Written by a `useEffect` in the Settings layout that triggers on any `/settings/*` or `/object-manager/*` navigation.
- `localStorage['tischler-setup-pinned']` — array of `{ href, title, icon }`. Unlimited; visually wraps after 4.
- Icons stored as string keys mapping to lucide-react icons via a shared registry (`lib/setup-icon-registry.ts`), so we don't serialize component references.

**Empty states:**

- No recent → section hidden entirely (no placeholder).
- No pinned, recent present → muted hint row only.
- No recent, no pinned (first visit) → both sections hidden.

### 4. Setup search (typeahead)

The existing `<input type="search">` in the Settings sidebar becomes a typeahead.

**What it indexes:**

1. Sidebar items (static list in `settings-sidebar.tsx`).
2. Object Manager objects — one entry per object from `useSchemaStore` → `/object-manager/<apiName>`.
3. Object Manager sub-sections — for each object, one entry per section in `SIDEBAR_SECTIONS` (`object-manager/[objectApi]/page.tsx`) → `/object-manager/<apiName>?section=<id>`.
4. Users — by name and email → `/settings/users/<id>`.
5. Profiles — by name → `/settings/profiles/<id>`.

**UI:**

- Dropdown opens below the input when query length ≥ 1.
- Grouped by category: **Pages**, **Objects**, **Users**, **Profiles**.
- Row: 18px icon + primary label + muted secondary context (e.g. "Object Manager › Account" for a sub-section, "mickoolb86@gmail.com" for a user).
- Max 5 results per group. Footer "Show all N in <group>" opens the relevant list page with a query pre-filled when supported.
- Keyboard: ↑/↓ cycles results, Enter opens, Esc closes and clears.
- Click outside closes without clearing (so the user can refocus).

**Data loading:**

- Sidebar items + objects + sub-sections: synchronous, already in memory.
- Users + profiles: lazy-fetched via `apiClient.get('/admin/users')` and `apiClient.get('/profiles')` on first dropdown open per session. Cached in component state for the remainder of the session.
- No per-keystroke API calls; all filtering is client-side on the cached lists.

**Graceful degradation:**

- If users/profiles fetch fails, dropdown shows sidebar + object results only; groups with no data are hidden.
- First-keystroke matching falls back to the current sidebar-filter behaviour until remote data arrives (so typing is never blocked).

### 5. Object Manager nav fixes

Covered partially by Section 1. Additional points:

- **Deep-link support from typeahead:** when search result `Account › Fields` is clicked, navigate to `/object-manager/Account?section=fields`. The existing `useSearchParams()` reader in `object-manager/[objectApi]/page.tsx` already handles `section` — no change needed there.
- **Consistent breadcrumb format:** when inside `?section=fields`, the top-bar breadcrumb reads `Tischler CRM | Setup › Object Manager › Account › Fields`. The final "Fields" segment is derived from `activeSection`.
- **Page Editor route** (`/object-manager/[objectApi]/page-editor/[layoutId]`) is out of scope for the top-bar change — its editor toolbar is unchanged. But its back button already honors `?returnTo`, which is preserved.

### 6. Visual polish baseline

A consistency audit across all `/settings/*` pages. No new components; reuse existing.

**Standardize:**

1. **Page header** — every subpage renders `<SettingsPageHeader icon={Icon} title="..." subtitle="..." action={...} />`. Audit each page; convert custom headers. Padding: `pt-8 pb-6`.
2. **Content cards** — wrap main content in `<SettingsContentCard>` (white, `rounded-xl`, `border-gray-200`, `p-6`). Replace any `rounded-2xl`, borderless, or inline-styled containers.
3. **Spacing scale** — use 8/16/24/32 only. Grep for `py-3.5`, `mt-7`, `gap-7`, etc. and normalize.
4. **Button hierarchy** — one primary (brand-navy) per page header; secondary is outline; tertiary is ghost. Audit for duplicate primaries.
5. **Empty states** — unify pattern: centered icon (48px, muted), title (text-lg font-semibold), description (text-sm text-brand-gray), optional primary action.
6. **Loading states** — spinner or skeleton consistent with existing table pattern. No ad-hoc "Loading..." text.
7. **Typography** — title (text-2xl font-bold text-brand-dark), subtitle (text-sm text-brand-gray), section heading (text-sm font-semibold text-brand-dark), body (text-sm text-brand-dark/80).
8. **Focus rings** — audit inputs and buttons for `focus:ring-2 focus:ring-brand-navy/30` consistency.

**Preserved:**

- Brand colors, font stack, logo.
- Object Manager's distinct layout (its own left sidebar inside object detail pages).

**To be added by `impeccable` during implementation:**

- Hover / transition motion on cards.
- Page-enter fade on `/settings/*` route changes.
- Micro-interactions on pin / unpin.
- "Feels fast" optimism on navigation (prefetch on hover for sidebar links).

## Architecture

### New modules

- `lib/setup-return-to.ts` — `rememberCameFrom(path)`, `readCameFrom(): string | null`, `clearCameFrom()`. Wraps `sessionStorage`.
- `lib/setup-history.ts` — `trackVisit({ href, title, icon })`, `getRecent(limit)`, `togglePin({ href, title, icon })`, `getPinned()`, `isPinned(href)`. Wraps `localStorage`, uses icon-registry keys.
- `lib/use-setup-history-tracking.ts` — React hook that reads `pathname`, resolves a title + icon from the route, and calls `setup-history.trackVisit`. Mounted from the Settings layout (for `/settings/*`) and from the two Object Manager page components (`/object-manager` and `/object-manager/[objectApi]`) since Object Manager has no shared layout wrapper.
- `lib/setup-icon-registry.ts` — map of `string → LucideIcon` for icons stored in localStorage.
- `lib/setup-search-index.ts` — builds a flat searchable index from schema + sidebar items; exports `searchIndex(query, { includeUsers, includeProfiles })`.

### New components

- `components/settings/setup-breadcrumb.tsx` — extended breadcrumb rooted at "Tischler CRM". Replaces the current `settings-breadcrumb.tsx` (keeps same file path; component renamed internally).
- `components/settings/exit-setup-pill.tsx` — shared pill used by sidebar and Object Manager top bars.
- `components/settings/object-manager-hero-card.tsx` — landing page hero card.
- `components/settings/setup-recent-strip.tsx` — recently-visited row.
- `components/settings/setup-pinned-strip.tsx` — pinned row.
- `components/settings/setup-search-typeahead.tsx` — dropdown typeahead for the sidebar search.
- `components/object-manager/object-manager-top-bar.tsx` — shared top bar used by both `/object-manager` and `/object-manager/[objectApi]`. Replaces the two inline headers in those pages.

### Modified files

- `apps/web/app/settings/layout.tsx` — mount `useSetupHistoryTracking` for `/settings/*` visits.
- `apps/web/app/object-manager/page.tsx` and `apps/web/app/object-manager/[objectApi]/page.tsx` — mount `useSetupHistoryTracking` for Object Manager visits.
- `apps/web/components/settings/settings-sidebar.tsx` — new group structure, integrate `SetupSearchTypeahead`, add `ExitSetupPill` at bottom.
- `apps/web/components/settings/settings-breadcrumb.tsx` → becomes `setup-breadcrumb.tsx`, clickable all the way up.
- `apps/web/app/settings/page.tsx` — insert hero card, Recent, Pinned strips above grouped cards; regroup cards.
- `apps/web/app/object-manager/page.tsx` — replace inline header with `ObjectManagerTopBar`.
- `apps/web/app/object-manager/[objectApi]/page.tsx` — replace sidebar's navy header with `ObjectManagerTopBar`.
- All `apps/web/app/settings/*/page.tsx` — swap headers to `SettingsPageHeader`, wrap content in `SettingsContentCard` where not already, fix empty/loading/button hierarchy.

### Data flow

```
User navigates to /settings/users
  → SettingsLayout useEffect fires
  → setup-history.trackVisit({ href, title, icon })
  → writes to localStorage['tischler-setup-recent']
  → next /settings visit reads this to render Recent strip

User types "account fi" into sidebar search
  → typeahead reads in-memory searchIndex (sidebar + objects + sub-sections)
  → on first open, lazy-fetches users + profiles, caches
  → dropdown renders grouped matches
  → Enter navigates to /object-manager/Account?section=fields

User clicks "Exit Setup" from /object-manager/Contact
  → ExitSetupPill reads setup-return-to.readCameFrom()
  → router.push(value ?? '/')
```

## Testing

- **Unit:**
  - `setup-history` — track, dedup, cap, toggle pin, isPinned.
  - `setup-return-to` — store on entry to `/settings/*` or `/object-manager/*`, not on lateral moves.
  - `setup-search-index` — matches across sidebar/objects/sections/users/profiles; grouped output.
- **Component (React Testing Library):**
  - `SetupSearchTypeahead` — keyboard nav, grouped rendering, lazy user-fetch, graceful degradation when fetch fails.
  - `SetupRecentStrip` — hidden when empty, renders up to 4, click navigates, timestamp formats.
  - `SetupPinnedStrip` — toggle flow from a settings card.
  - `ObjectManagerTopBar` — renders correct crumb set for index vs detail; exit pill honors `returnTo` and `came-from`.
- **Integration / manual UX test matrix:**
  - From `/properties` → cog → Settings → Users → Profiles → Exit Setup lands back on `/properties` (not `/`).
  - From `/object-manager/Account` → Tischler logo → `/`. From same page → Setup link → `/settings`. From same page → Exit Setup → `/properties` (the came-from).
  - Typeahead search from sidebar: type `"valid"` finds Validation Rules for every object; type a user email finds the user; type `"record"` finds Record Types.
  - Recent strip populates after visiting 3 pages; pinned strip populates after pinning one; both survive reload.
  - Keyboard: typeahead dropdown ↑/↓/Enter/Esc works; focus rings visible on all Settings inputs.

## Open questions

None after Sections 1–6 approval. Remaining tradeoffs handled in the implementation plan.

## References

- Current settings sidebar: `apps/web/components/settings/settings-sidebar.tsx`
- Current settings layout: `apps/web/app/settings/layout.tsx`
- Current breadcrumb: `apps/web/components/settings/settings-breadcrumb.tsx`
- Settings landing: `apps/web/app/settings/page.tsx`
- Object Manager index: `apps/web/app/object-manager/page.tsx`
- Object Manager detail: `apps/web/app/object-manager/[objectApi]/page.tsx`
- Global header: `apps/web/app/app-wrapper.tsx`
