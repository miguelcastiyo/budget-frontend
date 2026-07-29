import type { FinancialState, BudgetSettingsRecord, TaxonomyRecord, TransactionRecord } from "../../domain/financial/types"
import { parseMoneyCents } from "../../domain/financial/money"
import type { DecryptedFinancialRecord } from "./record-store"

export interface RehydratedFinancialState extends FinancialState {
  recurringRules: Record<string, unknown>[]
  recurringOccurrences: Record<string, unknown>[]
  funds: Record<string, unknown>[]
  fundLedgerEntries: Record<string, unknown>[]
  savingsPlans: Record<string, unknown>[]
  closeouts: Record<string, unknown>[]
  closeoutAllocations: Record<string, unknown>[]
  importRuns: Record<string, unknown>[]
}

function stringValue(value: unknown, fallback = ""): string { return typeof value === "string" ? value : fallback }
function nullableString(value: unknown): string | null { return value === null || value === undefined || value === "" ? null : stringValue(value) }
function numberValue(value: unknown): number { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? n : 0 }
function hundredths(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
function percentageHundredths(value: unknown): number | null {
  return hundredths(value)
}
function moneyCents(value: unknown, centsKey: boolean): number {
  if (value === null || value === undefined || value === "") return 0
  if (centsKey && typeof value === "number") return value
  try { return parseMoneyCents(typeof value === "number" ? value.toFixed(2) : String(value)) } catch { return numberValue(value) }
}
function boolValue(value: unknown): boolean { return value === true || value === 1 || value === "1" }
function relationshipId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "object" && value !== null) { const id = (value as Record<string, unknown>).id ?? (value as Record<string, unknown>).tag_id; return id == null ? null : String(id) }
  return String(value)
}

// Records staged by an earlier Phase 5 client may retain their source
// collection name in the encrypted payload. The envelope identity is still
// authoritative, but accepting these stable historical aliases lets an
// existing account unlock after the client has been upgraded.
function canonicalFamily(family: string): string {
  return ({
    tags: "taxonomy_tag",
    cards: "taxonomy_card",
    contexts: "taxonomy_context",
    funds: "fund",
    fund_entries: "fund_ledger_entry",
    fund_entry: "fund_ledger_entry",
    monthly_savings_allocations: "savings_plan_allocation",
    monthly_savings_allocation: "savings_plan_allocation",
    recurring_expenses: "recurring_series",
    recurring_expense_occurrences: "recurring_occurrence",
    budget_settings_versions: "budget_version",
    transactions: "transaction",
    monthly_closeouts: "month_closeout",
    monthly_closeout_allocations: "closeout_allocation",
    csv_import_runs: "import_run",
  } as Record<string, string>)[family] ?? family
}

function taxonomy(record: DecryptedFinancialRecord): TaxonomyRecord {
  const d = record.data
  return { id: record.sourceId || stringValue(d.id), userId: stringValue(d.user_id), name: stringValue(d.name), iconKey: nullableString(d.icon_key), isFavorite: boolValue(d.is_favorite), isDeleted: boolValue(d.is_deleted) || d.deleted_at != null, createdSequence: numberValue(d.created_sequence ?? d.id) }
}

function transaction(record: DecryptedFinancialRecord): TransactionRecord {
  const d = record.data
  const recurringExpenseId = relationshipId(d.recurring_expense_id ?? d.recurringExpenseId)
  const source = stringValue(d.source, "manual")
  return { id: record.sourceId, userId: stringValue(d.user_id), date: stringValue(d.date ?? d.transaction_date), expense: stringValue(d.expense), amountCents: d.amount_cents !== undefined ? moneyCents(d.amount_cents, true) : moneyCents(d.amount, false), category: stringValue(d.category) as TransactionRecord["category"], isSplit: boolValue(d.is_split), notes: nullableString(d.notes), source: (source === "recurring" || recurringExpenseId !== null ? "recurring" : source === "import" ? "import" : "manual"), recurringExpenseId, importFingerprint: nullableString(d.import_fingerprint ?? d.importFingerprint), tagId: relationshipId(d.tag_id ?? d.tagId ?? d.tag), contextId: relationshipId(d.context_id ?? d.contextId ?? d.context), cardId: relationshipId(d.card_id ?? d.cardId ?? d.card), isDeleted: boolValue(d.is_deleted) || d.deleted_at != null, createdSequence: numberValue(d.created_sequence ?? d.id) }
}

