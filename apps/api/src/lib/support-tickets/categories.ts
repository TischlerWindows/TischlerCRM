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

export type TicketCategory = z.infer<typeof categorySchema>;

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
 * Idempotent seeder. Called once on API boot from buildApp(). Atomically
 * inserts the defaults if the row is missing; leaves admin edits untouched
 * via the empty `update: {}`. Safe under concurrent boots — no find-then-
 * create race, no duplicate-key errors in logs.
 */
export async function seedCategoriesIfMissing(): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    update: {},
    create: {
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
