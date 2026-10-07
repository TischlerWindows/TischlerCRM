import { recordsService, type RecordData } from './records-service'

export function snapshotGridRows(rows: RecordData[]): RecordData[] {
  return rows.map(row => ({ ...row, data: { ...row.data } }))
}

export function buildGridRestorePatch(
  current: Pick<RecordData, 'data'>,
  previous: Pick<RecordData, 'data'>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const keys = new Set([...Object.keys(current.data ?? {}), ...Object.keys(previous.data ?? {})])
  for (const key of keys) {
    const currentValue = current.data?.[key]
    const previousValue = previous.data?.[key]
    if (!Object.is(currentValue, previousValue)) patch[key] = previousValue ?? ''
  }
  return patch
}

export async function restoreGridRows(
  objectApiName: string,
  currentRows: RecordData[],
  previousRows: RecordData[],
): Promise<RecordData[]> {
  const previousById = new Map(previousRows.map(row => [row.id, row]))
  const restoredRows: RecordData[] = []

  for (const current of currentRows) {
    const previous = previousById.get(current.id)
    if (!previous) {
      await recordsService.deleteRecord(objectApiName, current.id)
      continue
    }
    const patch = buildGridRestorePatch(current, previous)
    if (!Object.keys(patch).length) {
      restoredRows.push(previous)
      continue
    }
    const updated = await recordsService.updateRecord(objectApiName, previous.id, { data: patch })
    restoredRows.push(updated ?? previous)
  }

  const previousIds = new Set(previousRows.map(row => row.id))
  for (const current of currentRows) {
    if (!previousIds.has(current.id)) await recordsService.deleteRecord(objectApiName, current.id)
  }

  return restoredRows
}
