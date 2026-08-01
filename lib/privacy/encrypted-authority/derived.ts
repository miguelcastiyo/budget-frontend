import { monthOverview } from "@/lib/domain/financial/overview"
import { resolvedAmounts, resolvedBudget } from "@/lib/domain/financial/budgets"
import { insights } from "@/lib/domain/financial/insights"
import { resolveRules, dueDate, generatedTransaction, recurringRuleFromRaw, type RecurringOccurrence } from "@/lib/domain/financial/recurring"
import { formatMoneyCents, parseMoneyCents } from "@/lib/domain/financial/money"
import { ledgerBalance, sourceBreakdown, type Fund, type FundLedgerEntry } from "@/lib/domain/financial/funds"
import { planSummary, type SavingsPlan } from "@/lib/domain/financial/savings"
import { getCurrentMonthKey, getLocalDateKey } from "@/lib/date-filters"
import { monthDateRange } from "@/lib/domain/financial/clock"
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
  // Insights ranges such as "last 6 months" end on today, but the final
  // month must still represent its full recurring commitment picture. Keep
  // future manual transactions out while allowing projected recurring rows
  // through the end of that calendar month.
  const analyticalTo = monthDateRange(to.slice(0, 7)).to
  const actualTransactions = filterTransactions(state.transactions, { from, to, sort: "date_asc" })
  const projectedRecurring = monthsBetween(from.slice(0, 7), to.slice(0, 7)).flatMap((month) => resolveRules(state.recurringRules.map((raw) => recurringRuleFromRaw(raw, month)), month).map((rule) => generatedTransaction(rule, { id: `projected:${rule.id}:${month}`, recurringExpenseId: rule.id, occurrenceMonth: `${month}-01`, dueDate: dueDate(rule, month), transactionId: `projected:${rule.id}:${month}` } as RecurringOccurrence)))
  const insightTransactions = [...actualTransactions, ...projectedRecurring]
  const result = insights({ transactions: insightTransactions, from, to: analyticalTo })
  const records = filterTransactions(insightTransactions, { from, to: analyticalTo, sort: "date_asc" })
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
  const { funds, entries } = fundState(state)
  const budgetResolution = (() => {
    try { return resolvedBudget(state.budgets, month) } catch { return null }
  })()
  const savingsBudgetCents = budgetResolution ? cents(resolvedAmounts(budgetResolution.settings).savings) : null
  const rawPlans = state.savingsPlans.filter((item) => String(item.month ?? item.effective_month ?? "").slice(0, 7) === month && item.fund_id == null)
  const rawPlan = rawPlans[rawPlans.length - 1]
  const allocations = state.savingsPlans
    .filter((item) => String(item.month ?? "").slice(0, 7) === month && item.fund_id != null && (item.plan_id == null || rawPlan?.id == null || sameReferenceId(String(item.plan_id), String(rawPlan.id))))
    .map((item) => ({ fundId: String(item.fund_id), month, plannedAmountCents: Number(item.planned_amount_cents ?? cents(item.planned_amount ?? 0)) }))
  const savedTransactions = state.transactions.filter((item) => !item.isDeleted && item.category === "savings" && item.date.startsWith(month))
  const savedAmountCents = savedTransactions.reduce((sum, item) => sum + item.amountCents, 0)
  const transactionIds = savedTransactions.map((item) => item.id)
  const transactionContributions = new Map<string, number>()
  for (const entry of entries) {
    if (entry.sourceType !== "transaction" || entry.direction !== "in" || entry.sourceTransactionId == null || !transactionIds.some((id) => sameReferenceId(id, entry.sourceTransactionId!))) continue
    transactionContributions.set(entry.fundId, (transactionContributions.get(entry.fundId) ?? 0) + entry.amountCents)
  }
  const closeout = state.closeouts.find((item) => !item.is_deleted && String(item.month ?? "").slice(0, 7) === month)
  const closeoutContributions = new Map<string, number>()
  for (const entry of entries) {
    if (entry.sourceType !== "month_closeout" || entry.direction !== "in" || closeout == null || entry.sourceCloseoutId == null || !sameReferenceId(entry.sourceCloseoutId, String(closeout.id ?? ""))) continue
    closeoutContributions.set(entry.fundId, (closeoutContributions.get(entry.fundId) ?? 0) + entry.amountCents)
  }
  const plan: SavingsPlan = { id: String(rawPlan?.id ?? `plan:${month}`), month, savingsBudgetCents: savingsBudgetCents ?? 0, allocations, status: String(rawPlan?.status ?? "active") as SavingsPlan["status"] }
  const summary = planSummary(plan, funds, entries)
  const plannedCents = cents(summary.planned)
  const referencedFundIds = new Set([...allocations.map((item) => item.fundId), ...transactionContributions.keys(), ...closeoutContributions.keys()])
  const responseFunds = funds.filter((fund) => fund.status === "active" || referencedFundIds.has(fund.id))
  const fundRows = responseFunds.map((fund) => {
    const planned = allocations.filter((item) => item.fundId === fund.id).reduce((sum, item) => sum + item.plannedAmountCents, 0)
    const transaction = transactionContributions.get(fund.id) ?? 0
    const closeoutAmount = closeoutContributions.get(fund.id) ?? 0
    const progress = transaction + closeoutAmount
    const rawFund = state.funds.find((item) => sameReferenceId(String(item.id ?? ""), fund.id))
    const goal = fund.goalAmountCents
    const targetMonth = rawFund?.target_month == null ? null : String(rawFund.target_month).slice(0, 7)
    const balance = ledgerBalance(entries, fund.id)
    const basis = balance - transaction
    const shortfall = goal == null ? null : Math.max(goal - basis, 0)
    let pace: any = { status: "unavailable", planning_basis_balance: null, goal_shortfall: null, months_remaining: null, recommended_amount: null }
    if (fund.status !== "active") pace = { status: "unavailable", planning_basis_balance: null, goal_shortfall: null, months_remaining: null, recommended_amount: null }
    else if (goal == null) pace = { status: "no_goal", planning_basis_balance: null, goal_shortfall: null, months_remaining: null, recommended_amount: null }
    else if (targetMonth == null) pace = { status: "no_target", planning_basis_balance: null, goal_shortfall: null, months_remaining: null, recommended_amount: null }
    else if (targetMonth < month) pace = { status: "overdue", planning_basis_balance: formatMoneyCents(basis), goal_shortfall: formatMoneyCents(shortfall ?? 0), months_remaining: null, recommended_amount: null }
    else {
      const monthsRemaining = ((Number(targetMonth.slice(0, 4)) * 12) + Number(targetMonth.slice(5, 7))) - ((Number(month.slice(0, 4)) * 12) + Number(month.slice(5, 7))) + 1
      const recommended = shortfall === 0 ? 0 : Math.ceil((shortfall ?? 0) / monthsRemaining)
      pace = { status: shortfall === 0 ? "goal_met" : "on_track_calculable", planning_basis_balance: formatMoneyCents(basis), goal_shortfall: formatMoneyCents(shortfall ?? 0), months_remaining: monthsRemaining, recommended_amount: formatMoneyCents(recommended) }
    }
    return { fund: { id: fund.id, name: fund.name, status: fund.status, goal_amount: goal == null ? null : formatMoneyCents(goal), target_month: targetMonth, current_balance: formatMoneyCents(balance) }, planned_amount: formatMoneyCents(planned), transaction_contributed: formatMoneyCents(transaction), closeout_contributed: formatMoneyCents(closeoutAmount), progress_amount: formatMoneyCents(progress), remaining_planned: formatMoneyCents(Math.max(planned - progress, 0)), over_plan_amount: formatMoneyCents(Math.max(progress - planned, 0)), pace }
  })
  const transactionDirectedCents = [...transactionContributions.values()].reduce((sum, value) => sum + value, 0)
  const closeoutDirectedCents = [...closeoutContributions.values()].reduce((sum, value) => sum + value, 0)
  const goalPacing = savingsBudgetCents == null ? { status: "unavailable", recommended_total: null, gap_to_savings_budget: null, headroom_vs_savings_budget: null } : month !== getCurrentMonthKey() ? { status: "historical", recommended_total: null, gap_to_savings_budget: null, headroom_vs_savings_budget: null } : (() => { const recommended = fundRows.reduce((sum, item) => sum + cents(item.pace.recommended_amount), 0); return { status: "available", recommended_total: formatMoneyCents(recommended), gap_to_savings_budget: formatMoneyCents(Math.max(recommended - savingsBudgetCents, 0)), headroom_vs_savings_budget: formatMoneyCents(Math.max(savingsBudgetCents - recommended, 0)) } })()
  return { month, status: savingsBudgetCents == null ? "missing_budget" : closeout?.status === "closed" ? "closed" : "active", is_editable: savingsBudgetCents != null && closeout?.status !== "closed", has_plan: allocations.length > 0, budget: { has_budget: savingsBudgetCents != null, resolved_effective_month: budgetResolution?.resolvedEffectiveMonth ?? null, savings_budget: savingsBudgetCents == null ? null : formatMoneyCents(savingsBudgetCents) }, summary: { saved_amount: formatMoneyCents(savedAmountCents), remaining_to_save: formatMoneyCents(savingsBudgetCents == null ? 0 : Math.max(savingsBudgetCents - savedAmountCents, 0)), over_saved_amount: formatMoneyCents(savingsBudgetCents == null ? 0 : Math.max(savedAmountCents - savingsBudgetCents, 0)), planned_to_funds: summary.planned, unassigned_budget: formatMoneyCents(savingsBudgetCents == null ? 0 : Math.max(savingsBudgetCents - plannedCents, 0)), transaction_directed_to_funds: formatMoneyCents(transactionDirectedCents), saved_outside_funds: formatMoneyCents(Math.max(savedAmountCents - transactionDirectedCents, 0)), closeout_directed_to_funds: formatMoneyCents(closeoutDirectedCents), is_overallocated: savingsBudgetCents != null && plannedCents > savingsBudgetCents, overallocation_amount: formatMoneyCents(savingsBudgetCents == null ? 0 : Math.max(plannedCents - savingsBudgetCents, 0)) }, funds: fundRows, goal_pacing: goalPacing }
}

