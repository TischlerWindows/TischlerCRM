export interface SalesforceImportField {
  apiName: string
  label: string
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getSalesforceAccountTypeTarget(
  objectApiName: string,
  header: string,
  fields: SalesforceImportField[],
): string | null {
  if (objectApiName !== 'Account' || normalize(header) !== 'type') return null
  return fields.find((field) => normalize(field.apiName.replace(/^Account__/, '')) === 'accounttype')?.apiName ?? null
}

  export function getMappedSalesforceAccountTypeValue(
    row: Record<string, string>,
    columnMapping: Record<string, string>,
  ): string {
    for (const targetName of ['accounttype', 'type']) {
      const sourceColumn = Object.entries(columnMapping).find(([, target]) =>
        normalize(target.replace(/^Account__/, '')) === targetName,
      )?.[0]
      const value = sourceColumn ? row[sourceColumn]?.trim() : ''
      if (value) return value
    }
    return ''
  }

export function mirrorAccountTypeImportAliases(
  objectApiName: string,
  record: Record<string, unknown>,
): void {
  if (objectApiName !== 'Account') return
  const value = record.Account__accountType
    ?? record.accountType
    ?? record.Account__type
    ?? record.type
  if (value === undefined || value === null || String(value).trim() === '') return

  record.Account__accountType = value
  record.accountType = value
  record.Account__type = value
  record.type = value
}
