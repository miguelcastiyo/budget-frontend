import type { RecurringBillingType } from "@/lib/api/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { RecurringEditScope } from "./transaction-editor-types"

interface RecurringControlsProps {
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

export function TransactionRecurringControls({
  canCreateRecurringRule,
  makeRecurring,
  onMakeRecurringChange,
  recurringBillingType,
  onBillingTypeChange,
  recurringBillingDay,
  onBillingDayChange,
  isEditMode,
  transactionAlreadyRecurring,
  recurringEditScope,
  onEditScopeChange,
  onScheduleTouched,
  shouldInitializeSchedule,
  onInitializeSchedule,
}: RecurringControlsProps) {
  return (
    <>
      {canCreateRecurringRule && (
        <div className="space-y-2.5 rounded-xl border border-border/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <Label className="text-sm font-medium">Make recurring</Label>
              <p className="text-xs text-muted-foreground">Automatically add this every month</p>
            </div>
            <Switch
              checked={makeRecurring}
              onCheckedChange={(checked) => {
                onMakeRecurringChange(checked)
                if (shouldInitializeSchedule(checked)) onInitializeSchedule()
              }}
            />
          </div>
          {makeRecurring && (
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">Schedule</Label>
              <Select value={recurringBillingType} onValueChange={(value) => { onScheduleTouched(); onBillingTypeChange(value as RecurringBillingType) }}>
                <SelectTrigger aria-label="Choose recurring schedule" className="mt-1.5 h-11 w-full min-w-0 rounded-xl border-border/60 text-left">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-2rem)]">
                  <SelectItem value="day_of_month">Specific day each month</SelectItem>
                  <SelectItem value="last_day">Last day of each month</SelectItem>
                </SelectContent>
              </Select>
              {recurringBillingType === "day_of_month" && (
                <div className="mt-2">
                  <Label htmlFor="recurring-billing-day" className="text-xs text-muted-foreground">Day of month</Label>
                  <Input id="recurring-billing-day" type="text" inputMode="numeric" pattern="[0-9]*" enterKeyHint="done" value={recurringBillingDay} onChange={(event) => { onScheduleTouched(); onBillingDayChange(event.target.value) }} placeholder="1-31" className="mt-1.5 h-11 w-full rounded-xl border-border/60 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {isEditMode && transactionAlreadyRecurring && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Apply changes to</p>
            <p className="text-xs text-muted-foreground">Past transactions stay unchanged.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {([["transaction", "This transaction only"], ["future", "This and future recurring transactions"]] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => onEditScopeChange(value)} className={cn("rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors", recurringEditScope === value ? "border-primary bg-primary/10 text-foreground" : "border-border/60 bg-background text-muted-foreground hover:text-foreground")} aria-pressed={recurringEditScope === value}>{label}</button>
            ))}
          </div>
          {recurringEditScope === "future" && <p className="text-xs text-muted-foreground">Description, amount, category, tag, and card will apply from next month. Date, notes, and split status stay on this transaction.</p>}
        </div>
      )}
    </>
  )
}
