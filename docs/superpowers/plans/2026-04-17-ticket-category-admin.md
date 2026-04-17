# Admin-Managed Ticket Categories + Submit Picklist + Scroll Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `TicketCategory` Postgres enum with an admin-managed list backed by the existing `Setting` table, surface a CRUD UI at `/settings/support-tickets`, make category required on the ticket submit modal, and fix the `/support/*` and `/notifications` pages that clip their scrolling content.

**Architecture:** Categories become a JSON blob stored on a single `Setting` row (`key = "supportTickets.categories"`). The `SupportTicket.category` column changes from the `TicketCategory` enum to plain `TEXT` — existing values survive unchanged. A new library module handles validation, seeding, and orphan detection. A React context provider fetches the catalog once per support-page visit and exposes `getCategoryDisplay(key)` to any pill. Orphaned keys (tickets still pointing at a deleted category) render with a greyed "(deleted)" marker but are not modified.

**Tech Stack:** Prisma 5.17, Fastify 5 + zod, Next.js 15 App Router, Tailwind, existing `apiClient` helpers.

**Branch:** `claude/ticket-category-admin` (already created off current `origin/main`; the brainstorming spec is committed at [docs/superpowers/specs/2026-04-17-ticket-category-admin-design.md](docs/superpowers/specs/2026-04-17-ticket-category-admin-design.md)).

---

## Task 1: Ship the scroll fix (isolated, valuable, tiny)

This is the bug the user filed a screenshot for — the comment composer was hidden because `/support/*` wasn't in the `allowPageScroll` whitelist. Ship this on its own commit so it stands out and so a bisect can find it quickly.

**Files:**
- Modify: `apps/web/app/app-wrapper.tsx:102-120` (the `allowPageScroll` condition)

- [ ] **Step 1: Edit `allowPageScroll` in `app-wrapper.tsx`**

Find the condition around line 102 and add `/support` and `/notifications` alongside the existing entries.

```tsx
  const allowPageScroll = pathname === '/' ||
    pathname?.includes('/[id]') ||
    pathname?.includes('/new') ||
    pathname?.startsWith('/contacts') ||
    pathname?.startsWith('/leads') ||
    pathname?.startsWith('/opportunities') ||
    pathname?.startsWith('/properties') ||
    pathname?.startsWith('/accounts') ||
    pathname?.startsWith('/projects') ||
    pathname?.startsWith('/installations') ||
    pathname?.startsWith('/products') ||
    pathname?.startsWith('/quotes') ||
    pathname?.startsWith('/reports') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/service') ||
    pathname?.startsWith('/workorders') ||
    pathname?.startsWith('/summary') ||
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/support') ||
    pathname?.startsWith('/notifications') ||
    pathname?.includes('demo');
```

- [ ] **Step 2: Verify manually**

Start the dev server (`pnpm dev`), open an existing ticket at `/support/tickets/<id>`, scroll to the bottom — the "Add a comment" composer should now be visible.

Same check on `/notifications` — the full-history page should scroll end-to-end.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/app-wrapper.tsx
git commit -m "fix: allow /support and /notifications pages to scroll

