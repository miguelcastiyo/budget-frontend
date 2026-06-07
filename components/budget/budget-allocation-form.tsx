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
  const percentDelta = percentTotal - 100
  const isPercentValid = isPercentAllocationValid(value)
  const isAmountValid = isAmountAllocationValid(value, income)
  const update = (patch: Partial<BudgetAllocationFormState>) => onChange({ ...value, ...patch })
  const validationMessage =
    value.allocationMode === "percent"
      ? percentValidationMessage(percentTotal)
      : amountValidationMessage(amountTotal, income, amountDelta)

  return (
    <Tabs
      value={value.allocationMode}
      onValueChange={(nextValue) => onChange(withAllocationMode(value, nextValue as BudgetAllocationFormState["allocationMode"], income))}
    >
      <TabsList className="w-full mb-4 h-11 rounded-xl">
        <TabsTrigger value="percent" className="flex-1" disabled={disabled}>By Percentage</TabsTrigger>
        <TabsTrigger value="amount" className="flex-1" disabled={disabled}>By Amount</TabsTrigger>
      </TabsList>

      <AllocationSummaryBar value={value} />

      <TabsContent value="percent" className="space-y-4">
        <AllocationInput
          id="allocation-needs-percent"
          label="Needs"
          value={value.needsPercent}
          onChange={(needsPercent) => update({ needsPercent })}
          suffix="%"
          color="bg-needs"
          subtext={`${formatCurrency((asNumber(value.needsPercent) / 100) * income)} target`}
          disabled={disabled}
        />
        <AllocationInput
          id="allocation-wants-percent"
          label="Wants"
          value={value.wantsPercent}
          onChange={(wantsPercent) => update({ wantsPercent })}
          suffix="%"
          color="bg-wants"
          subtext={`${formatCurrency((asNumber(value.wantsPercent) / 100) * income)} target`}
          disabled={disabled}
        />
        <AllocationInput
          id="allocation-savings-percent"
          label="Savings"
          value={value.savingsPercent}
          onChange={(savingsPercent) => update({ savingsPercent })}
          suffix="%"
          color="bg-savings"
          subtext={`${formatCurrency((asNumber(value.savingsPercent) / 100) * income)} target`}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isPercentValid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}
          role="status"
          aria-live="polite"
        >
          {validationMessage}
          {!isPercentValid && percentDelta !== 0 && (
            <span className="sr-only">
              {percentDelta < 0
                ? `${Math.abs(percentDelta).toFixed(0)} percent left to assign.`
                : `Reduce by ${percentDelta.toFixed(0)} percent.`}
            </span>
          )}
        </div>
      </TabsContent>

      <TabsContent value="amount" className="space-y-4">
        <AllocationInput
          id="allocation-needs-amount"
          label="Needs"
          value={value.needsAmount}
          onChange={(needsAmount) => update({ needsAmount })}
          prefix="$"
          color="bg-needs"
          subtext={`${income > 0 ? ((asNumber(value.needsAmount) / income) * 100).toFixed(0) : "0"}% target`}
          disabled={disabled}
        />
        <AllocationInput
          id="allocation-wants-amount"
          label="Wants"
          value={value.wantsAmount}
          onChange={(wantsAmount) => update({ wantsAmount })}
          prefix="$"
          color="bg-wants"
          subtext={`${income > 0 ? ((asNumber(value.wantsAmount) / income) * 100).toFixed(0) : "0"}% target`}
          disabled={disabled}
        />
        <AllocationInput
          id="allocation-savings-amount"
          label="Savings"
          value={value.savingsAmount}
          onChange={(savingsAmount) => update({ savingsAmount })}
          prefix="$"
          color="bg-savings"
          subtext={`${income > 0 ? ((asNumber(value.savingsAmount) / income) * 100).toFixed(0) : "0"}% target`}
          disabled={disabled}
        />

        <div className={cn(
          "p-3 rounded-xl text-center text-sm",
          isAmountValid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
        )}>
          {validationMessage}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function percentValidationMessage(percentTotal: number): string {
  const delta = percentTotal - 100

  if (Math.abs(delta) < 0.01) {
    return `Total: ${percentTotal.toFixed(0)}%`
  }

  if (delta < 0) {
    return `Total: ${percentTotal.toFixed(0)}% · ${Math.abs(delta).toFixed(0)}% left to assign`
  }

  return `Total: ${percentTotal.toFixed(0)}% · reduce by ${delta.toFixed(0)}%`
}

function amountValidationMessage(amountTotal: number, income: number, amountDelta: number): string {
  if (Math.abs(amountDelta) < 0.01) {
    return `Total: ${formatCurrency(amountTotal)}`
  }

  if (amountDelta < 0) {
    return `Total: ${formatCurrency(amountTotal)} · ${formatCurrency(Math.abs(amountDelta))} left to assign`
  }

  return `Total: ${formatCurrency(amountTotal)} · ${formatCurrency(amountDelta)} over budget`
}

function AllocationSummaryBar({ value }: { value: BudgetAllocationFormState }) {
  const needs = value.allocationMode === "percent" ? asNumber(value.needsPercent) : asNumber(value.needsAmount)
  const wants = value.allocationMode === "percent" ? asNumber(value.wantsPercent) : asNumber(value.wantsAmount)
  const savings = value.allocationMode === "percent" ? asNumber(value.savingsPercent) : asNumber(value.savingsAmount)
  const total = needs + wants + savings

  const segments = [
    { key: "needs", label: "Needs", value: needs, className: "bg-needs" },
    { key: "wants", label: "Wants", value: wants, className: "bg-wants" },
    { key: "savings", label: "Savings", value: savings, className: "bg-savings" },
  ]

  return (
    <div className="mb-5 rounded-2xl border border-border/70 bg-muted/30 p-3">
      <div
        className="flex h-3 overflow-hidden rounded-full bg-muted"
        aria-label="Budget allocation split across Needs, Wants, and Savings"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={cn(segment.className, "min-w-0 transition-all")}
            style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        {segments.map((segment) => (
          <div key={segment.key} className="min-w-0">
            <span className={cn("mr-1 inline-block h-2 w-2 rounded-full", segment.className)} aria-hidden="true" />
            <span className="truncate align-middle">{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface AllocationInputProps {
  id: string
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
  id,
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
        <Label htmlFor={id} className="text-sm text-muted-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{subtext}</p>
      </div>
      <div className="relative w-28">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{prefix}</span>
        )}
        <Input
          id={id}
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
