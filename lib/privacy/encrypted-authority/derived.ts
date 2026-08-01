import { monthOverview } from "@/lib/domain/financial/overview"
import { resolvedAmounts, resolvedBudget } from "@/lib/domain/financial/budgets"
import { insights } from "@/lib/domain/financial/insights"
import { resolveRules, dueDate, generatedTransaction, recurringRuleFromRaw, type RecurringOccurrence } from "@/lib/domain/financial/recurring"
import { formatMoneyCents, parseMoneyCents } from "@/lib/domain/financial/money"
import { ledgerBalance, sourceBreakdown, type Fund, type FundLedgerEntry } from "@/lib/domain/financial/funds"
import { planSummary, type SavingsPlan } from "@/lib/domain/financial/savings"
import { getLocalDateKey } from "@/lib/date-filters"
import { recurringTimeline } from "@/lib/domain/financial/recurring-timeline"
import { filterTransactions } from "@/lib/domain/financial/transactions"
import type { RehydratedFinancialState } from "./rehydrate"

const cents = (value: unknown) => value == null ? 0 : value === Number(value) ? Number(value) : parseMoneyCents(String(value))
const percent = (partCents: number, wholeCents: number) => wholeCents === 0 ? "0.00" : formatMoneyCents(Math.round((partCents * 10000) / wholeCents))
const referenceTail = (value: string) => value.trim().split(":").pop() ?? value.trim()
const sameReferenceId = (left: string, right: string) => left.trim() === right.trim() || referenceTail(left) === referenceTail(right) || (Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right))
const fundState = (state: RehydratedFinancialState) => ({
  funds: state.funds.map((raw): Fund => ({ id: String(raw.id ?? ""), name: String(raw.name ?? ""), fundType: String(raw.fund_type ?? "other"), goalAmountCents: raw.goal_amount_cents == null ? (raw.goal_amount == null ? null : cents(raw.goal_amount)) : Number(raw.goal_amount_cents), status: String(raw.status ?? "active") as Fund["status"], sortOrder: Number(raw.sort_order ?? 0) })),
  entries: state.fundLedgerEntries.map((raw): FundLedgerEntry => ({ id: String(raw.id ?? ""), fundId: String(raw.fund_id ?? ""), entryType: String(raw.entry_type ?? "contribution"), direction: String(raw.direction ?? "in") as FundLedgerEntry["direction"], amountCents: raw.amount_cents == null ? cents(raw.amount) : Number(raw.amount_cents), sourceType: String(raw.source_type ?? "manual") as FundLedgerEntry["sourceType"], sourceTransactionId: raw.source_transaction_id == null ? null : String(raw.source_transaction_id), sourceCloseoutId: raw.source_closeout_id == null ? null : String(raw.source_closeout_id), entryDate: String(raw.entry_date ?? ""), isVoided: raw.is_voided === true, isDeleted: raw.is_deleted === true })),
})
function monthsBetween(from: string, to: string): string[] {
  const result: string[] = []
  const [startYear, startMonth] = from.slice(0, 7).split("-").map(Number)
  const [endYear, endMonth] = to.slice(0, 7).split("-").map(Number)
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth); month++) {
    result.push(`${year}-${String(month).padStart(2, "0")}`)
    if (month === 12) { year++; month = 1 }
  }
  return result
}

