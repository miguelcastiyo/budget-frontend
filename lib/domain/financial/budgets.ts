import { monthKey } from "./clock"
import { FinancialDomainError } from "./errors"
import { allocateByPercent, formatMoneyCents, parseMoneyCents, roundHalfUp } from "./money"
import type { BudgetSettingsRecord } from "./types"

export function hourlyMonthlyIncome(rateCents: number, hoursHundredths: number): number { return roundHalfUp(rateCents * hoursHundredths * 52, 12 * 100) }

export function composedMonthlyIncome(input: Pick<BudgetSettingsRecord, "incomeSourceType" | "primaryMonthlyIncomeCents" | "primaryHourlyRateCents" | "primaryWeeklyHoursHundredths" | "sideIncomeType" | "sideMonthlyIncomeCents" | "sideHourlyRateCents" | "sideWeeklyHoursHundredths">): number {
  const primary = input.incomeSourceType === "monthly" ? input.primaryMonthlyIncomeCents ?? 0 : hourlyMonthlyIncome(input.primaryHourlyRateCents ?? 0, input.primaryWeeklyHoursHundredths ?? 0)
  const side = input.sideIncomeType === "monthly" ? input.sideMonthlyIncomeCents ?? 0 : input.sideIncomeType === "hourly" ? hourlyMonthlyIncome(input.sideHourlyRateCents ?? 0, input.sideWeeklyHoursHundredths ?? 0) : 0
  return primary + side
}

export function validateBudget(settings: BudgetSettingsRecord): void {
  if (settings.monthlyIncomeCents <= 0) throw new FinancialDomainError("VALIDATION_FAILED")
  if (settings.allocationMode === "percent") {
    const total = (settings.needsPercentHundredths ?? 0) + (settings.wantsPercentHundredths ?? 0) + (settings.savingsPercentHundredths ?? 0)
    if (total !== 10000) throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "allocation_mode", message: "percent values must total 100.00" }])
  } else {
    const total = (settings.needsAmountCents ?? 0) + (settings.wantsAmountCents ?? 0) + (settings.savingsAmountCents ?? 0)
    if (total !== settings.monthlyIncomeCents) throw new FinancialDomainError("VALIDATION_FAILED", "Request validation failed", [{ field: "allocation_mode", message: "amount values must total monthly_income" }])
  }
}

export function resolvedBudget(settings: BudgetSettingsRecord[], requestedMonth: string): { requestedMonth: string; resolvedEffectiveMonth: string; isExactMatch: boolean; settings: BudgetSettingsRecord } {
  const month = monthKey(requestedMonth); const candidates = settings.filter((item) => item.effectiveMonth <= month).sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth) || b.id.localeCompare(a.id))
  const resolved = candidates[0]; if (!resolved) throw new FinancialDomainError("REFERENCE_NOT_FOUND")
  return { requestedMonth: month, resolvedEffectiveMonth: resolved.effectiveMonth, isExactMatch: resolved.effectiveMonth === month, settings: resolved }
}

export function resolvedAmounts(settings: BudgetSettingsRecord): { needs: string; wants: string; savings: string } {
  validateBudget(settings)
  if (settings.allocationMode === "amount") return { needs: formatMoneyCents(settings.needsAmountCents ?? 0), wants: formatMoneyCents(settings.wantsAmountCents ?? 0), savings: formatMoneyCents(settings.savingsAmountCents ?? 0) }
  const [needs, wants, savings] = allocateByPercent(settings.monthlyIncomeCents, [settings.needsPercentHundredths ?? 0, settings.wantsPercentHundredths ?? 0, settings.savingsPercentHundredths ?? 0])
  return { needs: formatMoneyCents(needs), wants: formatMoneyCents(wants), savings: formatMoneyCents(savings) }
}

export function moneyInput(value: string): number { return parseMoneyCents(value) }
