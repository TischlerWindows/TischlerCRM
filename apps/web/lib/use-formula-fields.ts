'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import { evaluateFormula, extractCrossObjectRefs, ExpressionContext } from '@/lib/expressions';
import { FieldDef, ObjectDef } from '@/lib/schema';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';

/**
 * Cache for related record data fetched for cross-object formulas.
 * Key format: "ObjectApiName:recordId"
 */
const relatedRecordCache: Record<string, Record<string, any>> = {};
const relatedRecordPromises: Record<string, Promise<Record<string, any> | null>> = {};

async function fetchRelatedRecord(objectApiName: string, recordId: string): Promise<Record<string, any> | null> {
  const cacheKey = `${objectApiName}:${recordId}`;
  if (relatedRecordCache[cacheKey]) return relatedRecordCache[cacheKey];
  if (relatedRecordPromises[cacheKey]) return relatedRecordPromises[cacheKey];

  const promise = (async () => {
    try {
      // Handle User lookups specially
      if (objectApiName === 'User') {
        const users = await apiClient.get<any[]>('/admin/users');
        const user = (Array.isArray(users) ? users : []).find(u => String(u.id) === String(recordId));
        if (user) {
          relatedRecordCache[cacheKey] = user;
          return user;
        }
        return null;
      }

      const raw = await recordsService.getRecord(objectApiName, recordId);
      if (raw) {
        const flat = recordsService.flattenRecord(raw);
        relatedRecordCache[cacheKey] = flat;
        return flat;
      }
      return null;
    } catch {
      return null;
    } finally {
      delete relatedRecordPromises[cacheKey];
    }
  })();

  relatedRecordPromises[cacheKey] = promise;
  return promise;
}

/**
 * Resolve a field value from a related record's flat data, trying both
 * prefixed (ObjectName__fieldName) and bare (fieldName) keys.
 */
function getRelatedFieldValue(relatedRecord: Record<string, any>, targetField: string): any {
  // Direct match
  if (targetField in relatedRecord) return relatedRecord[targetField];

  // Try stripping object prefix from the target field
  const bare = targetField.replace(/^[A-Za-z]+__/, '');
  if (bare in relatedRecord) return relatedRecord[bare];

  // Try matching with any prefix
  for (const key of Object.keys(relatedRecord)) {
    const keyBare = key.replace(/^[A-Za-z]+__/, '');
    if (keyBare === bare || keyBare === targetField) return relatedRecord[key];
  }

  return undefined;
}

interface FormulaResults {
  /** Computed formula values keyed by field apiName */
  values: Record<string, any>;
  /** Whether any async fetches are still in progress */
  loading: boolean;
}

/**
 * Hook that evaluates all formula fields for a record, including cross-object references.
 *
 * Cross-object syntax: LookupFieldApiName.TargetFieldApiName
 * Example: If you have a Lookup field "primaryContact" pointing to Contact,
 * and you want the Contact's Phone, use: primaryContact.phone
 *
 * The hook:
 * 1. Finds all Formula fields in the object definition
 * 2. Extracts cross-object references (dot notation)
 * 3. Resolves the lookup field value (UUID) from the record
 * 4. Fetches the related record
 * 5. Builds a context with both local fields and resolved cross-object values
 * 6. Evaluates the formula expression
 */
