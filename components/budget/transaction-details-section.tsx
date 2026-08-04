import { Checkbox } from "@/components/ui/checkbox"
import { TransactionNotesField } from "@/components/budget/transaction-notes-field"
import type { RecurringBillingType } from "@/lib/api/types"
import type { RecurringEditScope } from "./transaction-editor-types"
import { TransactionRecurringControls } from "./transaction-recurring-controls"

interface TransactionDetailsSectionProps {
  isSplit: boolean
  onSplitChange: (value: boolean) => void
  notes: string
  notesError: string | null
  onNotesChange: (value: string) => void
  canCreateRecurringRule: boolean
  makeRecurring: boolean
  onMakeRecurringChange: (value: boolean) => void
  recurringBillingType: RecurringBillingType
  onBillingTypeChange: (value: RecurringBillingType) => void
  recurringBillingDay: string
  onBillingDayChange: (value: string) => void
  isEditMode: boolean
  transactionAlreadyRecurring: boolean
  recurringEditScope: RecurringEditScope
  onEditScopeChange: (value: RecurringEditScope) => void
  onScheduleTouched: () => void
  shouldInitializeSchedule: (nextValue: boolean) => boolean
  onInitializeSchedule: () => void
}

export function TransactionDetailsSection({
  isSplit, onSplitChange, notes, notesError, onNotesChange,
  ...recurringProps
}: TransactionDetailsSectionProps) {
  return (
    <>
      <div className="rounded-xl border border-border/60 p-3">
        <label className="flex cursor-pointer items-center gap-3">
          <Checkbox checked={isSplit} onCheckedChange={(checked) => onSplitChange(Boolean(checked))} />
          <div>
            <p className="text-sm font-medium">Split expense</p>
            <p className="text-xs text-muted-foreground">Marks this transaction as your portion of a shared expense.</p>
          </div>
        </label>
      </div>
      <TransactionRecurringControls {...recurringProps} />
      <div className="space-y-2">
        <TransactionNotesField value={notes} onChange={onNotesChange} error={notesError} />
      </div>
    </>
  )
}
