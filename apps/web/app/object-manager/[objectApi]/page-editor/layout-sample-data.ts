import type { FieldDef } from '@/lib/schema';

/**
 * Deterministic sample values for layout preview (form context).
 */
export function buildSampleRecordFromFields(fields: FieldDef[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (data[f.apiName] !== undefined) continue;
    switch (f.type) {
      case 'Checkbox':
        data[f.apiName] = false;
        break;
      case 'Number':
      case 'Currency':
      case 'Percent':
        data[f.apiName] = 0;
        break;
      case 'Date':
      case 'DateTime':
      case 'Time':
        data[f.apiName] = '';
        break;
      case 'Picklist':
      case 'PicklistText':
        data[f.apiName] = f.picklistValues?.[0] ?? '';
        break;
      case 'MultiPicklist':
      case 'MultiSelectPicklist':
        data[f.apiName] = [];
        break;
      default:
        data[f.apiName] = '';
    }
  }
  return data;
}
