'use client'

import React, { useEffect } from 'react'
import type { PathTransitionField, TeamMemberSlotCriterion } from '@/lib/schema'
import { SlotInput } from './SlotInput'
import { useTeamMemberSlot } from './useTeamMemberSlot'

interface Props {
  parentObjectApiName: string
  parentRecordId: string | null
  tf: PathTransitionField
  /** Called whenever the row count for this criterion changes — true if at least one row matches. */
  onFilledChange: (filled: boolean) => void
}

function tfToCriterion(tf: PathTransitionField): TeamMemberSlotCriterion | null {
  if (tf.kind === 'teamMemberFlag' && tf.flag) {
    return { kind: 'flag', flag: tf.flag }
  }
  if (tf.kind === 'teamMemberRole' && tf.role) {
    return { kind: 'role', role: tf.role }
  }
  return null
}

function tfLabel(tf: PathTransitionField): string {
  if (tf.kind === 'teamMemberFlag') {
    switch (tf.flag) {
      case 'primaryContact': return 'Primary Contact'
      case 'contractHolder': return 'Contract Holder'
      case 'quoteRecipient': return 'Quote Recipient'
      default: return 'Connection'
    }
  }
  if (tf.kind === 'teamMemberRole' && tf.role) return tf.role
  return 'Connection'
}

/**
 * Renders a TeamMember-criterion transition field inside the path widget's
 * transition modal. The SlotInput writes directly to the TeamMember table
 * (or the pending pool in create mode), and `onFilledChange` reports whether
 * the criterion is satisfied so the modal's "Move to" button enables/disables.
 */
export default function PathTmTransitionField({
  parentObjectApiName,
  parentRecordId,
  tf,
  onFilledChange,
}: Props) {
  const criterion = tfToCriterion(tf)
  const { rows, fillSlot, clearRow } = useTeamMemberSlot({
    parentObjectApiName,
    parentRecordId,
    criterion: criterion ?? { kind: 'flag', flag: 'primaryContact' },
  })

  const filled = rows.length > 0
  useEffect(() => {
    onFilledChange(filled)
  }, [filled, onFilledChange])

  if (!criterion) return null

  const cardinality = tf.tmCardinality ?? 'single'
  const mode = tf.tmMode ?? 'paired'
  const bound = cardinality === 'single' ? rows[0] : undefined

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
        {tfLabel(tf)}
        {tf.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {bound ? (
        <SlotInput
          mode={mode}
          criterion={criterion}
          boundRow={bound}
          onFill={async () => { /* clear first to replace */ }}
          onClear={async () => { await clearRow(bound.id) }}
        />
      ) : (
        <SlotInput
          mode={mode}
          criterion={criterion}
          onFill={async (input) => { await fillSlot(input) }}
        />
      )}
    </div>
  )
}
