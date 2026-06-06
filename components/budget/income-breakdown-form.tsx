"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/formatters"
import {
  asNumber,
  calculateHourlyMonthlyIncome,
  calculateMonthlyIncome,
  type IncomeFormState,
} from "@/lib/income-breakdown"

interface IncomeBreakdownFormProps {
  value: IncomeFormState
  onChange: (value: IncomeFormState) => void
  disabled?: boolean
  idPrefix?: string
}

export function IncomeBreakdownForm({
  value,
  onChange,
  disabled = false,
  idPrefix = "income",
}: IncomeBreakdownFormProps) {
  const update = (patch: Partial<IncomeFormState>) => onChange({ ...value, ...patch })
  const primaryHourlyMonthly = calculateHourlyMonthlyIncome(value.primaryHourlyRate, value.primaryWeeklyHours)
  const sideHourlyMonthly = calculateHourlyMonthlyIncome(value.sideHourlyRate, value.sideWeeklyHours)
  const primaryMonthly =
    value.incomeSourceType === "monthly"
      ? asNumber(value.primaryMonthlyIncome)
      : primaryHourlyMonthly
  const sideMonthly =
    value.sideIncomeType === "monthly"
      ? asNumber(value.sideMonthlyIncome)
      : value.sideIncomeType === "hourly"
        ? sideHourlyMonthly
        : 0
  const monthlyTotal = calculateMonthlyIncome(value)
  const usesHourlyIncome = value.incomeSourceType === "hourly" || value.sideIncomeType === "hourly"
  const hasSideIncome = value.sideIncomeType !== "none"

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label>Main income</Label>
        <Tabs
          value={value.incomeSourceType}
          onValueChange={(nextValue) => update({ incomeSourceType: nextValue as IncomeFormState["incomeSourceType"] })}
        >
          <TabsList className="h-11 w-full rounded-xl">
            <TabsTrigger value="monthly" className="flex-1" disabled={disabled}>Monthly</TabsTrigger>
            <TabsTrigger value="hourly" className="flex-1" disabled={disabled}>Hourly</TabsTrigger>
          </TabsList>
        </Tabs>

        {value.incomeSourceType === "monthly" ? (
          <MoneyInput
            id={`${idPrefix}-primary-monthly`}
            label="Monthly take-home income"
            value={value.primaryMonthlyIncome}
            onChange={(primaryMonthlyIncome) => update({ primaryMonthlyIncome })}
            disabled={disabled}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput
              id={`${idPrefix}-primary-rate`}
              label="Hourly rate"
              value={value.primaryHourlyRate}
              onChange={(primaryHourlyRate) => update({ primaryHourlyRate })}
              disabled={disabled}
            />
            <NumberInput
              id={`${idPrefix}-primary-hours`}
              label="Hours/week"
              value={value.primaryWeeklyHours}
              onChange={(primaryWeeklyHours) => update({ primaryWeeklyHours })}
              disabled={disabled}
            />
            <p className="col-span-2 text-sm text-muted-foreground">
              Average monthly income: {formatCurrency(primaryHourlyMonthly)}
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <Label>Extra income</Label>
        <Tabs
          value={value.sideIncomeType}
          onValueChange={(nextValue) => update({ sideIncomeType: nextValue as IncomeFormState["sideIncomeType"] })}
        >
          <TabsList className="h-11 w-full rounded-xl">
            <TabsTrigger value="none" className="flex-1" disabled={disabled}>None</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1" disabled={disabled}>Monthly</TabsTrigger>
            <TabsTrigger value="hourly" className="flex-1" disabled={disabled}>Hourly</TabsTrigger>
          </TabsList>
        </Tabs>

        {value.sideIncomeType !== "none" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-side-label`}>Label</Label>
              <Input
                id={`${idPrefix}-side-label`}
                type="text"
                value={value.sideIncomeLabel}
                onChange={(event) => update({ sideIncomeLabel: event.target.value })}
                className="h-11 rounded-xl"
                placeholder="Babysitting, tutoring, gig work"
                disabled={disabled}
                maxLength={80}
              />
            </div>

            {value.sideIncomeType === "monthly" ? (
              <MoneyInput
                id={`${idPrefix}-side-monthly`}
                label="Average monthly side income"
                value={value.sideMonthlyIncome}
                onChange={(sideMonthlyIncome) => update({ sideMonthlyIncome })}
                disabled={disabled}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <MoneyInput
                  id={`${idPrefix}-side-rate`}
                  label="Hourly rate"
                  value={value.sideHourlyRate}
                  onChange={(sideHourlyRate) => update({ sideHourlyRate })}
                  disabled={disabled}
                />
                <NumberInput
                  id={`${idPrefix}-side-hours`}
                  label="Hours/week"
                  value={value.sideWeeklyHours}
                  onChange={(sideWeeklyHours) => update({ sideWeeklyHours })}
                  disabled={disabled}
                />
                <p className="col-span-2 text-sm text-muted-foreground">
                  Average monthly side income: {formatCurrency(sideHourlyMonthly)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/50 p-4">
        <p className="text-sm font-medium text-muted-foreground">Estimated monthly income</p>
        <p className="mt-1 text-3xl font-bold tracking-tight">
          {formatCurrency(monthlyTotal)} <span className="text-base font-medium text-muted-foreground">/ month</span>
        </p>
        {hasSideIncome && (
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCurrency(primaryMonthly)} main + {formatCurrency(sideMonthly)} extra.
          </p>
        )}
        {usesHourlyIncome && (
          <p className="mt-2 text-xs text-muted-foreground">
            Hourly income uses rate x weekly hours x 52 / 12.
          </p>
        )}
      </div>
    </div>
  )
}

interface NumericInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

function MoneyInput({ id, label, value, onChange, disabled }: NumericInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <Input
          id={id}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 rounded-xl pl-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function NumberInput({ id, label, value, onChange, disabled }: NumericInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        disabled={disabled}
      />
    </div>
  )
}