export function encryptedCloseout(state: RehydratedFinancialState, month: string): any {
  const saved = state.closeouts.find((item) => String(item.month ?? "") === month && item.is_deleted !== true)
  const allocations = state.closeoutAllocations.filter((item) => String(item.month ?? item.closeout_month ?? "") === month && item.is_deleted !== true).map((item) => ({ id: String(item.id ?? ""), fund_id: item.fund_id == null ? null : String(item.fund_id), label: item.label == null ? null : String(item.label), amount: formatMoneyCents(item.amount_cents == null ? cents(item.amount) : Number(item.amount_cents)), allocation_type: String(item.allocation_type ?? "fund") }))
  let budget: ReturnType<typeof resolvedBudget> | null = null
  try { budget = resolvedBudget(state.budgets, month) } catch { budget = null }
  if (!budget) return { month, status: "missing_budget", is_closeable: false, computed: null, closeout: null }
  const plannedAmounts = resolvedAmounts(budget.settings)
  const actual = state.transactions.filter((item) => !item.isDeleted && item.date.startsWith(month)).reduce((result, item) => { result[item.category] += item.amountCents; return result }, { needs: 0, wants: 0, savings: 0 })
  const planned = { needs: cents(plannedAmounts.needs), wants: cents(plannedAmounts.wants), savings: cents(plannedAmounts.savings) }
  const plannedTotal = planned.needs + planned.wants + planned.savings
  const actualTotal = actual.needs + actual.wants + actual.savings
  const difference = plannedTotal - actualTotal
  const resultType = difference > 0 ? "surplus" : difference < 0 ? "deficit" : "balanced"
  const surplus = Math.max(difference, 0)
  const deficit = Math.max(-difference, 0)
  const spendingDifference = planned.needs + planned.wants - actual.needs - actual.wants
  const computed = { month, budget_effective_month: budget.resolvedEffectiveMonth, budget_allocation_mode: budget.settings.allocationMode, monthly_income: formatMoneyCents(budget.settings.monthlyIncomeCents), planned: { needs: formatMoneyCents(planned.needs), wants: formatMoneyCents(planned.wants), savings: formatMoneyCents(planned.savings), total: formatMoneyCents(plannedTotal) }, actual: { needs: formatMoneyCents(actual.needs), wants: formatMoneyCents(actual.wants), savings: formatMoneyCents(actual.savings), total: formatMoneyCents(actualTotal) }, result_type: resultType, surplus_amount: formatMoneyCents(surplus), deficit_amount: formatMoneyCents(deficit), spending_surplus_amount: formatMoneyCents(Math.max(spendingDifference, 0)), spending_deficit_amount: formatMoneyCents(Math.max(-spendingDifference, 0)) }
  const resultAmount = saved?.result_type === "surplus" ? surplus : deficit
  const allocated = allocations.reduce((sum, item) => sum + cents(item.amount), 0)
  const closeout = saved ? { id: String(saved.id ?? ""), month, status: saved.is_reopened ? "reopened" : "closed", result_type: String(saved.result_type ?? resultType), surplus_amount: formatMoneyCents(saved.surplus_amount_cents == null ? (saved.result_type === "surplus" ? resultAmount : 0) : Number(saved.surplus_amount_cents)), deficit_amount: formatMoneyCents(saved.deficit_amount_cents == null ? (saved.result_type === "deficit" ? resultAmount : 0) : Number(saved.deficit_amount_cents)), allocated_amount: formatMoneyCents(allocated), unallocated_amount: formatMoneyCents(Math.max(resultAmount - allocated, 0)), allocations, is_stale: false, stale_reasons: [], closed_at: String(saved.closed_at ?? ""), reopened_at: null, notes: saved.notes == null ? null : String(saved.notes) } : null
  const currentMonth = getCurrentMonthKey()
  const status = closeout ? (closeout.status === "reopened" ? "reopened" : "closed") : month < currentMonth ? "ready_to_close" : month > currentMonth ? "future" : "open"
  return { month, status, is_closeable: month < currentMonth, computed, closeout }
}