function encryptedSavingsOverview(state: RehydratedFinancialState, month: string, savingsBudgetCents: number): any {
  const { funds, entries } = fundState(state)
  const monthTransactions = state.transactions.filter((item) => !item.isDeleted && item.date.startsWith(month) && item.category === "savings")
  const savedAmountCents = monthTransactions.reduce((sum, item) => sum + item.amountCents, 0)
  const transactionIds = monthTransactions.map((item) => item.id)
  const transactionDirectedCents = entries.filter((entry) => entry.sourceType === "transaction" && entry.direction === "in" && entry.sourceTransactionId != null && transactionIds.some((id) => sameReferenceId(id, entry.sourceTransactionId!))).reduce((sum, entry) => sum + entry.amountCents, 0)
  const rawPlan = state.savingsPlans.find((item) => String(item.month ?? item.effective_month ?? "").slice(0, 7) === month)
  const allocations = state.savingsPlans.filter((item) => String(item.month ?? "").slice(0, 7) === month && item.fund_id != null).map((item) => ({ fundId: String(item.fund_id), month, plannedAmountCents: item.planned_amount_cents == null ? cents(item.planned_amount) : Number(item.planned_amount_cents) }))
  const plan: SavingsPlan = { id: String(rawPlan?.id ?? `plan:${month}`), month, savingsBudgetCents, allocations, status: String(rawPlan?.status ?? "active") as SavingsPlan["status"] }
  const summary = planSummary(plan, funds, entries)
  const plannedCents = cents(summary.planned)
  const unassignedCents = Math.max(savingsBudgetCents - plannedCents, 0)
  return { has_budget: savingsBudgetCents > 0, has_plan: allocations.length > 0, budget_amount: formatMoneyCents(savingsBudgetCents), saved_amount: formatMoneyCents(savedAmountCents), remaining_to_save: formatMoneyCents(Math.max(savingsBudgetCents - savedAmountCents, 0)), over_saved_amount: formatMoneyCents(Math.max(savedAmountCents - savingsBudgetCents, 0)), planned_to_funds: summary.planned, unassigned_budget: formatMoneyCents(unassignedCents), transaction_directed_to_funds: formatMoneyCents(transactionDirectedCents), saved_outside_funds: formatMoneyCents(Math.max(savedAmountCents - transactionDirectedCents, 0)), is_overallocated: false, overallocation_amount: "0.00", needs_attention: false }
}

export function encryptedMonthOverview(state: RehydratedFinancialState, month: string, currentDate = getLocalDateKey()): any {
  const rules = resolveRules(state.recurringRules.map((raw) => recurringRuleFromRaw(raw, month)), month)
  const projectedRecurring = rules.map((rule) => generatedTransaction(rule, { id: `${rule.id}:${month}`, recurringExpenseId: rule.id, occurrenceMonth: `${month}-01`, dueDate: dueDate(rule, month), transactionId: `projected:${rule.id}:${month}` } as RecurringOccurrence))
  const result: any = monthOverview({ transactions: state.transactions, budgets: state.budgets, occurrences: state.recurringOccurrences as any, projectedRecurring, month, currentDate })
  const budgetAmounts = result.budget?.allocations ?? { needs: "0.00", wants: "0.00", savings: "0.00" }
  const totalSpendCents = cents(result.summary.totalSpent)
  const categories = result.categories.map((item: any) => { const budget = budgetAmounts[item.category as keyof typeof budgetAmounts] ?? "0.00"; return { category: item.category, budget_amount: budget, actual_spend: item.total, percent_used: percent(cents(item.total), cents(budget)) } })
  const totalSpend = cents(result.summary.totalSpent)
  const totalBudget = cents(result.budget?.settings?.monthlyIncomeCents)
  const leftThisMonth = formatMoneyCents(totalBudget - totalSpend)
  return { month, budget: result.budget, summary: { total_spend: result.summary.totalSpent, transaction_count: result.summary.count, average_transaction: result.summary.avgTransaction, left_this_month: leftThisMonth, total_budget: formatMoneyCents(totalBudget), monthly_income: formatMoneyCents(totalBudget) }, month_progress: result.monthProgress, categories, tags: result.tags.map((item: any) => { const spend = item.total; const percentOfSpend = percent(cents(spend), totalSpend); return { tag_id: item.tagId, tag_name: state.tags.find((tag) => sameReferenceId(tag.id, String(item.tagId)))?.name ?? "", icon_key: state.tags.find((tag) => sameReferenceId(tag.id, String(item.tagId)))?.iconKey ?? null, spend, percent_of_total_spend: percentOfSpend, percent_of_monthly_spend: percentOfSpend } }), recurring: { generated_total: result.recurring.generatedTotal, count: result.recurring.count }, savings_plan: encryptedSavingsOverview(state, month, cents(result.budget?.allocations?.savings ?? 0)), status_cards: categories, recent_transactions: result.recentTransactions.map((item: any) => { const tag = state.tags.find((candidate) => sameReferenceId(candidate.id, String(item.tagId ?? ""))); const context = state.contexts.find((candidate) => sameReferenceId(candidate.id, String(item.contextId ?? ""))); const card = state.cards.find((candidate) => sameReferenceId(candidate.id, String(item.cardId ?? ""))); return { id: item.id, date: item.date, expense: item.expense, amount: formatMoneyCents(item.amountCents), category: item.category, is_split: item.isSplit, notes: item.notes, source: item.source === "import" ? "import" : item.source === "recurring" ? "recurring" : "manual", recurring_expense_id: item.recurringExpenseId, tag: { id: item.tagId ?? "", name: tag?.name ?? "", icon_key: tag?.iconKey ?? null }, context: item.contextId == null ? null : { id: String(item.contextId), name: context?.name ?? "", icon_key: context?.iconKey ?? null }, card: item.cardId == null ? null : { id: String(item.cardId), name: card?.name ?? "", is_favorite: card?.isFavorite ?? false }, created_at: "", updated_at: "" } }), }
}

