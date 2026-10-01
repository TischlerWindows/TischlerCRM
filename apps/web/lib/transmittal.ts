export const SUBMITTED_FOR = ['Approval', 'Your Information', 'Your Action', 'Your Review', 'Return of Goods'] as const
export const DELIVERY_METHODS = ['Messenger', 'Overnight', '2nd Day Air', 'UPS Ground', 'U.S. Postal Service'] as const

export interface TransmittalRow {
  qty: string
  description: string
  code: string
}

export interface Transmittal {
  date: string
  submittedFor: string
  to: string
  attn: string
  re: string
  submittedBy: string
  deliveryVia: string
  rows: TransmittalRow[]
  approvalInstructions: string
  remarks: string
  copiesTo: string
  signature: string
}

export const DEFAULT_APPROVAL_INSTRUCTIONS = 'For Approval - Sign the label on the back of the samples and send pictures for the record'

export function parseTransmittal(raw: unknown): Transmittal {
  let data: Record<string, unknown> = {}
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (value && typeof value === 'object' && !Array.isArray(value)) data = value as Record<string, unknown>
  } catch { /* An invalid saved document starts a fresh form. */ }
  const text = (value: unknown) => typeof value === 'string' ? value : ''
  const rows = Array.isArray(data.rows) ? data.rows.slice(0, 30).map((row: unknown) => {
    const value = row && typeof row === 'object' ? row as Record<string, unknown> : {}
    return { qty: text(value.qty), description: text(value.description), code: text(value.code) }
  }) : []
  return {
    date: text(data.date), submittedFor: text(data.submittedFor) || 'Approval',
    to: text(data.to), attn: text(data.attn), re: text(data.re),
    submittedBy: typeof data.submittedBy === 'string' ? data.submittedBy : 'Michel Marclay',
    deliveryVia: text(data.deliveryVia) || 'UPS Ground',
    rows: rows.length ? rows : Array.from({ length: 3 }, () => ({ qty: '', description: '', code: '' })),
    approvalInstructions: typeof data.approvalInstructions === 'string' ? data.approvalInstructions : DEFAULT_APPROVAL_INSTRUCTIONS,
    remarks: text(data.remarks), copiesTo: text(data.copiesTo), signature: text(data.signature),
  }
}