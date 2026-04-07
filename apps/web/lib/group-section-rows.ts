/**
 * Group layout sections into horizontal rows for builder + runtime.
 * Sections without `layoutRowId` each get their own full-width row.
 * Consecutive sections sharing the same `layoutRowId` form one row (sorted by `order`).
 */
export function groupSectionsIntoRows<T extends { order: number; layoutRowId?: string }>(
  sections: T[],
): T[][] {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const rows: T[][] = [];
  let current: T[] = [];
  let currentKey: string | undefined;

  const flush = () => {
    if (current.length) {
      rows.push(current);
      current = [];
    }
    currentKey = undefined;
  };

  for (const s of sorted) {
    if (s.layoutRowId == null || s.layoutRowId === '') {
      flush();
      rows.push([s]);
      continue;
    }
    if (currentKey === s.layoutRowId) {
      current.push(s);
    } else {
      flush();
      currentKey = s.layoutRowId;
      current = [s];
    }
  }
  flush();
  return rows;
}