export function encryptedInsights(state: RehydratedFinancialState, from: string, to: string): any {
  const projectedRecurring = monthsBetween(from.slice(0, 7), to.slice(0, 7)).flatMap((month) => resolveRules(state.recurringRules.map((raw) => recurringRuleFromRaw(raw, month)), month).map((rule) => generatedTransaction(rule, { id: `projected:${rule.id}:${month}`, recurringExpenseId: rule.id, occurrenceMonth: `${month}-01`, dueDate: dueDate(rule, month), transactionId: `projected:${rule.id}:${month}` } as RecurringOccurrence)))
  const insightTransactions = [...state.transactions, ...projectedRecurring]
  const result = insights({ transactions: insightTransactions, from, to })
  const records = filterTransactions(insightTransactions, { from, to, sort: "date_asc" })
  const tagTotals = new Map<string, number>(); for (const item of records) if (item.tagId) tagTotals.set(item.tagId, (tagTotals.get(item.tagId) ?? 0) + item.amountCents)
  const totalSpendCents = cents(result.total)
  const weekdayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
  const weekday = [0, 1, 2, 3, 4, 5, 6].map((dayIndex) => { const day = String(dayIndex); const dayRecords = records.filter((item) => String(new Date(`${item.date}T00:00:00Z`).getUTCDay()) === day); const total = result.weekday[day] ?? "0.00"; return { day: weekdayNames[dayIndex] ?? "sunday", avg_spend: formatMoneyCents(Math.round(parseMoneyCents(String(total)) / Math.max(1, dayRecords.length))), total_spend: total, transactions_count: dayRecords.length } })
  const budgetTotals = { needs: 0, wants: 0, savings: 0 }
  for (const month of monthsBetween(from, to)) {
    try { const budget = resolvedBudget(state.budgets, month); const amounts = resolvedAmounts(budget.settings); budgetTotals.needs += cents(amounts.needs); budgetTotals.wants += cents(amounts.wants); budgetTotals.savings += cents(amounts.savings) } catch { /* no budget for this month */ }
  }
  const monthlySpendTrend = monthsBetween(from, to).map((month) => { const monthRecords = records.filter((item) => item.date.startsWith(month)); return { month, total_spend: formatMoneyCents(monthRecords.reduce((sum, item) => sum + item.amountCents, 0)), transaction_count: monthRecords.length } })
  const tagName = (id: unknown) => state.tags.find((tag) => sameReferenceId(tag.id, String(id ?? "")))
  const cardName = (id: unknown) => state.cards.find((card) => sameReferenceId(card.id, String(id ?? "")))?.name ?? null
  return { date_from: from, date_to: to, months_in_range: monthlySpendTrend.length, total_spend: result.total, total_transactions: result.count, monthly_spend_trend: monthlySpendTrend, category_breakdown: result.categories.map((item) => ({ category: item.category, spend: item.total, percent_of_total_spend: percent(cents(item.total), totalSpendCents) })), category_budget_vs_actual: result.categories.map((item) => { const budgetAmount = budgetTotals[item.category as keyof typeof budgetTotals]; return { category: item.category, budget_amount: formatMoneyCents(budgetAmount), actual_spend: item.total, percent_used: percent(cents(item.total), budgetAmount) } }), tag_breakdown: [...tagTotals.entries()].map(([tag_id, spend]) => ({ tag_id, tag_name: tagName(tag_id)?.name ?? "", icon_key: tagName(tag_id)?.iconKey ?? null, spend: formatMoneyCents(spend), percent_of_total_spend: percent(spend, totalSpendCents) })), day_of_week_spend: weekday, largest_transactions: result.largest.map((item) => ({ transaction_id: item.id, date: item.date, expense: item.expense, amount: formatMoneyCents(item.amountCents), category: item.category, is_split: item.isSplit, notes: item.notes, tag: { id: item.tagId ?? "", name: tagName(item.tagId)?.name ?? "", icon_key: tagName(item.tagId)?.iconKey ?? null }, card_name: cardName(item.cardId) })), recurring_vs_variable: { recurring: result.recurring, variable: result.variable, recurring_percent: percent(cents(result.recurring), totalSpendCents), variable_percent: percent(cents(result.variable), totalSpendCents) } }
}

