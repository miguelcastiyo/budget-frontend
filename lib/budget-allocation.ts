import type {
  AllocationMode,
  BudgetSettings,
  BudgetSettingsAmountInput,
  BudgetSettingsPercentInput,
} from "@/lib/api/types"
import { asNumber, incomeBreakdownPayload, toDecimalString, type IncomeFormState } from "@/lib/income-breakdown"

export interface BudgetAllocationFormState {
  allocationMode: AllocationMode
  needsPercent: string
  wantsPercent: string
  savingsPercent: string
  needsAmount: string
  wantsAmount: string
  savingsAmount: string
}

export const defaultBudgetAllocationFormState: BudgetAllocationFormState = {
  allocationMode: "percent",
  needsPercent: "50.00",
  wantsPercent: "30.00",
  savingsPercent: "20.00",
  needsAmount: "0.00",
  wantsAmount: "0.00",
  savingsAmount: "0.00",
}

export function hydrateBudgetAllocationForm(settings: BudgetSettings): BudgetAllocationFormState {
  return {
    allocationMode: settings.allocation_mode,
    needsPercent: settings.needs_percent || "50.00",
    wantsPercent: settings.wants_percent || "30.00",
    savingsPercent: settings.savings_debts_percent || "20.00",
    needsAmount: settings.needs_amount || "0.00",
    wantsAmount: settings.wants_amount || "0.00",
    savingsAmount: settings.savings_debts_amount || "0.00",
  }
}

export function totalPercent(state: BudgetAllocationFormState): number {
  return asNumber(state.needsPercent) + asNumber(state.wantsPercent) + asNumber(state.savingsPercent)
}

export function totalAmount(state: BudgetAllocationFormState): number {
  return asNumber(state.needsAmount) + asNumber(state.wantsAmount) + asNumber(state.savingsAmount)
}

export function isPercentAllocationValid(state: BudgetAllocationFormState): boolean {
  return Math.abs(totalPercent(state) - 100) < 0.01
}

export function isAmountAllocationValid(state: BudgetAllocationFormState, income: number): boolean {
  return Math.abs(totalAmount(state) - income) < 0.01
}

export function isBudgetAllocationValid(state: BudgetAllocationFormState, income: number): boolean {
  return state.allocationMode === "percent"
    ? isPercentAllocationValid(state)
    : isAmountAllocationValid(state, income)
}

export function withAllocationMode(
  state: BudgetAllocationFormState,
  allocationMode: AllocationMode,
  income: number
): BudgetAllocationFormState {
  if (state.allocationMode !== "percent" || allocationMode !== "amount") {
    return { ...state, allocationMode }
  }

  return {
    ...state,
    ...amountsFromPercent(state, income),
    allocationMode,
  }
}

export function budgetAllocationPayload(
  state: BudgetAllocationFormState
): Pick<
  BudgetSettingsPercentInput,
  "allocation_mode" | "needs_percent" | "wants_percent" | "savings_debts_percent"
> | Pick<
  BudgetSettingsAmountInput,
  "allocation_mode" | "needs_amount" | "wants_amount" | "savings_debts_amount"
> {
  if (state.allocationMode === "percent") {
    return {
      allocation_mode: "percent",
      needs_percent: toDecimalString(state.needsPercent),
      wants_percent: toDecimalString(state.wantsPercent),
      savings_debts_percent: toDecimalString(state.savingsPercent),
    }
  }

  return {
    allocation_mode: "amount",
    needs_amount: toDecimalString(state.needsAmount),
    wants_amount: toDecimalString(state.wantsAmount),
    savings_debts_amount: toDecimalString(state.savingsAmount),
  }
}

export function budgetSettingsPayload(
  incomeState: IncomeFormState,
  allocationState: BudgetAllocationFormState
): BudgetSettingsPercentInput | BudgetSettingsAmountInput {
  return {
    ...incomeBreakdownPayload(incomeState),
    ...budgetAllocationPayload(allocationState),
  }
}

function amountsFromPercent(state: BudgetAllocationFormState, income: number) {
  if (!isPercentAllocationValid(state)) {
    return {
      needsAmount: toDecimalString((asNumber(state.needsPercent) / 100) * income),
      wantsAmount: toDecimalString((asNumber(state.wantsPercent) / 100) * income),
      savingsAmount: toDecimalString((asNumber(state.savingsPercent) / 100) * income),
    }
  }

  const incomeCents = Math.round(income * 100)
  const needsCents = Math.round((asNumber(state.needsPercent) / 100) * incomeCents)
  const wantsCents = Math.round((asNumber(state.wantsPercent) / 100) * incomeCents)
  const savingsCents = incomeCents - needsCents - wantsCents

  return {
    needsAmount: (needsCents / 100).toFixed(2),
    wantsAmount: (wantsCents / 100).toFixed(2),
    savingsAmount: (savingsCents / 100).toFixed(2),
  }
}
