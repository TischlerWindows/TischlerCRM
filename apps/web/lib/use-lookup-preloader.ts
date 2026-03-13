import { useState, useEffect } from 'react';
import { preloadLookupRecords } from '@/lib/utils';
import { useSchemaStore } from '@/lib/schema-store';

/**
 * Hook that preloads lookup records for an object definition's
 * Lookup / PicklistLookup / ExternalLookup / LookupUser fields,
 * then bumps a counter so the component re-renders with resolved labels.
 *
 * Usage:
 *   const lookupTick = useLookupPreloader(objectDef);
 *   // reference `lookupTick` in any render path that calls
 *   // resolveLookupDisplayName / formatFieldValue so React
 *   // knows to re-render after the cache is ready.
 */
export function useLookupPreloader(
  objectDef: { fields: { type: string; lookupObject?: string }[] } | null | undefined
): number {
  const [tick, setTick] = useState(0);
  const schema = useSchemaStore((s) => s.schema);

  useEffect(() => {
    if (!objectDef) return;

    // Build set of known object apiNames so we only preload valid objects
    const knownObjects = new Set<string>(
      (schema?.objects || []).map((o: any) => o.apiName)
    );
    knownObjects.add('User'); // always valid

    const targets = new Set<string>();
    // System fields always need User records
    targets.add('User');

    for (const field of objectDef.fields) {
      const t = field.type;
      if (
        (t === 'Lookup' || t === 'ExternalLookup' || t === 'LookupUser' || t === 'PicklistLookup') &&
        field.lookupObject &&
        knownObjects.has(field.lookupObject)
      ) {
        targets.add(field.lookupObject);
      }
      if (t === 'LookupUser') {
        targets.add('User');
      }
    }

    if (targets.size > 0) {
      Promise.all(Array.from(targets).map((t) => preloadLookupRecords(t))).then(() =>
        setTick((n) => n + 1)
      );
    }
  }, [objectDef, schema]);

  return tick;
}
