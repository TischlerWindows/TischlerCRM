'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import { evaluateFormula, extractCrossObjectRefs, expressionEngine, ExpressionContext } from '@/lib/expressions';
import { FieldDef, ObjectDef } from '@/lib/schema';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { getRecordName } from '../widgets/internal/shared/recordName';

/** Field types whose stored record value is a raw lookup id (or, for
 * MultiLookupUser, a semicolon-joined list of ids) rather than display text. */
const LOOKUP_FIELD_TYPES = new Set(['Lookup', 'ExternalLookup', 'LookupUser', 'MultiLookupUser', 'PicklistLookup']);

/** Display name for a related record fetched via fetchRelatedRecord — Users
 * are plain `{name, email, ...}` objects (not wrapped record data), so they
 * don't go through getRecordName's generic record-shape heuristics. */
function displayNameForRelated(objectApiName: string, related: Record<string, any> | undefined): string | undefined {
  if (!related) return undefined;
  if (objectApiName === 'User') return related.name || related.email || undefined;
  return getRecordName(related) || undefined;
}

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

  // Record ids to prefetch for formula fields that reference a Lookup-type
  // field BARE (no dot notation) — these need the related record's display
  // name, not its raw stored id/ids.
  const directLookupTargets = useMemo(() => {
    if (!objectDef || !record) return [];

    const referenced = new Set<string>();
    for (const field of formulaFields) {
      for (const ref of expressionEngine.getFieldReferences(field.formulaExpr!)) {
        if (ref.includes('.')) continue;
        referenced.add(ref);
        referenced.add(ref.replace(/^[A-Za-z]+__/, ''));
      }
    }

    const targets: { lookupObject: string; recordId: string }[] = [];
    const seen = new Set<string>();
    for (const fieldDef of objectDef.fields) {
      if (!LOOKUP_FIELD_TYPES.has(fieldDef.type)) continue;
      const bare = fieldDef.apiName.replace(/^[A-Za-z]+__/, '');
      if (!referenced.has(fieldDef.apiName) && !referenced.has(bare)) continue;

      const lookupObject = fieldDef.lookupObject || (fieldDef.type === 'LookupUser' || fieldDef.type === 'MultiLookupUser' ? 'User' : undefined);
      if (!lookupObject) continue;

      let raw = record[fieldDef.apiName] ?? record[bare];
      if (fieldDef.type === 'PicklistLookup' && typeof raw === 'object' && raw !== null) raw = raw.lookup;
      if (!raw) continue;

      const ids = fieldDef.type === 'MultiLookupUser' && typeof raw === 'string'
        ? raw.split(';').map((s: string) => s.trim()).filter(Boolean)
        : [String(raw)];
      for (const id of ids) {
        const key = `${lookupObject}:${id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({ lookupObject, recordId: id });
      }
    }
    return targets;
  }, [objectDef, record, formulaFields]);

  // Fetch related records
  useEffect(() => {
    const allTargets = [...lookupTargets, ...directLookupTargets];
    if (allTargets.length === 0) return;

    let cancelled = false;
    setLoading(true);

    Promise.all(
      allTargets.map(async (t) => {
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
  }, [[...lookupTargets, ...directLookupTargets].map(t => `${t.lookupObject}:${t.recordId}`).join(',')]);

  // Evaluate all formula fields
  const values = useMemo(() => {
    if (!record || formulaFields.length === 0) return {};
    const record_ = record; // narrowed non-null alias for use inside nested closures below

    const results: Record<string, any> = {};
    const inProgress = new Set<string>();

    // Which OTHER Formula fields (by apiName, both prefixed and bare forms)
    // are actually referenced by a given formula expression. Used to decide
    // which sibling formula fields need to be recursively resolved.
    //
    // IMPORTANT: this must be reference-scoped, not "resolve every formula
    // field on the object unconditionally" — the latter caused a real bug:
    // when Field A's resolution eagerly (and unnecessarily) computes
    // unrelated Field B, and B's formula happens to reference Field A (which
    // is still mid-computation, so it's in `inProgress`), the cycle guard
    // fires and B gets permanently memoized with a wrong/blank result — even
    // though A and B don't actually depend on each other. Only resolving
    // fields the formula truly references eliminates this false-positive-
    // cycle failure mode entirely.
    const getReferencedNames = (formulaExpr: string): Set<string> => {
      const names = new Set<string>();
      for (const ref of expressionEngine.getFieldReferences(formulaExpr)) {
        if (ref.includes('.')) continue; // cross-object ref, handled separately below
        names.add(ref);
        names.add(ref.replace(/^[A-Za-z]+__/, ''));
      }
      return names;
    };

    // Build context with same-record fields (use bare apiName keys), plus
    // every REFERENCED Formula field's computed value overlaid in. Formula
    // fields are never persisted in `record`, so a formula referencing
    // another formula field (e.g. EW_Expiration_Date__c referencing
    // Project__unconditional_expiration_date, itself a Formula) would
    // otherwise see `undefined` for that reference.
    //
    // Record data isn't consistent about which form a key is stored under —
    // some fields are saved bare (e.g. "wood_delivery_date") while the
    // field's real apiName (as referenced by formulas) is prefixed
    // ("Project__wood_delivery_date"). Only stripping a prefix off
    // already-prefixed keys never produces the prefixed alias for keys
    // stored bare, so formulas referencing the prefixed name silently
    // resolved to `undefined`. Add both directions.
    const buildContext = (excludeApiName: string, referencedNames: Set<string>): ExpressionContext => {
      const context: ExpressionContext = {};
      for (const [key, val] of Object.entries(record_)) {
        context[key] = val as any;
        const bare = key.replace(/^[A-Za-z]+__/, '');
        if (bare !== key) context[bare] = val as any;
        if (objectDef?.apiName) {
          const prefixed = `${objectDef.apiName}__${bare}`;
          if (!(prefixed in context) || context[prefixed] == null) context[prefixed] = val as any;
        }
      }
      for (const other of formulaFields) {
        if (other.apiName === excludeApiName) continue;
        const bare = other.apiName.replace(/^[A-Za-z]+__/, '');
        if (!referencedNames.has(other.apiName) && !referencedNames.has(bare)) continue;
        const value = computeField(other);
        context[other.apiName] = value as any;
        if (bare !== other.apiName) context[bare] = value as any;
      }

      // A formula referencing a Lookup-type field BARE (no dot notation,
      // e.g. `Project__internal_project_manager` instead of `.name`) would
      // otherwise see the raw stored id instead of a display name — resolve
      // it from the same related-record cache the cross-object refs use
      // (populated by the directLookupTargets fetch effect below).
      for (const fieldDef of objectDef?.fields ?? []) {
        if (!LOOKUP_FIELD_TYPES.has(fieldDef.type)) continue;
        const bare = fieldDef.apiName.replace(/^[A-Za-z]+__/, '');
        if (!referencedNames.has(fieldDef.apiName) && !referencedNames.has(bare)) continue;
        const lookupObject = fieldDef.lookupObject || (fieldDef.type === 'LookupUser' || fieldDef.type === 'MultiLookupUser' ? 'User' : undefined);
        if (!lookupObject) continue;
        let raw = context[fieldDef.apiName] ?? context[bare];
        if (fieldDef.type === 'PicklistLookup' && typeof raw === 'object' && raw !== null) raw = (raw as any).lookup;
        if (!raw) continue;
        const ids = fieldDef.type === 'MultiLookupUser' && typeof raw === 'string'
          ? raw.split(';').map((s) => s.trim()).filter(Boolean)
          : [String(raw)];
        const names = ids
          .map((id) => displayNameForRelated(lookupObject, resolvedRelated[`${lookupObject}:${id}`] || relatedRecordCache[`${lookupObject}:${id}`]))
          .filter((n): n is string => !!n);
        if (names.length === 0) continue;
        const resolved = names.join(', ');
        context[fieldDef.apiName] = resolved as any;
        if (bare !== fieldDef.apiName) context[bare] = resolved as any;
      }
      return context;
    };

    function computeField(field: FieldDef): any {
      if (field.apiName in results) return results[field.apiName];
      if (inProgress.has(field.apiName)) return undefined; // circular reference guard
      inProgress.add(field.apiName);

      const context = buildContext(field.apiName, getReferencedNames(field.formulaExpr!));

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

        let lookupValue = record_[lookupFieldDef.apiName] ?? record_[lookupFieldDef.apiName.replace(/^[A-Za-z]+__/, '')];
        if (lookupFieldDef.type === 'PicklistLookup' && typeof lookupValue === 'object' && lookupValue !== null) {
          lookupValue = lookupValue.lookup;
        }
        if (lookupValue) {
          const cacheKey = `${lookupObject}:${lookupValue}`;
          const relatedRecord = resolvedRelated[cacheKey] || relatedRecordCache[cacheKey];
          if (relatedRecord) {
            const contextKey = `${ref.lookupField}.${ref.targetField}`;
            context[contextKey] = getRelatedFieldValue(relatedRecord, ref.targetField);
          }
        }
      }

      const result = evaluateFormula(field.formulaExpr!, context);
      inProgress.delete(field.apiName);
      results[field.apiName] = result;
      return result;
    }

    for (const field of formulaFields) {
      computeField(field);
    }

    void tick; // force recalc when related records finish loading
    return results;
  }, [record, formulaFields, objectDef, resolvedRelated, crossObjectRefs, tick]);

  return { values, loading };
}