The allowPageScroll whitelist in app-wrapper.tsx was missing /support/*
and /notifications, so the content container got overflow-hidden and
anything below the viewport was clipped. This hid the ticket comment
composer (rendered below the Activity timeline) on the admin detail
page, and truncated the full-history notifications page."
```

---

## Task 2: DB migration — drop the `TicketCategory` enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (find the `TicketCategory` enum and the `SupportTicket.category` field)
- Create: `packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`

- [ ] **Step 1: Update `schema.prisma`**

Remove the `TicketCategory` enum definition entirely. Then change the `SupportTicket.category` field from the enum to a plain string with a default. Search for `category TicketCategory @default(UNTRIAGED)` and replace with:

```prisma
  category      String         @default("UNTRIAGED")
```

Also remove the enum block:

```prisma
enum TicketCategory {
  UNTRIAGED
  CRM_ISSUE
  IT_ISSUE
  FEATURE_REQUEST
  QUESTION
}
```

Leave the `@@index([category])` on `SupportTicket` as-is — it applies fine to a TEXT column.

- [ ] **Step 2: Write the migration SQL**

Create `packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`:

```sql
-- Convert SupportTicket.category off the TicketCategory enum so it can be
-- managed through an admin UI as plain strings. Existing row values
-- (including UNTRIAGED, CRM_ISSUE, IT_ISSUE, FEATURE_REQUEST, QUESTION)
-- are preserved verbatim as TEXT.

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" DROP DEFAULT;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "category" SET DEFAULT 'UNTRIAGED';

DROP TYPE "TicketCategory";
```

- [ ] **Step 3: Regenerate the Prisma client**

```bash
cd packages/db && pnpm exec prisma generate
```

Expected: "Generated Prisma Client" message, no errors. The `TicketCategory` type should no longer appear in `node_modules/.prisma/client`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/add_ticket_category_admin/migration.sql
git commit -m "feat(db): drop TicketCategory enum, use string column

Categories become admin-managed via the Setting table. Existing
enum values survive as plain strings; no data loss."
```

---

## Task 3: Backend library — categories config module

Central home for read/write/seed/validate. Dedicated module so the route file stays thin and the seed helper can be called from `buildApp()`.

**Files:**
- Create: `apps/api/src/lib/support-tickets/categories.ts`

- [ ] **Step 1: Create the module**

```typescript
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const SETTING_KEY = 'supportTickets.categories';

export const CATEGORY_COLORS = [
  'rose',
  'amber',
  'teal',
  'violet',
  'sky',
  'indigo',
  'emerald',
  'slate',
  'gray',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface TicketCategory {
  key: string;
  label: string;
  color: CategoryColor;
  order: number;
}

export const categorySchema = z.object({
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Z0-9_]+$/, 'Key must be uppercase letters, digits, or underscore'),
  label: z.string().min(1).max(64),
  color: z.enum(CATEGORY_COLORS),
  order: z.number().int().min(0),
});

export const categoriesArraySchema = z
  .array(categorySchema)
  .min(1, 'At least one category is required')
  .superRefine((arr, ctx) => {
    const seen = new Set<string>();
    arr.forEach((c, i) => {
      if (seen.has(c.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, 'key'],
          message: `Duplicate key: ${c.key}`,
        });
      }
      seen.add(c.key);
    });
  });

const DEFAULT_CATEGORIES: TicketCategory[] = [
  { key: 'BUG', label: 'Bug', color: 'rose', order: 1 },
  { key: 'PERMISSION_ISSUE', label: 'Permission issue', color: 'amber', order: 2 },
  { key: 'FEATURE_REQUEST', label: 'Feature request', color: 'teal', order: 3 },
  { key: 'QUESTION', label: 'Question', color: 'violet', order: 4 },
  { key: 'IT_ISSUE', label: 'IT issue', color: 'sky', order: 5 },
  { key: 'OTHER', label: 'Other', color: 'gray', order: 6 },
];

/**
 * Read the current active categories from the Setting table.
 * If no row exists, returns null — callers should handle seeding.
 */
export async function readCategories(): Promise<TicketCategory[] | null> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return null;
  const parsed = z
    .object({ categories: categoriesArraySchema })
    .safeParse(row.value);
  if (!parsed.success) return null;
  return parsed.data.categories.slice().sort((a, b) => a.order - b.order);
}

/** Returns either the stored list or the defaults, always sorted. */
export async function getCategoriesOrDefault(): Promise<TicketCategory[]> {
  const stored = await readCategories();
  return (stored ?? DEFAULT_CATEGORIES).slice().sort((a, b) => a.order - b.order);
}

/** Overwrite the whole list. Returns the normalised list that was saved. */
export async function writeCategories(
  next: TicketCategory[],
): Promise<TicketCategory[]> {
  const parsed = categoriesArraySchema.parse(next);
  const normalised = parsed.slice().sort((a, b) => a.order - b.order);
  const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (existing) {
    await prisma.setting.update({
      where: { key: SETTING_KEY },
      data: { value: { categories: normalised } },
    });
  } else {
    await prisma.setting.create({
      data: {
        id: generateId('Setting'),
        key: SETTING_KEY,
        value: { categories: normalised },
      },
    });
  }
  return normalised;
}

/**
 * Idempotent seeder. Called once on API boot from buildApp(). Only inserts
 * the defaults if the row is missing — never overwrites admin edits.
 */
export async function seedCategoriesIfMissing(): Promise<void> {
  const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (existing) return;
  await prisma.setting.create({
    data: {
      id: generateId('Setting'),
      key: SETTING_KEY,
      value: { categories: DEFAULT_CATEGORIES },
    },
  });
}

/**
 * Find category keys that are referenced by at least one ticket but not
 * present in the provided list. Used by the admin UI to warn about orphans
 * before deletion.
 */
export async function findOrphanKeys(
  activeKeys: string[],
): Promise<Array<{ key: string; ticketCount: number }>> {
  const rows = await prisma.supportTicket.groupBy({
    by: ['category'],
    where: { deletedAt: null },
    _count: { _all: true },
  });
  const activeSet = new Set(activeKeys);
  return rows
    .filter((r) => !activeSet.has(r.category))
    .map((r) => ({ key: r.category, ticketCount: r._count._all }))
    .sort((a, b) => b.ticketCount - a.ticketCount);
}

