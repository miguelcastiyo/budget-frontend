"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/formatters"
import { cn } from "@/lib/utils"
import {
  isAmountAllocationValid,
  isPercentAllocationValid,
  totalAmount,
  totalPercent,
  withAllocationMode,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import { asNumber } from "@/lib/income-breakdown"

interface BudgetAllocationFormProps {
  value: BudgetAllocationFormState
  income: number
  onChange: (value: BudgetAllocationFormState) => void
  disabled?: boolean
}

export function BudgetAllocationForm({
  value,
  income,
  onChange,
  disabled = false,
}: BudgetAllocationFormProps) {
  const percentTotal = totalPercent(value)
  const amountTotal = totalAmount(value)
  const amountDelta = amountTotal - income
  const isPercentValid = isPercentAllocationValid(value)
  const isAmountValid = isAmountAllocationValid(value, income)
  const isAmountOver = amountDelta > 0.01
  const isAmountUnder = amountDelta < -0.01
  const update = (patch: Partial<BudgetAllocationFormState>) => onChange({ ...value, ...patch })

  return (
    <Tabs
      value={value.allocationMode}
      onValueChange={(nextValue) => onChange(withAllocationMode(value, nextValue as BudgetAllocationFormState["allocationMode"], income))}
    >
      <TabsList className="w-full mb-4">
        <TabsTrigger value="percent" className="flex-1" disabled={disabled}>By Percentage</TabsTrigger>
        <TabsTrigger value="amount" className="flex-1" disabled={disabled}>By Amount</TabsTrigger>
      </TabsList>

      <TabsContent value="percent" className="space-y-4">
        <AllocationInput
          label="Needs"
          value={value.needsPercent}
          onChange={(needsPercent) => update({ needsPercent })}
          suffix="%"
          color="bg-needs"
          subtext={formatCurrency((asNumber(value.needsPercent) / 100) * income)}
          disabled={disabled}
        />
        <AllocationInput
          label="Wants"
          value={value.wantsPercent}
          onChange={(wantsPercent) => update({ wantsPercent })}
          suffix="%"
          color="bg-wants"
          subtext={formatCurrency((asNumber(value.wantsPercent) / 100) * income)}
          disabled={disabled}
        />
        <AllocationInput
          label="Savings & Debts"
          value={value.savingsPercent}
          onChange={(savingsPercent) => update({ savingsPercent })}
          suffix="%"
          color="bg-savings"
          subtext={formatCurrency((asNumber(value.savingsPercent) / 100) * income)}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isPercentValid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
        )}>
          Total: {percentTotal.toFixed(0)}%
          {!isPercentValid && " (must equal 100%)"}
        </div>
      </TabsContent>

      <TabsContent value="amount" className="space-y-4">
        <AllocationInput
          label="Needs"
          value={value.needsAmount}
          onChange={(needsAmount) => update({ needsAmount })}
          prefix="$"
          color="bg-needs"
          subtext={`${income > 0 ? ((asNumber(value.needsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />
        <AllocationInput
          label="Wants"
          value={value.wantsAmount}
          onChange={(wantsAmount) => update({ wantsAmount })}
          prefix="$"
          color="bg-wants"
          subtext={`${income > 0 ? ((asNumber(value.wantsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />
        <AllocationInput
          label="Savings & Debts"
          value={value.savingsAmount}
          onChange={(savingsAmount) => update({ savingsAmount })}
          prefix="$"
          color="bg-savings"
          subtext={`${income > 0 ? ((asNumber(value.savingsAmount) / income) * 100).toFixed(0) : "0"}%`}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isAmountValid ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
        )}>
          Total: {formatCurrency(amountTotal)}
          {!isAmountValid && (
            isAmountOver
              ? ` (${formatCurrency(amountDelta)} over ${formatCurrency(income)})`
              : isAmountUnder
                ? ` (${formatCurrency(Math.abs(amountDelta))} under ${formatCurrency(income)})`
                : ` (must equal ${formatCurrency(income)})`
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

interface AllocationInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  prefix?: string
  suffix?: string
  color: string
  subtext: string
  disabled?: boolean
}

function AllocationInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  color,
  subtext,
  disabled = false,
}: AllocationInputProps) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-4 h-4 rounded-full ${color}`} />
      <div className="flex-1">
        <Label className="text-sm text-muted-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>
      <div className="relative w-28">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>
        )}
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-10 rounded-xl text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            prefix && "pl-6",
            suffix && "pr-8"
          )}
          disabled={disabled}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  )
}
