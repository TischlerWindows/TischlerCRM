# Ticket Category Admin UI + Submit Picklist + Scroll Fix

## Context

Phase 1 shipped support tickets with an admin-only category triage flow. After using it, two gaps surfaced:

1. **The comment composer on the admin detail page isn't reachable.** It's rendered by `ticket-detail-panel.tsx` below the Activity section, but `/support/tickets/<id>` isn't in the `allowPageScroll` whitelist in [app-wrapper.tsx](apps/web/app/app-wrapper.tsx), so the content container gets `overflow-hidden` and the composer is clipped below the viewport. The Phase 2 `/notifications` page has the same bug for the same reason.
2. **The submitter has no say in categorization.** They have to wait for an admin to triage before the ticket is meaningful. We also want categories to be admin-managed instead of hard-coded in a Postgres enum, so non-technical admins can rename/reorder/add/remove categories without a code change or migration.

This PR ships all three changes together — they're related small-to-medium pieces of the same UX pass.

## Scope

**In:** scroll-whitelist fix, `TicketCategory` enum → text-with-admin-list migration, `Setting`-backed category list, `/settings/support-tickets` admin CRUD page, required category picklist on ticket submit, list endpoint readable by all submitters, idempotent seed of default categories on API boot.

**Out:** admin-managed priorities or statuses (still hard-coded enums), icon pickers or descriptions on categories, per-category permissions, auto-migrating existing `CRM_ISSUE` rows (user will re-categorize manually), category archiving (delete is permanent, warn-and-allow pattern).

## Key decisions (resolved)

- **Storage:** single `Setting` row keyed `supportTickets.categories` holding a JSON array. No new Prisma model — the `Setting` table already exists and is the natural fit for org-scoped config.
- **Ticket `category` field:** plain `TEXT` column. `TicketCategory` Postgres enum is dropped. Existing row values (including `CRM_ISSUE`) are preserved verbatim as strings.
- **Orphan handling:** when an admin deletes a category that's still referenced by tickets, show a confirmation with "N tickets still use this" and allow the delete. Orphaned values stay on the tickets and render with a greyed "deleted" badge in the triage dropdown. No auto-migration on delete.
- **Submit flow:** category is **required** on `POST /tickets`. Frontend modal enforces it; API validates against the active categories list.
- **Category shape:** `{ key, label, color, order }`. No description or icon — YAGNI per the brainstorm.
- **Priorities/statuses:** remain hardcoded enums in this PR.
- **Bundled PR:** scroll fix + admin UI + picklist ship together (user preference).

## Data model

### Schema change — [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma)

Drop the `TicketCategory` enum; change `SupportTicket.category` from `TicketCategory @default(UNTRIAGED)` to `String @default("UNTRIAGED")`. Index on `category` is preserved. No change to `SupportTicket`'s other fields, no change to `TicketComment` / `TicketAttachment` / `TicketEvent`.

### Migration SQL — `packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`

```sql
-- Convert the column off the enum before dropping the enum itself.
ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" DROP DEFAULT,
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT,
  ALTER COLUMN "category" SET DEFAULT 'UNTRIAGED';

DROP TYPE "TicketCategory";
```

Existing `CRM_ISSUE` / `UNTRIAGED` / etc. values survive as strings. Admin-UI re-categorize still uses the same column.

### Category list shape — stored on `Setting.value`

```
key: "supportTickets.categories"
value: {
  "categories": [
    { "key": "BUG",              "label": "Bug",              "color": "rose",    "order": 1 },
    { "key": "PERMISSION_ISSUE", "label": "Permission issue", "color": "amber",   "order": 2 },
    { "key": "FEATURE_REQUEST",  "label": "Feature request",  "color": "teal",    "order": 3 },
    { "key": "QUESTION",         "label": "Question",         "color": "violet",  "order": 4 },
    { "key": "IT_ISSUE",         "label": "IT issue",         "color": "sky",     "order": 5 },
    { "key": "OTHER",            "label": "Other",            "color": "gray",    "order": 6 }
  ]
}
```

Valid `color` values are a fixed palette (rose, amber, teal, violet, sky, indigo, emerald, slate, gray) — admin picks from a dropdown, not a free-form colour picker.

### Idempotent seed

On API boot, if the `Setting` row for `supportTickets.categories` is missing, insert the default list. If it exists (even with a different shape), leave it alone — admins have made changes.

## API

