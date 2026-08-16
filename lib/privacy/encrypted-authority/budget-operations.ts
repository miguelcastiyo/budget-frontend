import { createEncryptedRecordId } from "../encrypted-records/crypto"
import type { BudgetSettings, BudgetSettingsResolvedResponse, BudgetSettingsVersionsResponse } from "@/lib/api/types"
import { formatMoneyCents } from "@/lib/domain/financial/money"
import { resolvedAmounts, resolvedBudget } from "@/lib/domain/financial/budgets"
import type { EncryptedFinancialAuthority } from "./authority"

function budgetSettingsFromState(item: ReturnType<EncryptedFinancialAuthority["getState"]>["budgets"][number]): BudgetSettings {
  return {
    monthly_income: formatMoneyCents(item.monthlyIncomeCents), income_source_type: item.incomeSourceType,
    primary_monthly_income: item.primaryMonthlyIncomeCents == null ? null : formatMoneyCents(item.primaryMonthlyIncomeCents), primary_hourly_rate: item.primaryHourlyRateCents == null ? null : formatMoneyCents(item.primaryHourlyRateCents), primary_weekly_hours: item.primaryWeeklyHoursHundredths == null ? null : (item.primaryWeeklyHoursHundredths / 100).toFixed(2), side_income_type: item.sideIncomeType, side_income_label: null, side_monthly_income: item.sideMonthlyIncomeCents == null ? null : formatMoneyCents(item.sideMonthlyIncomeCents), side_hourly_rate: item.sideHourlyRateCents == null ? null : formatMoneyCents(item.sideHourlyRateCents), side_weekly_hours: item.sideWeeklyHoursHundredths == null ? null : (item.sideWeeklyHoursHundredths / 100).toFixed(2), allocation_mode: item.allocationMode, needs_percent: item.needsPercentHundredths == null ? undefined : (item.needsPercentHundredths / 100).toFixed(2), wants_percent: item.wantsPercentHundredths == null ? undefined : (item.wantsPercentHundredths / 100).toFixed(2), savings_percent: item.savingsPercentHundredths == null ? undefined : (item.savingsPercentHundredths / 100).toFixed(2), needs_amount: item.needsAmountCents == null ? undefined : formatMoneyCents(item.needsAmountCents), wants_amount: item.wantsAmountCents == null ? undefined : formatMoneyCents(item.wantsAmountCents), savings_amount: item.savingsAmountCents == null ? undefined : formatMoneyCents(item.savingsAmountCents),
  }
}

export function getEncryptedBudgetResolution(authority: EncryptedFinancialAuthority, month: string): BudgetSettingsResolvedResponse {
  const resolved = resolvedBudget(authority.getState().budgets, month)
  return { requested_month: month, resolved_effective_month: resolved.resolvedEffectiveMonth, is_exact_match: resolved.isExactMatch, settings: budgetSettingsFromState(resolved.settings) }
}

export function getEncryptedBudgetVersions(authority: EncryptedFinancialAuthority): BudgetSettingsVersionsResponse {
  const items = authority.getState().budgets.filter((item) => item.effectiveMonth).sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth)).map((item, index, all) => {
    const settings = budgetSettingsFromState(item)
    return { effective_month: `${item.effectiveMonth}-01`, applies_from_month: item.effectiveMonth, applies_until_month: all[index + 1]?.effectiveMonth ? `${all[index + 1].effectiveMonth}-01` : null, ...settings, needs_percent: settings.needs_percent ?? null, wants_percent: settings.wants_percent ?? null, savings_percent: settings.savings_percent ?? null, needs_amount: settings.needs_amount ?? null, wants_amount: settings.wants_amount ?? null, savings_amount: settings.savings_amount ?? null, resolved_amounts: resolvedAmounts(item), created_at: "", updated_at: "" }
  })
  return { items }
}

export async function saveEncryptedBudget(authority: EncryptedFinancialAuthority, month: string, payload: Record<string, unknown>): Promise<void> {
  const existing = authority.store.values().find((record) => record.family === "budget_version" && String(record.data.effective_month ?? "").startsWith(month))
  if (existing) await authority.update(existing.envelope.record_id, { ...existing.data, ...payload })
  else await authority.createSource("budget_version", "budget_version_v1", createEncryptedRecordId(), payload)
}
