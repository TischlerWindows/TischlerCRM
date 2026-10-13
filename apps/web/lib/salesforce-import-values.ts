export function parseSalesforceCheckbox(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value === null || value === undefined) return false;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return !['false', '0', 'no', 'n', 'off', 'unchecked'].includes(normalized);
}
