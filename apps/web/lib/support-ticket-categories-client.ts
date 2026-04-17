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