export { DEFAULT_CATEGORIES, SETTING_KEY };
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/support-tickets/categories.ts
git commit -m "feat(api): categories library — read/write/seed/orphan-detect"
```

---

## Task 4: Backend routes — public read + admin CRUD

**Files:**
- Create: `apps/api/src/routes/support-ticket-config.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  categoriesArraySchema,
  findOrphanKeys,
  getCategoriesOrDefault,
  writeCategories,
} from '../lib/support-tickets/categories.js';

export async function supportTicketConfigRoutes(app: FastifyInstance) {
  /* ---------- GET /ticket-categories — any authed user ---------- */
  app.get('/ticket-categories', async (_req, reply) => {
    const items = await getCategoriesOrDefault();
    return reply.send({ items });
  });

  /* ---------- GET /admin/ticket-categories — admin: list + orphans ---------- */
  app.get('/admin/ticket-categories', async (_req, reply) => {
    const items = await getCategoriesOrDefault();
    const orphans = await findOrphanKeys(items.map((c) => c.key));
    return reply.send({ items, orphans });
  });

  /* ---------- PUT /admin/ticket-categories — admin: replace whole list ---------- */
  app.put('/admin/ticket-categories', async (req, reply) => {
    const bodySchema = z.object({ categories: categoriesArraySchema });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const saved = await writeCategories(parsed.data.categories);
    const orphans = await findOrphanKeys(saved.map((c) => c.key));
    return reply.send({ items: saved, orphans });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/support-ticket-config.ts
git commit -m "feat(api): /ticket-categories + /admin/ticket-categories routes"
```

---

## Task 5: Wire the route + seeder into `buildApp()`

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Add the imports**

Near the other route imports at the top of `apps/api/src/app.ts`, add:

```typescript
import { supportTicketConfigRoutes } from './routes/support-ticket-config.js';
import { seedCategoriesIfMissing } from './lib/support-tickets/categories.js';
```

- [ ] **Step 2: Register the route alongside the others**

Find the block that registers `ticketRoutes` + `notificationRoutes` and add:

```typescript
  app.register(ticketRoutes);
  app.register(notificationRoutes);
  app.register(supportTicketConfigRoutes);   // ← new
  app.register(automationRoutes);
```

- [ ] **Step 3: Call the seeder alongside `initNotificationListener()`**

Add one line after the existing `initNotificationListener()` fire-and-forget block:

```typescript
  initNotificationListener().catch((err) => {
    app.log.error({ err }, 'Failed to initialize notification listener');
  });

  seedCategoriesIfMissing().catch((err) => {
    app.log.error({ err }, 'Failed to seed default ticket categories');
  });
```

- [ ] **Step 4: Verify manually**

Start the API: `pnpm --filter api dev`.

In a second terminal:

```bash
curl -s http://localhost:4000/ticket-categories -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "items": [ { "key": "BUG", ... }, ... ] }` with all six defaults, ordered.

```bash
curl -s http://localhost:4000/admin/ticket-categories -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
```

Expected: `{ "items": [...], "orphans": [{ "key": "CRM_ISSUE", "ticketCount": 1 }, ...] }` if you have pre-existing `CRM_ISSUE` rows.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): register ticket-categories route + seed on boot"
```

---

## Task 6: Update `POST /tickets` to require category, soften `PATCH` for orphans

**Files:**
- Modify: `apps/api/src/routes/tickets.ts` (find the `POST /tickets` handler and the `PATCH /tickets/:id` handler)

- [ ] **Step 1: Import the helper**

Near the other local imports at the top of `tickets.ts`:

```typescript
import { getCategoriesOrDefault } from '../lib/support-tickets/categories.js';
```

- [ ] **Step 2: Find the `POST /tickets` zod schema and update it**

The current Phase 1 schema looks like:

```typescript
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(20000),
      sessionId: z.string().max(128).optional(),
      errorLogIds: z.array(z.string().max(64)).max(50).optional(),
    });
```

Change it to:

```typescript
    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(20000),
      category: z.string().min(1).max(64),
      sessionId: z.string().max(128).optional(),
      errorLogIds: z.array(z.string().max(64)).max(50).optional(),
    });
```

- [ ] **Step 3: Validate the category against the active list inside the handler**

Immediately after the `if (!parsed.success) …` check and before the `prisma.supportTicket.create`, add:

```typescript
    const activeCategories = await getCategoriesOrDefault();
    const validKey = activeCategories.some((c) => c.key === parsed.data.category);
    if (!validKey) {
      return reply.code(400).send({
        error: `Unknown category "${parsed.data.category}"`,
      });
    }
