'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type ReasonModalMode = 'hold' | 'cancel'

const HOLD_REASONS = [
  'Waiting on Parts',
  'Waiting on Materials',
  'Weather Delay',
  'Customer Delay',
  'Warranty Decision Pending',
  'Subcontractor Delay',
  'Tech Unavailable',
  'Other',
]

const CANCEL_REASONS = [
  'Customer Cancelled',
  'Duplicate Work Order',
  'Issue Resolved',
  'Covered Under Different WO',
  'Warranty Denied',
  'Not Reproducible',
  'Other',
]

interface Props {
  open: boolean
  mode: ReasonModalMode
  onConfirm: (reason: string, notes: string) => void
  onCancel: () => void
}

export function WorkOrderReasonModal({ open, mode, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const title = mode === 'hold' ? 'Put Work Order On Hold' : 'Cancel Work Order'
  const reasons = mode === 'hold' ? HOLD_REASONS : CANCEL_REASONS
  const confirmLabel = mode === 'hold' ? 'Put On Hold' : 'Cancel WO'
  const confirmVariant: 'default' | 'destructive' = mode === 'hold' ? 'default' : 'destructive'

  const handleConfirm = () => {
    if (!reason) return
    onConfirm(reason, notes)
    setReason('')
    setNotes('')
  }

  const handleCancel = () => {
    setReason('')
    setNotes('')
    onCancel()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
            >
              <option value="" disabled>Select a reason</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancel</Button>
          <Button variant={confirmVariant} onClick={handleConfirm} disabled={!reason}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