export function encryptedRecurring(state: RehydratedFinancialState, month: string): any {
  const rules = state.recurringRules.map((raw) => recurringRuleFromRaw(raw, month))
  const resolved = new Set(resolveRules(rules, month).map((rule) => rule.id))
  const items = recurringTimeline(rules).map((rule) => { const raw = state.recurringRules.find((candidate) => String(candidate.id ?? candidate.source_id ?? "") === rule.id); const tagId = String(raw?.tag_id ?? raw?.tagId ?? ""); const cardId = String(raw?.card_id ?? raw?.cardId ?? ""); const tag = state.tags.find((candidate) => sameReferenceId(candidate.id, tagId)); const card = state.cards.find((candidate) => sameReferenceId(candidate.id, cardId)); return { id: rule.id, series_id: rule.seriesId, expense: rule.expense, amount: formatMoneyCents(rule.amountCents), category: rule.category, billing_type: rule.billingType, billing_day: rule.billingDay, projected_date_for_month: dueDate(rule, month), starts_month: rule.startsMonth, ends_month: rule.endsMonth, is_active: rule.isActive, generated_for_month: state.recurringOccurrences.some((occurrence) => sameReferenceId(String(occurrence.recurring_expense_id ?? ""), rule.id) && String(occurrence.occurrence_month ?? "").startsWith(month)), created_at: String(raw?.created_at ?? ""), updated_at: String(raw?.updated_at ?? ""), tag: { id: tagId, name: tag?.name ?? "", icon_key: tag?.iconKey ?? null }, card: card ? { id: card.id, name: card.name, is_favorite: card.isFavorite } : null } })
  const committedItems = items.filter((item) => resolved.has(item.id))
  const committedCents = committedItems.reduce((sum, item) => sum + cents(item.amount), 0)
  const generatedItems = committedItems.filter((item) => item.generated_for_month)
  const generatedCents = generatedItems.reduce((sum, item) => sum + cents(item.amount), 0)
  const generatedCount = generatedItems.length
  const upcomingCount = Math.max(committedItems.length - generatedCount, 0)
  return { month, items, committed_total: formatMoneyCents(committedCents), generated_total: formatMoneyCents(generatedCents), upcoming_total: formatMoneyCents(committedCents - generatedCents), items_count: items.length, generated_count: generatedCount, upcoming_count: upcomingCount, logged_count: generatedCount }
}