export function useFormulaFields(
  objectDef: ObjectDef | undefined,
  record: Record<string, any> | null
): FormulaResults {
  const { schema } = useSchemaStore();
  const [resolvedRelated, setResolvedRelated] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  // Collect all formula fields from the object definition
  const formulaFields = useMemo(() => {
    if (!objectDef) return [];
    return objectDef.fields.filter(f => f.type === 'Formula' && f.formulaExpr);
  }, [objectDef]);

  // Extract all cross-object references from all formula fields
  const crossObjectRefs = useMemo(() => {
    const allRefs: { formulaField: string; lookupField: string; targetField: string }[] = [];
    for (const field of formulaFields) {
      const refs = extractCrossObjectRefs(field.formulaExpr!);
      for (const ref of refs) {
        allRefs.push({ formulaField: field.apiName, ...ref });
      }
    }
    return allRefs;
  }, [formulaFields]);

  // Find the lookup field definition and its target object for each cross-object ref
  const lookupTargets = useMemo(() => {
    if (!objectDef || !record) return [];

    const targets: { lookupFieldApiName: string; lookupObject: string; recordId: string; targetField: string }[] = [];
    const seen = new Set<string>();

    for (const ref of crossObjectRefs) {
      // Find the field definition for the lookup field referenced before the dot
      const lookupFieldDef = objectDef.fields.find(f => {
        const bare = f.apiName.replace(/^[A-Za-z]+__/, '');
        return f.apiName === ref.lookupField || bare === ref.lookupField;
      });

      if (!lookupFieldDef) continue;

      // Must be a lookup-type field
      const lookupTypes = ['Lookup', 'ExternalLookup', 'LookupUser', 'PicklistLookup'];
      if (!lookupTypes.includes(lookupFieldDef.type)) continue;

      const lookupObject = lookupFieldDef.lookupObject || (lookupFieldDef.type === 'LookupUser' ? 'User' : undefined);
      if (!lookupObject) continue;

      // Get the lookup value (UUID) from the record
      let lookupValue = record[lookupFieldDef.apiName] ?? record[lookupFieldDef.apiName.replace(/^[A-Za-z]+__/, '')];

      // PicklistLookup stores { picklist: '...', lookup: 'uuid' }
      if (lookupFieldDef.type === 'PicklistLookup' && typeof lookupValue === 'object' && lookupValue !== null) {
        lookupValue = lookupValue.lookup;
      }

      if (!lookupValue) continue;

      const key = `${lookupObject}:${lookupValue}`;
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({
          lookupFieldApiName: lookupFieldDef.apiName,
          lookupObject,
          recordId: String(lookupValue),
          targetField: ref.targetField,
        });
      }
    }

    return targets;
  }, [objectDef, record, crossObjectRefs]);

  // Fetch related records
  useEffect(() => {
    if (lookupTargets.length === 0) return;

    let cancelled = false;
    setLoading(true);

    Promise.all(
      lookupTargets.map(async (t) => {
        const related = await fetchRelatedRecord(t.lookupObject, t.recordId);
        return { key: `${t.lookupObject}:${t.recordId}`, data: related };
      })
    ).then((results) => {
      if (cancelled) return;
      const newResolved: Record<string, Record<string, any>> = {};
      for (const r of results) {
        if (r.data) newResolved[r.key] = r.data;
      }
      setResolvedRelated(newResolved);
      setLoading(false);
      setTick(n => n + 1);
    });

    return () => { cancelled = true; };
  }, [lookupTargets.map(t => `${t.lookupObject}:${t.recordId}`).join(',')]);

  // Evaluate all formula fields
  const values = useMemo(() => {
    if (!record || formulaFields.length === 0) return {};

    const results: Record<string, any> = {};

    for (const field of formulaFields) {
      const formula = field.formulaExpr!;

      // Build context with same-record fields (use bare apiName keys)
      const context: ExpressionContext = {};
      if (record) {
        for (const [key, val] of Object.entries(record)) {
          // Add both prefixed and bare keys to context
          context[key] = val as any;
          const bare = key.replace(/^[A-Za-z]+__/, '');
          if (bare !== key) context[bare] = val as any;
        }
      }

      // Add cross-object resolved values to context
      for (const ref of crossObjectRefs) {
        if (ref.formulaField !== field.apiName) continue;

        // Find the lookup field to get the related record ID
        const lookupFieldDef = objectDef?.fields.find(f => {
          const bare = f.apiName.replace(/^[A-Za-z]+__/, '');
          return f.apiName === ref.lookupField || bare === ref.lookupField;
        });
        if (!lookupFieldDef) continue;

        const lookupObject = lookupFieldDef.lookupObject || (lookupFieldDef.type === 'LookupUser' ? 'User' : undefined);
        if (!lookupObject) continue;

        let lookupValue = record[lookupFieldDef.apiName] ?? record[lookupFieldDef.apiName.replace(/^[A-Za-z]+__/, '')];
        if (lookupFieldDef.type === 'PicklistLookup' && typeof lookupValue === 'object' && lookupValue !== null) {
          lookupValue = lookupValue.lookup;
        }
        if (!lookupValue) continue;

        const cacheKey = `${lookupObject}:${lookupValue}`;
        const relatedRecord = resolvedRelated[cacheKey] || relatedRecordCache[cacheKey];
        if (relatedRecord) {
          const contextKey = `${ref.lookupField}.${ref.targetField}`;
          context[contextKey] = getRelatedFieldValue(relatedRecord, ref.targetField);
        }
      }

      // Evaluate
      const result = evaluateFormula(formula, context);
      results[field.apiName] = result;
    }

    void tick; // force recalc when related records finish loading
    return results;
  }, [record, formulaFields, objectDef, resolvedRelated, crossObjectRefs, tick]);

  return { values, loading };
}
