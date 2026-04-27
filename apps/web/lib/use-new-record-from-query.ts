'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { resolveLayoutForUser } from '@/lib/layout-resolver';
import type { ObjectDef } from '@/lib/schema';

interface UseNewRecordFromQueryArgs {
  objectDef: Pick<ObjectDef, 'pageLayouts'> | null | undefined;
  profileId: string | null | undefined;
  onOpen: (layoutId: string, prefill: Record<string, string>) => void;
}

/**
 * Reads `?new=true&<field>=<value>...` from the URL and opens a create form
 * pre-filled with the supplied query params. Used to receive navigation from
 * the Related List widget's "+ New" button.
 *
 * Clears the query string after firing so refreshing the page won't re-open
 * the dialog. The handler runs at most once per query-string visit.
 */
export function useNewRecordFromQuery({
  objectDef,
  profileId,
  onOpen,
}: UseNewRecordFromQueryArgs) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (searchParams.get('new') !== 'true' || !objectDef) return;

    const result = resolveLayoutForUser(objectDef, { profileId: profileId ?? null });
    if (result.kind !== 'resolved') return;

    const prefill: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'new') prefill[key] = value;
    });

    firedRef.current = true;
    onOpen(result.layout.id, prefill);
    router.replace(pathname, { scroll: false });
  }, [searchParams, objectDef, profileId, pathname, router, onOpen]);
}