export function encryptedSavingsPlan(state: RehydratedFinancialState, month: string): any {
  const { funds, entries } = fundState(state); const raw = state.savingsPlans.find((item) => String(item.month ?? item.effective_month ?? "") === month); const plan: SavingsPlan = { id: String(raw?.id ?? `plan:${month}`), month, savingsBudgetCents: Number(raw?.savings_budget_cents ?? cents(raw?.savings_budget ?? 0)), allocations: state.savingsPlans.filter((item) => String(item.month ?? "") === month && item.fund_id != null).map((item) => ({ fundId: String(item.fund_id), month, plannedAmountCents: Number(item.planned_amount_cents ?? cents(item.planned_amount ?? 0)) })), status: String(raw?.status ?? "active") as SavingsPlan["status"] }; const summary = planSummary(plan, funds, entries); return { month, status: plan.status === "completed" ? "closed" : "open", has_plan: plan.allocations.length > 0, is_editable: true, budget: { has_budget: plan.savingsBudgetCents > 0, savings_budget: formatMoneyCents(plan.savingsBudgetCents) }, summary: { saved_amount: "0.00", remaining_to_save: summary.unassigned, over_saved_amount: "0.00", planned_to_funds: summary.planned, unassigned_budget: summary.unassigned, is_overallocated: false, overallocation_amount: "0.00" }, funds: summary.funds.map((item) => ({ fund: { id: item.fundId, name: funds.find((fund) => fund.id === item.fundId)?.name ?? "", status: "active", goal_amount: item.goal }, planned_amount: item.planned, transaction_contributed: "0.00", closeout_contributed: "0.00", progress_amount: item.balance, remaining_planned: "0.00", over_plan_amount: "0.00", pace: { status: item.goalMet ? "goal_met" : "unavailable", planning_basis_balance: item.balance, goal_shortfall: null, months_remaining: null, recommended_amount: null } })), goal_pacing: { status: "unavailable" } }
}

export function encryptedCloseout(state: RehydratedFinancialState, month: string): any {
  const saved = state.closeouts.find((item) => String(item.month ?? "") === month && item.is_deleted !== true)
  const allocations = state.closeoutAllocations.filter((item) => String(item.month ?? item.closeout_month ?? "") === month && item.is_deleted !== true).map((item) => ({ id: String(item.id ?? ""), fund_id: item.fund_id == null ? null : String(item.fund_id), label: item.label == null ? null : String(item.label), amount: formatMoneyCents(item.amount_cents == null ? cents(item.amount) : Number(item.amount_cents)), allocation_type: String(item.allocation_type ?? "fund") }))
  const resultType = String(saved?.result_type ?? "balanced")
  return { month, status: saved ? (saved.is_reopened ? "reopened" : "closed") : "open", computed: { result_type: resultType, surplus_amount: formatMoneyCents(saved?.surplus_amount_cents == null ? cents(saved?.surplus_amount ?? 0) : Number(saved.surplus_amount_cents)), deficit_amount: formatMoneyCents(saved?.deficit_amount_cents == null ? cents(saved?.deficit_amount ?? 0) : Number(saved.deficit_amount_cents)), allocations }, closeout: saved ? { id: String(saved.id ?? ""), month, result_type: resultType, surplus_amount: formatMoneyCents(saved?.surplus_amount_cents == null ? cents(saved?.surplus_amount ?? 0) : Number(saved.surplus_amount_cents)), deficit_amount: formatMoneyCents(saved?.deficit_amount_cents == null ? cents(saved?.deficit_amount ?? 0) : Number(saved.deficit_amount_cents)), allocations, is_stale: false, closed_at: String(saved.closed_at ?? "") } : null }
}