function budget(record: DecryptedFinancialRecord): BudgetSettingsRecord {
  const d = record.data
  const effectiveMonth = stringValue(d.effective_month ?? d.created_at).slice(0, 7)
  const primaryMonthly = d.primary_monthly_income_cents ?? d.primary_monthly_income
  const primaryHourly = d.primary_hourly_rate_cents ?? d.primary_hourly_rate
  const sideMonthly = d.side_monthly_income_cents ?? d.side_monthly_income
  const sideHourly = d.side_hourly_rate_cents ?? d.side_hourly_rate
  const primaryHours = d.primary_weekly_hours_hundredths !== undefined ? numberValue(d.primary_weekly_hours_hundredths) : hundredths(d.primary_weekly_hours)
  const sideHours = d.side_weekly_hours_hundredths !== undefined ? numberValue(d.side_weekly_hours_hundredths) : hundredths(d.side_weekly_hours)
  const needsPercent = d.needs_percent_hundredths !== undefined ? numberValue(d.needs_percent_hundredths) : percentageHundredths(d.needs_percent)
  const wantsPercent = d.wants_percent_hundredths !== undefined ? numberValue(d.wants_percent_hundredths) : percentageHundredths(d.wants_percent)
  const savingsPercent = d.savings_percent_hundredths !== undefined ? numberValue(d.savings_percent_hundredths) : percentageHundredths(d.savings_percent)
  return { id: record.sourceId, userId: stringValue(d.user_id), effectiveMonth, monthlyIncomeCents: d.monthly_income_cents !== undefined ? moneyCents(d.monthly_income_cents, true) : moneyCents(d.monthly_income, false), incomeSourceType: stringValue(d.income_source_type, "monthly") as BudgetSettingsRecord["incomeSourceType"], primaryMonthlyIncomeCents: primaryMonthly == null ? null : moneyCents(primaryMonthly, d.primary_monthly_income_cents !== undefined), primaryHourlyRateCents: primaryHourly == null ? null : moneyCents(primaryHourly, d.primary_hourly_rate_cents !== undefined), primaryWeeklyHoursHundredths: primaryHours, sideIncomeType: stringValue(d.side_income_type, "none") as BudgetSettingsRecord["sideIncomeType"], sideMonthlyIncomeCents: sideMonthly == null ? null : moneyCents(sideMonthly, d.side_monthly_income_cents !== undefined), sideHourlyRateCents: sideHourly == null ? null : moneyCents(sideHourly, d.side_hourly_rate_cents !== undefined), sideWeeklyHoursHundredths: sideHours, allocationMode: stringValue(d.allocation_mode, "percent") as BudgetSettingsRecord["allocationMode"], needsPercentHundredths: needsPercent, wantsPercentHundredths: wantsPercent, savingsPercentHundredths: savingsPercent, needsAmountCents: d.needs_amount_cents == null && d.needs_amount == null ? null : moneyCents(d.needs_amount_cents ?? d.needs_amount, d.needs_amount_cents !== undefined), wantsAmountCents: d.wants_amount_cents == null && d.wants_amount == null ? null : moneyCents(d.wants_amount_cents ?? d.wants_amount, d.wants_amount_cents !== undefined), savingsAmountCents: d.savings_amount_cents == null && d.savings_amount == null ? null : moneyCents(d.savings_amount_cents ?? d.savings_amount, d.savings_amount_cents !== undefined) }
}

export function rehydrateFinancialState(records: Iterable<DecryptedFinancialRecord>): RehydratedFinancialState {
  const state: RehydratedFinancialState = { transactions: [], tags: [], contexts: [], cards: [], budgets: [], recurringRules: [], recurringOccurrences: [], funds: [], fundLedgerEntries: [], savingsPlans: [], closeouts: [], closeoutAllocations: [], importRuns: [] }
  for (const record of records) {
    const family = canonicalFamily(record.family)
    try {
      switch (family) {
        case "transaction": state.transactions.push(transaction(record)); break
        case "taxonomy_tag": state.tags.push(taxonomy(record)); break
        case "taxonomy_context": state.contexts.push(taxonomy(record)); break
        case "taxonomy_card": state.cards.push(taxonomy(record)); break
        case "budget_settings":
        case "budget_version": state.budgets.push(budget(record)); break
        case "recurring_series": state.recurringRules.push(record.data); break
        case "recurring_occurrence": state.recurringOccurrences.push(record.data); break
        case "fund": state.funds.push(record.data); break
        case "fund_ledger_entry": state.fundLedgerEntries.push(record.data); break
        case "savings_plan":
        case "savings_plan_allocation": state.savingsPlans.push(record.data); break
        case "month_closeout": state.closeouts.push(record.data); break
        case "closeout_allocation": state.closeoutAllocations.push(record.data); break
        case "import_run": state.importRuns.push(record.data); break
        default: throw new Error(`ENCRYPTED_RECORD_FAMILY_UNSUPPORTED:${record.family}`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ENCRYPTED_RECORD_FAMILY_UNSUPPORTED:")) throw error
      throw new Error(`ENCRYPTED_RECORD_REHYDRATION_FAILED:${record.family}:${record.sourceId}`, { cause: error })
    }
  }
  return state
}
