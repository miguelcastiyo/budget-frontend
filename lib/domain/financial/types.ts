import type { MoneyCents } from "./money"

export type FinancialCategory = "needs" | "wants" | "savings"
export type TransactionSource = "manual" | "recurring" | "import"

export interface TransactionRecord {
  id: string; userId: string; date: string; expense: string; amountCents: MoneyCents; category: FinancialCategory
  isSplit: boolean; notes: string | null; source: TransactionSource; recurringExpenseId: string | null
  importFingerprint: string | null; tagId: string | null; contextId: string | null; cardId: string | null
  isDeleted: boolean; createdSequence: number
}

export interface TaxonomyRecord {
  id: string; userId: string; name: string; iconKey: string | null; isFavorite: boolean; isDeleted: boolean; createdSequence: number
}

export interface BudgetSettingsRecord {
  id: string; userId: string; effectiveMonth: string; monthlyIncomeCents: MoneyCents
  incomeSourceType: "monthly" | "hourly"; primaryMonthlyIncomeCents: MoneyCents | null; primaryHourlyRateCents: MoneyCents | null; primaryWeeklyHoursHundredths: number | null
  sideIncomeType: "none" | "monthly" | "hourly"; sideMonthlyIncomeCents: MoneyCents | null; sideHourlyRateCents: MoneyCents | null; sideWeeklyHoursHundredths: number | null
  allocationMode: "percent" | "amount"; needsPercentHundredths: number | null; wantsPercentHundredths: number | null; savingsPercentHundredths: number | null
  needsAmountCents: MoneyCents | null; wantsAmountCents: MoneyCents | null; savingsAmountCents: MoneyCents | null
}

export interface FinancialState { transactions: TransactionRecord[]; tags: TaxonomyRecord[]; contexts: TaxonomyRecord[]; cards: TaxonomyRecord[]; budgets: BudgetSettingsRecord[] }