```

Then on the `prisma.supportTicket.create` call, add `category: parsed.data.category` to the `data` block (the column defaults to `"UNTRIAGED"` when not provided, but we now require it).

```typescript
    const ticket = await prisma.supportTicket.create({
      data: {
        id: generateId('SupportTicket'),
        title,
        description,
        category: parsed.data.category,
        submittedById: userId,
        sessionId,
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    });
```

- [ ] **Step 4: Soften `PATCH /tickets/:id` to permit orphan-key preservation**

Find the PATCH schema around the existing code:

```typescript
    const schema = z
      .object({
        status: z.enum(STATUS_VALUES).optional(),
        priority: z.enum(PRIORITY_VALUES).optional(),
        category: z.enum(CATEGORY_VALUES).optional(),
        assignedToId: z.string().nullable().optional(),
      })
```

Replace `category: z.enum(CATEGORY_VALUES).optional()` with:

```typescript
        category: z.string().min(1).max(64).optional(),
```

Then remove the unused `CATEGORY_VALUES` constant declaration at the top of the file (search for it and delete the `const CATEGORY_VALUES = [...] as const;` line).

Inside the handler, after `if (!parsed.success) …`, validate the category against the active list **plus** any currently-held key on the ticket (so admins can keep orphan values as-is):

```typescript
    if (parsed.data.category !== undefined) {
      const active = await getCategoriesOrDefault();
      const allowed = new Set(active.map((c) => c.key));
      // Also allow the ticket's current category even if orphaned.
      if (before) allowed.add(before.category);
      if (!allowed.has(parsed.data.category)) {
        return reply
          .code(400)
          .send({ error: `Unknown category "${parsed.data.category}"` });
      }
    }
```

(`before` is already loaded earlier in the handler for change detection — reuse it.)

- [ ] **Step 5: Verify manually**

```bash
# Should fail (no category):
curl -s -X POST http://localhost:4000/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","description":"test"}' | jq .

# Should succeed:
curl -s -X POST http://localhost:4000/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","description":"test","category":"BUG"}' | jq .

# Should fail (unknown category):
curl -s -X POST http://localhost:4000/tickets \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"test","description":"test","category":"NOT_A_REAL_KEY"}' | jq .
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/tickets.ts
git commit -m "feat(api): require category on ticket submit, permit orphans on patch"
```

---

## Task 7: Frontend client helper

**Files:**
- Create: `apps/web/lib/support-ticket-categories-client.ts`

- [ ] **Step 1: Write the client**

```typescript
import { apiClient } from './api-client';

export const CATEGORY_COLORS = [
  'rose',
  'amber',
  'teal',
  'violet',
  'sky',
  'indigo',
  'emerald',
  'slate',
  'gray',
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

export interface TicketCategory {
  key: string;
  label: string;
  color: CategoryColor;
  order: number;
}

export interface OrphanInfo {
  key: string;
  ticketCount: number;
}

export const categoriesClient = {
  async listActive(): Promise<TicketCategory[]> {
    const { items } = await apiClient.get<{ items: TicketCategory[] }>(
      '/ticket-categories',
    );
    return items;
  },

  async listAdmin(): Promise<{ items: TicketCategory[]; orphans: OrphanInfo[] }> {
    return apiClient.get<{ items: TicketCategory[]; orphans: OrphanInfo[] }>(
      '/admin/ticket-categories',
    );
  },

  async save(
    categories: TicketCategory[],
  ): Promise<{ items: TicketCategory[]; orphans: OrphanInfo[] }> {
    return apiClient.put<{ items: TicketCategory[]; orphans: OrphanInfo[] }>(
      '/admin/ticket-categories',
      { categories },
    );
  },
};

/** Tailwind class lookup for pills. Kept here so pill + settings agree. */
export const CATEGORY_COLOR_CLASSES: Record<CategoryColor, string> = {
  rose: 'bg-rose-100 text-rose-800 border-rose-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
  violet: 'bg-violet-100 text-violet-800 border-violet-200',
  sky: 'bg-sky-100 text-sky-800 border-sky-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  slate: 'bg-slate-100 text-slate-800 border-slate-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
};

export const ORPHAN_COLOR_CLASS =
  'bg-gray-100 text-gray-500 border-gray-200 opacity-70 italic';
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/support-ticket-categories-client.ts
git commit -m "feat(web): categories client + color palette"
```

---

## Task 8: Category catalog context

Fetches once, shared by every pill inside a support route. Orphans render with a deleted-marker without needing a second fetch.

**Files:**
- Create: `apps/web/lib/category-catalog-context.tsx`

- [ ] **Step 1: Create the context**

```typescript
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  categoriesClient,
  CATEGORY_COLOR_CLASSES,
  ORPHAN_COLOR_CLASS,
  type CategoryColor,
  type TicketCategory,
} from './support-ticket-categories-client';

interface CategoryDisplay {
  label: string;
  className: string;
  isOrphan: boolean;
  color: CategoryColor | null;
}

interface CategoryCatalogContextValue {
  categories: TicketCategory[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getDisplay: (key: string) => CategoryDisplay;
}

const CategoryCatalogContext = createContext<CategoryCatalogContextValue | null>(
  null,
);

export function CategoryCatalogProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const items = await categoriesClient.listActive();
      setCategories(items);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<CategoryCatalogContextValue>(() => {
    const byKey = new Map(categories.map((c) => [c.key, c]));
    return {
      categories,
      loading,
      error,
      refresh,
      getDisplay: (key: string) => {
        const found = byKey.get(key);
        if (!found) {
          return {
            label: key,
            className: ORPHAN_COLOR_CLASS,
            isOrphan: true,
            color: null,
          };
        }
        return {
          label: found.label,
          className: CATEGORY_COLOR_CLASSES[found.color],
          isOrphan: false,
          color: found.color,
        };
      },
    };
  }, [categories, loading, error]);

  return (
    <CategoryCatalogContext.Provider value={value}>
      {children}
    </CategoryCatalogContext.Provider>
  );
}

export function useCategoryCatalog(): CategoryCatalogContextValue {
  const ctx = useContext(CategoryCatalogContext);
  if (!ctx) {
    // Safe fallback for pills rendered outside a provider (e.g. settings
    // lists). Return a loading-state shape so nothing crashes; the pill will
    // fall back to rendering the raw key.
    return {
      categories: [],
      loading: true,
      error: null,
      refresh: async () => {},
      getDisplay: (key) => ({
        label: key,
        className: ORPHAN_COLOR_CLASS,
        isOrphan: true,
        color: null,
      }),
    };
  }
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/category-catalog-context.tsx
git commit -m "feat(web): category catalog provider + display helper"
```

---

## Task 9: Wrap `/support` routes with the provider

Add a Next.js layout at `apps/web/app/support/layout.tsx` so every page under `/support/*` (triage queue + detail) gets the context.

**Files:**
- Create: `apps/web/app/support/layout.tsx`

- [ ] **Step 1: Create the layout**

```typescript
'use client';

import { CategoryCatalogProvider } from '@/lib/category-catalog-context';

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <CategoryCatalogProvider>{children}</CategoryCatalogProvider>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/support/layout.tsx
git commit -m "feat(web): wrap /support/* with CategoryCatalogProvider"
```

---

## Task 10: Replace hardcoded pill with context-driven lookup

**Files:**
- Modify: `apps/web/components/support/ticket-category-pill.tsx`

- [ ] **Step 1: Rewrite the pill**

Replace the entire file contents with:

```typescript
'use client';

import { useCategoryCatalog } from '@/lib/category-catalog-context';

export function TicketCategoryPill({ category }: { category: string }) {
  const { getDisplay } = useCategoryCatalog();
  const { label, className, isOrphan } = getDisplay(category);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
      title={isOrphan ? `Deleted category: ${category}` : undefined}
    >
      {label}
      {isOrphan && <span className="ml-1 text-[10px]">(deleted)</span>}
    </span>
  );
}
```

Note the prop shape changed from `category: TicketCategory` (enum-typed) to `category: string`. Callers already pass `ticket.category` which is now a string on the client types too (see next step).

- [ ] **Step 2: Update the `TicketCategory` type export in `tickets-client.ts`**

Open `apps/web/lib/tickets-client.ts`, find the line

```typescript
export type TicketCategory =
  | 'UNTRIAGED'
  | 'CRM_ISSUE'
  | 'IT_ISSUE'
  | 'FEATURE_REQUEST'
  | 'QUESTION';
```

and replace it with:

```typescript
/** Category is an admin-managed string key. Use CategoryCatalog to resolve label/color. */
export type TicketCategory = string;
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/support/ticket-category-pill.tsx apps/web/lib/tickets-client.ts
git commit -m "refactor(web): ticket category pill reads from catalog context"
```

---

## Task 11: Admin settings page — `/settings/support-tickets`

**Files:**
- Create: `apps/web/app/settings/support-tickets/page.tsx`

- [ ] **Step 1: Write the page**

```typescript
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy,
  GripVertical,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import {
  categoriesClient,
  CATEGORY_COLORS,
  CATEGORY_COLOR_CLASSES,
  type CategoryColor,
  type OrphanInfo,
  type TicketCategory,
} from '@/lib/support-ticket-categories-client';

interface Row extends TicketCategory {
  _uiId: string; // stable React key that survives reorders / renames
}

function makeUiId() {
  return Math.random().toString(36).slice(2);
}

function slugKey(label: string): string {
  const k = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return k || 'CATEGORY';
}

export default function SupportTicketSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [orphans, setOrphans] = useState<OrphanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    index: number;
    orphan: OrphanInfo | null;
  } | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { items, orphans: orphanList } = await categoriesClient.listAdmin();
      setRows(items.map((i) => ({ ...i, _uiId: makeUiId() })));
      setOrphans(orphanList);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (index: number, patch: Partial<TicketCategory>) => {
    setRows((prev) => {
      const next = prev.slice();
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      return next;
    });
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `CATEGORY_${prev.length + 1}`,
        label: '',
        color: 'gray',
        order: prev.length + 1,
        _uiId: makeUiId(),
      },
    ]);
    setDirty(true);
  };

  const requestDelete = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const orphan = orphans.find((o) => o.key === row.key) ?? null;
    setPendingDelete({ index, orphan });
  };

  const confirmDelete = () => {
    if (pendingDelete == null) return;
    setRows((prev) => prev.filter((_, i) => i !== pendingDelete.index));
    setDirty(true);
    setPendingDelete(null);
  };

  const handleDragStart = (idx: number) => setDragFromIndex(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragFromIndex == null || dragFromIndex === idx) return;
    setRows((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(dragFromIndex, 1);
      if (!moved) return prev;
      next.splice(idx, 0, moved);
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });
    setDragFromIndex(idx);
    setDirty(true);
  };

  const handleDragEnd = () => setDragFromIndex(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Auto-derive keys from labels on blur logic: but we also normalise here
      // defensively so empty keys aren't sent.
      const payload: TicketCategory[] = rows.map((r, i) => ({
        key: r.key.trim() || slugKey(r.label),
        label: r.label.trim(),
        color: r.color,
        order: i + 1,
      }));
      const { items, orphans: nextOrphans } = await categoriesClient.save(payload);
      setRows(items.map((c) => ({ ...c, _uiId: makeUiId() })));
      setOrphans(nextOrphans);
      setDirty(false);
      setJustSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <LifeBuoy className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">Support Tickets</h1>
            <p className="text-sm text-brand-gray mt-0.5">
              Manage the category list that users pick from when they submit a ticket.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {dirty && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">You have unsaved changes.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 text-brand-dark/80"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {justSavedAt && !dirty && Date.now() - justSavedAt < 3000 && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-800">
          <Check className="w-4 h-4" /> Saved.
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-gray mb-3">
          Categories
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul>
            {rows.map((row, idx) => {
              const orphan = orphans.find((o) => o.key === row.key);
              return (
                <li
                  key={row._uiId}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                    onBlur={(e) => {
                      if (!row.key || row.key.startsWith('CATEGORY_')) {
                        updateRow(idx, { key: slugKey(e.target.value) });
                      }
                    }}
                    placeholder="Label"
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  />
                  <span className="font-mono text-[11px] text-gray-500 w-40 truncate" title={row.key}>
                    {row.key}
                  </span>
                  <select
                    value={row.color}
                    onChange={(e) => updateRow(idx, { color: e.target.value as CategoryColor })}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                  >
                    {CATEGORY_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLOR_CLASSES[row.color]}`}
                  >
                    Preview
                  </span>
                  {orphan && (
                    <span className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded" title={`${orphan.ticketCount} ticket(s) use this key`}>
                      {orphan.ticketCount} in use
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => requestDelete(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50/70">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-brand-navy hover:text-brand-red"
            >
              <Plus className="w-4 h-4" /> Add category
            </button>
          </div>
        </div>
      </section>

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setPendingDelete(null)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-brand-dark">Delete category?</h3>
            </div>
            <div className="px-5 py-4 text-sm text-brand-dark/80 space-y-2">
              <p>
                The category will be removed from the picklist. This does not change any existing
                tickets that already use this key.
              </p>
              {pendingDelete.orphan && pendingDelete.orphan.ticketCount > 0 && (
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <strong>{pendingDelete.orphan.ticketCount} ticket(s)</strong> still use this category. They&apos;ll show the key as a greyed &ldquo;(deleted)&rdquo; pill until an admin re-categorizes them.
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 text-brand-dark/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify manually**

Navigate to `http://localhost:3000/settings/support-tickets`. Confirm:
- Six default categories load with correct labels and colors.
- Dragging a row to a new position reorders it and the "unsaved changes" banner appears.
- Save persists the new order.
- Adding a new row auto-derives the key from the label on blur.
- Deleting a category that has tickets using it shows the warning modal with the correct count.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/settings/support-tickets/page.tsx
git commit -m "feat(web): admin page to manage ticket categories"
```

---

## Task 12: Settings sidebar + overview card

**Files:**
- Modify: `apps/web/components/settings/settings-sidebar.tsx`
- Modify: `apps/web/app/settings/page.tsx`

- [ ] **Step 1: Add sidebar entry**

Open `apps/web/components/settings/settings-sidebar.tsx`. Find the Notifications entry inside the Integrations group and add a new sibling right after it:

```typescript
      { name: 'Support Tickets', href: '/settings/support-tickets', icon: LifeBuoy },
```

Also add `LifeBuoy` to the lucide-react import at the top of the file if it isn't already there.

- [ ] **Step 2: Add overview card**

Open `apps/web/app/settings/page.tsx`. Add to the lucide-react imports at the top:

```typescript
  LifeBuoy,
```

Then add one new card to the `cards` array (immediately after the Notifications entry from Phase 2):

```typescript
    { title: 'Support Tickets', icon: LifeBuoy, href: '/settings/support-tickets', description: 'Manage the category list used on the submit form', color: '#0ea5e9' },
```

- [ ] **Step 3: Verify manually**

Visit `/settings` → "Support Tickets" card present → click → lands on the admin page.

Sidebar under "Integrations" group shows "Support Tickets" with the LifeBuoy icon.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/settings/settings-sidebar.tsx apps/web/app/settings/page.tsx
git commit -m "feat(web): settings sidebar + overview entry for support tickets config"
```

---

## Task 13: Category picklist on the submit modal

**Files:**
- Modify: `apps/web/components/support/submit-ticket-modal.tsx`

- [ ] **Step 1: Load categories and add state**

Near the top of the component, after the existing `useState` declarations, add:

```typescript
import { categoriesClient, type TicketCategory } from '@/lib/support-ticket-categories-client';
```

Then in the component body:

```typescript
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [category, setCategory] = useState<string>('');
```

- [ ] **Step 2: Fetch on open**

Inside the existing effect that runs when `open` flips true, add a fetch alongside the recent-errors logic:

```typescript
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const list = await categoriesClient.listActive();
        setCategories(list);
        setCategory(list[0]?.key ?? '');
      } catch {
        // Best-effort. User will see a validation error on submit if empty.
      }
    })();
    // ... existing recent-errors code stays here
  }, [open, sessionId]);
```

- [ ] **Step 3: Reset `category` on close**

In the close effect:

```typescript
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setCategory('');
      setRecentErrors([]);
      setCheckedErrorIds(new Set());
      setShowErrorsSection(true);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);
```

- [ ] **Step 4: Render the select above the description**

Add this block inside the form, between the title input block and the description textarea block:

```tsx
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1" htmlFor="ticket-category">
              Type of issue
            </label>
            <select
              id="ticket-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy bg-white"
            >
              {categories.length === 0 && <option value="">Loading…</option>}
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
```

- [ ] **Step 5: Send `category` on submit + disable button when empty**

Find the `handleSubmit` call to `ticketsClient.create`:

```typescript
      const ticket = await ticketsClient.create({
        title: title.trim(),
        description: description.trim(),
        sessionId,
        errorLogIds: Array.from(checkedErrorIds),
      });
```

Add `category`:

```typescript
      const ticket = await ticketsClient.create({
        title: title.trim(),
        description: description.trim(),
        category,
        sessionId,
        errorLogIds: Array.from(checkedErrorIds),
      });
```

Find the submit button's disabled expression and add `!category` to it:

```tsx
            disabled={submitting || !title.trim() || !description.trim() || !category}
```

- [ ] **Step 6: Update `tickets-client.ts` create signature**

Open `apps/web/lib/tickets-client.ts`. Find `async create(body: { ... })` and add the `category` field:

```typescript
  async create(body: {
    title: string;
    description: string;
    category: string;
    sessionId?: string;
    errorLogIds?: string[];
  }): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>('/tickets', body);
  },
```

- [ ] **Step 7: Verify manually**

Open the bell-less help dropdown → "Submit a ticket" → category select present, defaults to "Bug" → submit without filling title: disabled button prevents it → submit with title/description/category → ticket detail shows the picked category pill.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/support/submit-ticket-modal.tsx apps/web/lib/tickets-client.ts
git commit -m "feat(web): required category picklist on ticket submit modal"
```

---

## Task 14: Admin controls — dynamic category list

**Files:**
- Modify: `apps/web/components/support/ticket-admin-controls.tsx`

- [ ] **Step 1: Replace the hardcoded category list with a dynamic fetch**

Current file has:

```typescript
const CATEGORY_OPTIONS: TicketCategory[] = [
  'UNTRIAGED',
  'CRM_ISSUE',
  'IT_ISSUE',
  'FEATURE_REQUEST',
  'QUESTION',
];
```

Remove `CATEGORY_OPTIONS`, `CATEGORY_LABELS`, and the `import { type TicketCategory }` if it's only used for the constant. Replace with a fetch + combined list (active + orphans) so admins can see current orphan values in the dropdown.

Add to the imports:

```typescript
import { categoriesClient, type TicketCategory as CatalogCategory } from '@/lib/support-ticket-categories-client';
```

Add state + effect inside the component:

```typescript
  const [categoryOptions, setCategoryOptions] = useState<
    Array<{ key: string; label: string; isOrphan: boolean }>
  >([]);

  useEffect(() => {
    (async () => {
      try {
        const { items, orphans } = await categoriesClient.listAdmin();
        const active = items.map((c) => ({ key: c.key, label: c.label, isOrphan: false }));
        const orphanOptions = orphans
          .filter((o) => !items.find((i) => i.key === o.key))
          .map((o) => ({ key: o.key, label: `${o.key} (deleted)`, isOrphan: true }));
        // Keep the currently-selected orphan in the list even if it's not in
        // the orphans query result, so the admin can see what's there.
        if (
          ticket.category &&
          !active.find((a) => a.key === ticket.category) &&
          !orphanOptions.find((o) => o.key === ticket.category)
        ) {
          orphanOptions.push({
            key: ticket.category,
            label: `${ticket.category} (deleted)`,
            isOrphan: true,
          });
        }
        setCategoryOptions([...active, ...orphanOptions]);
      } catch {
        // Non-fatal; dropdown is empty and admin can reload.
      }
    })();
  }, [ticket.category]);
```

- [ ] **Step 2: Update the `<select>` to render from `categoryOptions`**

Replace the category select block (the one iterating `CATEGORY_OPTIONS`) with:

```tsx
      <label className="text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-1 flex items-center gap-2">
          Category {saving === 'category' && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <select
          value={ticket.category}
          onChange={(e) => apply('category', { category: e.target.value })}
          disabled={!!saving}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {categoryOptions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
```

- [ ] **Step 3: Verify manually**

Open a ticket in admin mode — category dropdown lists all active categories plus any orphans (e.g. `CRM_ISSUE (deleted)` for pre-existing rows). Switching category successfully persists via the existing PATCH.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/support/ticket-admin-controls.tsx
git commit -m "feat(web): admin controls render dynamic category list incl. orphans"
```

---

## Task 15: End-to-end smoke test + PR

Final sweep to make sure nothing regressed, then open the PR.

- [ ] **Step 1: Run the dev servers and walk the happy path**

```bash
pnpm dev
```

In two browsers (A = admin, B = non-admin submitter):

1. B: Help → Submit a ticket → select "Bug" → fill title/description → Submit. Ticket created with category BUG.
2. A: /support/tickets → click the new ticket → category pill shows "Bug" (rose colour). Scroll to the bottom — comment composer is visible.
3. A: change Status to In progress → the change fires a notification to B (bell lights up within a second).
4. A: change Category dropdown → switch to "Feature request" → timeline shows CATEGORY_CHANGED event.
5. A: /settings/support-tickets → rename "Bug" to "Defect" → save → navigate back to the ticket detail → pill now reads "Defect" with same colour.
6. A: delete "Question" (0 tickets use it) → no warning modal needed → saved.
7. A: delete "Defect" → modal shows "1 ticket still uses this" → confirm → the ticket detail pill now reads `BUG (deleted)` with the orphan style.
8. A: /notifications → scroll to the bottom → fully scrollable.

- [ ] **Step 2: Push + open PR**

```bash
git push -u origin claude/ticket-category-admin
gh pr create --title "feat: admin-managed ticket categories + submit picklist + scroll fix" --body "$(cat <<'EOF'
## Summary

- Fixes a bug where the comment composer was invisible on `/support/tickets/<id>` because `/support/*` wasn't in the scroll whitelist. Same bug was affecting `/notifications`.
- Makes ticket categories admin-managed via a new `/settings/support-tickets` CRUD page. Drops the `TicketCategory` Postgres enum; `SupportTicket.category` becomes a TEXT column. Existing values (including `CRM_ISSUE`) survive as orphan keys and render with a greyed `(deleted)` pill until an admin re-categorizes them.
- Adds a required category picklist to the submit modal, sourced from the active list.

## Test plan

See the 8-step walkthrough in the implementation plan. Covers happy path, real-time notification on change, rename preservation, delete-with-orphans warning flow, and the scroll fix on both `/support` and `/notifications`.

## Database migration

`packages/db/prisma/migrations/add_ticket_category_admin/migration.sql` — converts the `category` column off the enum and drops the enum type. Safe: existing row values are preserved as TEXT.

Run on Railway: `railway run psql -f packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`, then redeploy the API so the Prisma client regenerates and `seedCategoriesIfMissing()` inserts the default list on first boot.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Critical files

**Create:**
- `packages/db/prisma/migrations/add_ticket_category_admin/migration.sql`
- `apps/api/src/lib/support-tickets/categories.ts`
- `apps/api/src/routes/support-ticket-config.ts`
- `apps/web/lib/support-ticket-categories-client.ts`
- `apps/web/lib/category-catalog-context.tsx`
- `apps/web/app/support/layout.tsx`
- `apps/web/app/settings/support-tickets/page.tsx`

**Modify:**
- `packages/db/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/routes/tickets.ts`
- `apps/web/app/app-wrapper.tsx`
- `apps/web/app/settings/page.tsx`
- `apps/web/components/settings/settings-sidebar.tsx`
- `apps/web/components/support/submit-ticket-modal.tsx`
- `apps/web/components/support/ticket-admin-controls.tsx`
- `apps/web/components/support/ticket-category-pill.tsx`
- `apps/web/lib/tickets-client.ts`