New endpoints in a new file `apps/api/src/routes/support-ticket-config.ts`:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/ticket-categories` | bearer | Returns the active list. All authenticated users can read (submitters need it for the modal). Omits orphan keys. |
| GET | `/admin/ticket-categories` | admin | Same payload plus any orphan keys currently in use (`{ orphans: [{ key, ticketCount }] }`) so the admin UI can warn before delete. |
| PUT | `/admin/ticket-categories` | admin | Replaces the list wholesale. Body `{ categories: [...] }`. Validates: unique `key`, `order` numeric, `color` in palette, `label` non-empty, `key` alphanumeric + underscore. |

**Validation rules:**
- `key`: uppercase letters, digits, underscore. Max 64 chars. Treated as immutable for UX reasons — the UI only lets admins rename the `label`, not the `key`. (Renaming a key would orphan every ticket using it.)
- `label`: 1–64 chars.
- `color`: one of the palette above.
- `order`: integer ≥ 0.

**Change to existing `POST /tickets`:**
- Accept required `category: string` field in the body.
- Validate against the active list (must be a current `key`).
- If validation fails, return 400 with a clear message.

**Change to existing `PATCH /tickets/:id`:**
- Already accepts `category` — no signature change. Admin-only re-categorize still works. Payload is now a free-form string validated against the active list (orphan keys are permitted for tickets that already hold them so admins can "keep as-is" without accidentally changing the value).

**Event emission unchanged.** Category changes still emit `CATEGORY_CHANGED` into the ticket timeline.

## Frontend

### Bug fix — [app-wrapper.tsx](apps/web/app/app-wrapper.tsx)

Add `/support` and `/notifications` to the `allowPageScroll` condition at lines 102–120. Two-line change. Unblocks the composer on `/support/tickets/<id>` and the full list on `/notifications`.

### New client helper — `apps/web/lib/support-ticket-categories-client.ts`

```
{
  async listActive(): Promise<Category[]>
  async listAdmin(): Promise<{ categories: Category[]; orphans: OrphanInfo[] }>
  async save(categories: Category[]): Promise<void>
}
```

Small, focused — no bundled UI state. Components call it directly.

### New admin page — `apps/web/app/settings/support-tickets/page.tsx`

Single page, single tab ("Categories"). Table layout with drag-to-reorder row handles (reuse `GripVertical` from lucide, same DnD pattern as [app-wrapper.tsx:519-522](apps/web/app/app-wrapper.tsx)'s existing "Edit navigation" list — native HTML5 drag, no lib). Each row: key (read-only), label (inline edit), color (swatch picker dropdown), order (implicit from row position), delete button.

- "Add category" button appends a new row with blank key + label, focus on the label input, auto-generates a key from the label on blur (`label.toUpperCase().replace(/[^A-Z0-9]/g, '_')`).
- "Save" button at the bottom does a single `PUT` to replace the list. Shows "Saving…" and "Saved ✓" feedback. Unsaved-changes banner at top while dirty.
- Before deleting a row, if `orphans` contains that key with `ticketCount > 0`, modal confirms: "3 tickets still use this category. Delete anyway? They'll keep the value but it'll appear as a greyed pill."

### Settings sidebar — [settings-sidebar.tsx](apps/web/components/settings/settings-sidebar.tsx)

New entry under the Integrations group (sibling of Automations and Notifications):
```
{ name: 'Support Tickets', href: '/settings/support-tickets', icon: LifeBuoy }
```

Also add a card to the `/settings` overview page.

### Submit modal — [submit-ticket-modal.tsx](apps/web/components/support/submit-ticket-modal.tsx)

Add a required `<select>` above the description field, populated from `categoriesClient.listActive()` on modal open. Default to the first option. The submit button stays disabled if no category is selected (defensive).

### Admin controls — [ticket-admin-controls.tsx](apps/web/components/support/ticket-admin-controls.tsx)

Replace the hardcoded `CATEGORY_OPTIONS` constant with a dynamic fetch from `categoriesClient.listAdmin()` (admins already on this screen — use the admin endpoint so orphans show). Orphan keys render with a small "(deleted)" suffix in the dropdown so admins can see at a glance.

### Category pill — [ticket-category-pill.tsx](apps/web/components/support/ticket-category-pill.tsx)

Change from a hardcoded enum+label map to a lookup against a lightweight context provider or in-memory cache. Options:

- **Context provider (`CategoryCatalogProvider`)**: wraps the support-ticket pages, fetches the active list once, provides a `getCategoryDisplay(key)` function that returns `{ label, color }` (with a sensible fallback `{ label: key, color: 'gray' }` for orphans). This is cleanest — no per-pill network calls.
- Loaded at the layout level for `/support/*` routes.

## Reused existing utilities

- `Setting` Prisma model + [apps/api/src/routes/settings.ts](apps/api/src/routes/settings.ts) — don't reuse the generic endpoints directly (they'd allow any authenticated user to read our config); write dedicated endpoints but share the underlying Prisma access.
- `apiClient` + `usePermissions` on frontend — unchanged.
- Native HTML5 drag (no new dep) for row reorder — matches Phase 1's "Edit navigation" UI.
- Global admin guard at [app.ts:444-453](apps/api/src/app.ts) — the `/admin/*` routes are auto-protected.

## Execution order

**A. DB**
1. Schema change: `TicketCategory` enum → `String`.
2. Migration SQL.
3. `pnpm prisma generate`.

**B. API**
4. New `apps/api/src/lib/ticket-categories.ts` — reads/writes the Setting row; idempotent seeder; validators; orphan detection.
5. New `apps/api/src/routes/support-ticket-config.ts` — three endpoints above. Register in `app.ts`.
6. Call the seeder from `buildApp()` (alongside `initNotificationListener()` and the other ensure-* functions).
7. Update `POST /tickets` validation + type for required category.
8. Update `PATCH /tickets/:id` validation to permit orphan keys already held.

**C. Frontend**
9. `support-ticket-categories-client.ts`.
10. `CategoryCatalogProvider` context.
11. `/settings/support-tickets` page.
12. Sidebar entry + settings overview card.
13. Submit modal: add select, required validation.
14. Admin controls: fetch + render dynamic list.
15. Pill: read from context.
16. Scroll fix in `app-wrapper.tsx`.

## Verification

Manual end-to-end:
1. **Scroll fix first.** Open an existing ticket in admin view → scroll down → the comment composer is visible and posts a comment.
2. **Submit flow:** open the modal as a non-admin → the new category select is present with all six default options → submitting without selecting shows a validation hint → submitting with "Bug" stores `category = "BUG"` on the ticket → admin triage dropdown shows the correct selected category.
3. **Admin CRUD:** visit `/settings/support-tickets` → add a new category "Hardware" → drag to reorder → save → open a new ticket → "Hardware" appears in the picklist.
4. **Rename:** change "Bug" label to "Defect" → save → existing BUG-keyed tickets still render but with the new "Defect" label and same color.
5. **Delete with orphans:** categorize a ticket as "Question" → delete "Question" from settings → confirmation names the 1 affected ticket → accept → the existing ticket still shows "Question" as a greyed pill with "(deleted)" hint.
6. **`CRM_ISSUE` survival:** the test ticket #T-00002 still displays as "CRM issue" until manually re-categorized.
7. **`/notifications` page** is scrollable end-to-end.
8. **Admin-only enforcement:** non-admin GET on `/admin/ticket-categories` returns 403. Non-admin PUT returns 403. Non-admin GET on `/ticket-categories` works.

## Critical files

**Create:**
- `packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`
- `apps/api/src/lib/ticket-categories.ts`
- `apps/api/src/routes/support-ticket-config.ts`
- `apps/web/lib/support-ticket-categories-client.ts`
- `apps/web/lib/category-catalog-context.tsx`
- `apps/web/app/settings/support-tickets/page.tsx`

**Modify:**
- [packages/db/prisma/schema.prisma](packages/db/prisma/schema.prisma) — drop enum, change column type
- [apps/api/src/app.ts](apps/api/src/app.ts) — register route, call seeder
- [apps/api/src/routes/tickets.ts](apps/api/src/routes/tickets.ts) — require/validate `category` on POST, soften on PATCH
- [apps/web/app/app-wrapper.tsx](apps/web/app/app-wrapper.tsx) — scroll whitelist
- [apps/web/app/settings/page.tsx](apps/web/app/settings/page.tsx) — overview card
- [apps/web/components/settings/settings-sidebar.tsx](apps/web/components/settings/settings-sidebar.tsx) — new entry
- [apps/web/components/support/submit-ticket-modal.tsx](apps/web/components/support/submit-ticket-modal.tsx) — required select
- [apps/web/components/support/ticket-admin-controls.tsx](apps/web/components/support/ticket-admin-controls.tsx) — dynamic category list
- [apps/web/components/support/ticket-category-pill.tsx](apps/web/components/support/ticket-category-pill.tsx) — context-driven display
