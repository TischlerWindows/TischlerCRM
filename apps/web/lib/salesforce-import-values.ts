import type { SalesforceCheckboxImportRule } from './salesforce-import-templates'

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
