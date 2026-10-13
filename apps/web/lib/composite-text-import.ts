export function mapCompositeTextSubField(
  objectApiName: string,
  targetApiName: string,
  value: string,
): Record<string, unknown> | null {
  const separatorIndex = targetApiName.indexOf('::');
  if (separatorIndex < 0 || !value.trim()) return null;

  const parentField = targetApiName.slice(0, separatorIndex);
  const subFieldKey = targetApiName.slice(separatorIndex + 2);
  const parentKey = `${objectApiName}__${parentField}`;
  const subFieldBare = subFieldKey.slice(subFieldKey.lastIndexOf('_') + 1);
  const result: Record<string, unknown> = {
    [subFieldKey]: value,
    [parentKey]: { [subFieldKey]: value },
  };
  const standaloneKey = `${objectApiName}__${subFieldBare}`;
  if (standaloneKey !== subFieldKey) result[standaloneKey] = value;
  return result;
}

export function mergeCompositeTextSubField(
  target: Record<string, unknown>,
  objectApiName: string,
  targetApiName: string,
  value: string,
): void {
  const compositeData = mapCompositeTextSubField(objectApiName, targetApiName, value);
  if (!compositeData) return;

  const parentKey = `${objectApiName}__${targetApiName.slice(0, targetApiName.indexOf('::'))}`;
  const { [parentKey]: compositeParent, ...flatValues } = compositeData;
  target[parentKey] = {
    ...(target[parentKey] as Record<string, unknown> | undefined),
    ...(compositeParent as Record<string, unknown>),
  };
  Object.assign(target, flatValues);
}

export function mapContactFullName(value: string): Record<string, unknown> {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};

  const firstName = parts.shift()!;
  const lastName = parts.join(' ');
  const mapped: Record<string, unknown> = {};
  mergeCompositeTextSubField(mapped, 'Contact', 'name::Contact__name_firstName', firstName);
  if (lastName) mergeCompositeTextSubField(mapped, 'Contact', 'name::Contact__name_lastName', lastName);
  return mapped;
}