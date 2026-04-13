'use client'
import { TechExpenseCard } from './tech-expense-card'

interface TechniciansTabProps {
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyExpenses: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function TechniciansTab({ techExpenses, dirtyExpenses, onFieldChange }: TechniciansTabProps) {
  const entries = Object.entries(techExpenses)

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No technicians assigned yet.</p>
        <p className="text-xs mt-1">Use "Manage Technicians" in the toolbar to assign technicians.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {entries.map(([junctionId, { technician, expenses }]) => (
        <TechExpenseCard key={junctionId} junctionId={junctionId} technician={technician} expenses={expenses} dirtyExpenses={dirtyExpenses} onFieldChange={onFieldChange} />
      ))}
    </div>
  )
}
