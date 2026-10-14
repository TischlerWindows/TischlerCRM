import type { SalesforceCheckboxImportRule } from './salesforce-import-templates'

export interface ImportUserLookupRecord {
  id: string
  name: string | null
  email: string
}

export function isUserLookupType(type: string): boolean {
  return type === 'LookupUser' || type === 'MultiLookupUser'
}

function normalizeUserLookupIdentity(value: string): string {
  return value.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
}

export function resolveUserLookupImportValue(
  sourceValue: string,
  users: ImportUserLookupRecord[],
  multiValue = false,
): { value: string; unmatched: string[] } {
  const sourceValues = (multiValue ? sourceValue.split(';') : [sourceValue])
    .map((value) => value.trim())
    .filter(Boolean)
  const matchedIds: string[] = []
  const unmatched: string[] = []

  for (const source of sourceValues) {
    const normalizedSource = normalizeUserLookupIdentity(source)
    const exactMatches = new Set(users.filter((user) =>
      [user.id, user.name ?? '', user.email].some((identity) =>
        normalizeUserLookupIdentity(identity) === normalizedSource,
      ),
    ).map((user) => user.id))
    let match = exactMatches.size === 1
      ? users.find((user) => user.id === exactMatches.values().next().value)
      : undefined

    if (exactMatches.size === 0 && normalizedSource.length >= 3) {
      const prefixMatches = new Set(users.filter((user) =>
        [user.name ?? '', user.email].some((identity) =>
          normalizeUserLookupIdentity(identity).startsWith(normalizedSource),
        ),
      ).map((user) => user.id))
      if (prefixMatches.size === 1) {
        match = users.find((user) => user.id === prefixMatches.values().next().value)
      }
    }

    if (match) {
      if (!matchedIds.includes(match.id)) matchedIds.push(match.id)
    } else {
      unmatched.push(source)
    }
  }

  return { value: multiValue ? matchedIds.join(';') : matchedIds[0] ?? '', unmatched }
}

export function parseSalesforceCheckbox(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === null || value === undefined) return false;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return !['false', '0', 'no', 'n', 'off', 'unchecked'].includes(normalized);
}

export function getDefaultSalesforcePhonePrefix(options: string[]): string {
  return getSalesforcePhonePrefixOptions(options).includes('Mobile')
    ? 'Mobile'
    : getSalesforcePhonePrefixOptions(options)[0] ?? 'Mobile'
}

export function getSalesforcePhonePrefixOptions(options: string[]): string[] {
  return options.length > 0 ? options : ['Mobile', 'Home', 'Work', 'Other']
}

export function mapSalesforcePhoneWithPrefix(value: unknown, prefix = 'Mobile'): { prefix: string; phone: string } | null {
  const rawPhone = value && typeof value === 'object' && 'phone' in value
    ? (value as { phone?: unknown }).phone
    : value;
  if (rawPhone === null || rawPhone === undefined) return null;
  const phone = String(rawPhone).trim();
  return phone ? { prefix, phone } : null;
}

export function evaluateSalesforceCheckboxRule(
  rule: SalesforceCheckboxImportRule,
  row: Record<string, string>,
): boolean {
  const hasValue = !!row[rule.sourceColumn]?.trim()
  return rule.condition === 'has-value' ? hasValue : !hasValue
}
