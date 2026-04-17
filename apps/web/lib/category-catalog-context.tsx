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
