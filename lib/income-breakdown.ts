import type { BudgetSettings, IncomeSourceType, SideIncomeType } from "@/lib/api/types"

export const WEEKS_PER_MONTH = 52 / 12

export interface IncomeFormState {
  incomeSourceType: IncomeSourceType
  primaryMonthlyIncome: string
  primaryHourlyRate: string
  primaryWeeklyHours: string
  sideIncomeType: SideIncomeType
  sideIncomeLabel: string
  sideMonthlyIncome: string
  sideHourlyRate: string
  sideWeeklyHours: string
}

export const defaultIncomeFormState: IncomeFormState = {
  incomeSourceType: "monthly",
  primaryMonthlyIncome: "0.00",
  primaryHourlyRate: "0.00",
  primaryWeeklyHours: "0.00",
  sideIncomeType: "none",
  sideIncomeLabel: "",
  sideMonthlyIncome: "0.00",
  sideHourlyRate: "0.00",
  sideWeeklyHours: "0.00",
}

export function asNumber(value: string | null | undefined): number {
  const parsed = parseFloat(String(value ?? "").replace(/,/g, "").trim())
  return Number.isFinite(parsed) ? parsed : 0
}

export function toDecimalString(value: string | number): string {
  const parsed = typeof value === "number" ? value : parseFloat(value.replace(/,/g, "").trim())
  if (!Number.isFinite(parsed)) {
    return "0.00"
  }

  return parsed.toFixed(2)
}

export function calculateHourlyMonthlyIncome(hourlyRate: string, weeklyHours: string): number {
  return asNumber(hourlyRate) * asNumber(weeklyHours) * WEEKS_PER_MONTH
}

export function calculateMonthlyIncome(state: IncomeFormState): number {
  const primaryIncome =
    state.incomeSourceType === "monthly"
      ? asNumber(state.primaryMonthlyIncome)
      : calculateHourlyMonthlyIncome(state.primaryHourlyRate, state.primaryWeeklyHours)

  const sideIncome =
    state.sideIncomeType === "monthly"
      ? asNumber(state.sideMonthlyIncome)
      : state.sideIncomeType === "hourly"
        ? calculateHourlyMonthlyIncome(state.sideHourlyRate, state.sideWeeklyHours)
        : 0

  return primaryIncome + sideIncome
}

export function calculateMonthlyIncomeString(state: IncomeFormState): string {
  return toDecimalString(calculateMonthlyIncome(state))
}

export function isIncomeFormValid(state: IncomeFormState): boolean {
  if (state.incomeSourceType === "monthly" && asNumber(state.primaryMonthlyIncome) <= 0) {
    return false
  }

  if (
    state.incomeSourceType === "hourly" &&
    (asNumber(state.primaryHourlyRate) <= 0 || asNumber(state.primaryWeeklyHours) <= 0)
  ) {
    return false
  }

  if (state.sideIncomeType === "monthly" && asNumber(state.sideMonthlyIncome) <= 0) {
    return false
  }

  if (
    state.sideIncomeType === "hourly" &&
    (asNumber(state.sideHourlyRate) <= 0 || asNumber(state.sideWeeklyHours) <= 0)
  ) {
    return false
  }

  return calculateMonthlyIncome(state) > 0
}

export function hydrateIncomeForm(settings: BudgetSettings): IncomeFormState {
  return {
    incomeSourceType: settings.income_source_type ?? "monthly",
    primaryMonthlyIncome: settings.primary_monthly_income ?? settings.monthly_income,
    primaryHourlyRate: settings.primary_hourly_rate ?? "0.00",
    primaryWeeklyHours: settings.primary_weekly_hours ?? "0.00",
    sideIncomeType: settings.side_income_type ?? "none",
    sideIncomeLabel: settings.side_income_label ?? "",
    sideMonthlyIncome: settings.side_monthly_income ?? "0.00",
    sideHourlyRate: settings.side_hourly_rate ?? "0.00",
    sideWeeklyHours: settings.side_weekly_hours ?? "0.00",
  }
}

export function incomeBreakdownPayload(state: IncomeFormState) {
  return {
    monthly_income: calculateMonthlyIncomeString(state),
    income_source_type: state.incomeSourceType,
    primary_monthly_income:
      state.incomeSourceType === "monthly" ? toDecimalString(state.primaryMonthlyIncome) : null,
    primary_hourly_rate:
      state.incomeSourceType === "hourly" ? toDecimalString(state.primaryHourlyRate) : null,
    primary_weekly_hours:
      state.incomeSourceType === "hourly" ? toDecimalString(state.primaryWeeklyHours) : null,
    side_income_type: state.sideIncomeType,
    side_income_label: state.sideIncomeLabel.trim() || null,
    side_monthly_income:
      state.sideIncomeType === "monthly" ? toDecimalString(state.sideMonthlyIncome) : null,
    side_hourly_rate:
      state.sideIncomeType === "hourly" ? toDecimalString(state.sideHourlyRate) : null,
    side_weekly_hours:
      state.sideIncomeType === "hourly" ? toDecimalString(state.sideWeeklyHours) : null,
  }
}
