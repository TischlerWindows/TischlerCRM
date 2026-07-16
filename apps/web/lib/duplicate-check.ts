// Lightweight client-side duplicate detection for the Object Manager's
// "Don't Allow Duplicates" feature. Compares a candidate record's values
// for a set of configured fields against existing records, flagging both
// exact matches (normalized case/whitespace/punctuation) and "close" matches
// (fuzzy, via normalized Levenshtein similarity).

export interface DuplicateMatchField {
  apiName: string;
  label: string;
}

export interface DuplicateMatch {
  recordId: string;
  /** Best display label for the matched record (falls back to the matched value). */
  recordLabel: string;
  fieldApiName: string;
  fieldLabel: string;
  matchType: 'exact' | 'close';
  candidateValue: string;
  existingValue: string;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const prevRow = new Array<number>(n + 1);
  const currRow = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prevRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) prevRow[j] = currRow[j];
  }
  return prevRow[n];
}

/** 1.0 = identical, 0.0 = completely different. */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const distance = levenshteinDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/** Fuzzy matches at or above this similarity are flagged as "close" duplicates. */
const CLOSE_MATCH_THRESHOLD = 0.85;

function readFieldValue(record: Record<string, any>, apiName: string): string {
  const bare = apiName.replace(/^[A-Za-z]+__/, '');
  const raw = record[apiName] ?? record[bare];
  if (raw == null) return '';
  if (typeof raw === 'object') return '';
  return String(raw).trim();
}

/**
 * Finds exact/close duplicate matches for `candidate` among `existingRecords`,
 * comparing the given `matchFields`. Returns at most one match per
 * (record, field) pair — an exact match takes priority over a close one.
 */
export function findDuplicates(
  candidate: Record<string, any>,
  existingRecords: Array<Record<string, any>>,
  matchFields: DuplicateMatchField[],
  options?: { excludeRecordId?: string; labelField?: string },
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const excludeId = options?.excludeRecordId;
  const labelField = options?.labelField;

  for (const record of existingRecords) {
    const recordId = String(record.id ?? '');
    if (excludeId && recordId === excludeId) continue;

    for (const field of matchFields) {
      const candidateValue = readFieldValue(candidate, field.apiName);
      const existingValue = readFieldValue(record, field.apiName);
      if (!candidateValue || !existingValue) continue;

      const normCandidate = normalize(candidateValue);
      const normExisting = normalize(existingValue);
      const recordLabel = (labelField && readFieldValue(record, labelField)) || existingValue;

      if (normCandidate === normExisting) {
        matches.push({
          recordId,
          recordLabel,
          fieldApiName: field.apiName,
          fieldLabel: field.label,
          matchType: 'exact',
          candidateValue,
          existingValue,
        });
        continue;
      }

      const sim = similarity(candidateValue, existingValue);
      if (sim >= CLOSE_MATCH_THRESHOLD) {
        matches.push({
          recordId,
          recordLabel,
          fieldApiName: field.apiName,
          fieldLabel: field.label,
          matchType: 'close',
          candidateValue,
          existingValue,
        });
      }
    }
  }

  return matches;
}
