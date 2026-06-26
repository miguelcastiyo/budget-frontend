import type { BudgetSettings } from "@/lib/api/types"
import {
  budgetSettingsPayload,
  hydrateBudgetAllocationForm,
  type BudgetAllocationFormState,
} from "@/lib/budget-allocation"
import {
  asNumber,
  calculateHourlyMonthlyIncome,
  hydrateIncomeForm,
  toDecimalString,
  type IncomeFormState,
} from "@/lib/income-breakdown"

export type AllocationKey = "needs" | "wants" | "savings"

export function createBudgetFormState(settings: BudgetSettings): {
  incomeForm: IncomeFormState
  allocationForm: BudgetAllocationFormState
} {
  return {
    incomeForm: hydrateIncomeForm(settings),
    allocationForm: hydrateBudgetAllocationForm(settings),
  }
}

export function serializeBudgetFormState(
  incomeForm: IncomeFormState,
  allocationForm: BudgetAllocationFormState
): string {
  return JSON.stringify(budgetSettingsPayload(incomeForm, allocationForm))
}

export function getPrimaryIncomeAmount(incomeForm: IncomeFormState): number {
  return incomeForm.incomeSourceType === "monthly"
    ? asNumber(incomeForm.primaryMonthlyIncome)
    : calculateHourlyMonthlyIncome(incomeForm.primaryHourlyRate, incomeForm.primaryWeeklyHours)
}

export function getAllocationTarget(
  income: number,
  allocationForm: BudgetAllocationFormState,
  key: AllocationKey
): number {
  if (allocationForm.allocationMode === "amount") {
    return asNumber(allocationValueForKey(allocationForm, key, "amount"))
  }

  return (income * asNumber(allocationValueForKey(allocationForm, key, "percent"))) / 100
}

export function getAllocationPercent(
  income: number,
  allocationForm: BudgetAllocationFormState,
  key: AllocationKey
): number {
  if (allocationForm.allocationMode === "percent") {
    return asNumber(allocationValueForKey(allocationForm, key, "percent"))
  }

  if (income <= 0) {
    return 0
  }

  return (getAllocationTarget(income, allocationForm, key) / income) * 100
}

export function getAllocationPercentDisplay(
  income: number,
  allocationForm: BudgetAllocationFormState,
  key: AllocationKey
): string {
  return toDecimalString(getAllocationPercent(income, allocationForm, key))
}

export function getPercentAllocationSummary(allocationForm: BudgetAllocationFormState): string {
  return `${asNumber(allocationForm.needsPercent).toFixed(0)} / ${asNumber(allocationForm.wantsPercent).toFixed(0)} / ${asNumber(allocationForm.savingsPercent).toFixed(0)}`
}

function allocationValueForKey(
  allocationForm: BudgetAllocationFormState,
  key: AllocationKey,
  mode: "percent" | "amount"
): string {
  if (mode === "percent") {
    if (key === "needs") {
      return allocationForm.needsPercent
    }
    if (key === "wants") {
      return allocationForm.wantsPercent
    }
    return allocationForm.savingsPercent
  }

  if (key === "needs") {
    return allocationForm.needsAmount
  }
  if (key === "wants") {
    return allocationForm.wantsAmount
  }
  return allocationForm.savingsAmount
}
