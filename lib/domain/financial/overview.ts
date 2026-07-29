import { monthDateRange } from "./clock"
import { resolvedAmounts, resolvedBudget } from "./budgets"
import { formatMoneyCents } from "./money"
import { filterTransactions, transactionSummary } from "./transactions"
import type { BudgetSettingsRecord, TransactionRecord } from "./types"
import type { RecurringOccurrence } from "./recurring"

export function monthOverview(input: { transactions: TransactionRecord[]; budgets: BudgetSettingsRecord[]; occurrences: RecurringOccurrence[]; month: string; currentDate: string; recentLimit?: number }) {
  const range = monthDateRange(input.month)
  const monthTransactions = filterTransactions(input.transactions, { from: range.from, to: range.to, sort: "date_asc" }).filter((item) => item.source !== "recurring" || item.date <= input.currentDate)
  const summary = transactionSummary(monthTransactions, {})
  const categoryTotals = ["needs", "wants", "savings"].map((category) => ({ category, total: formatMoneyCents(monthTransactions.filter((item) => item.category === category).reduce((sum, item) => sum + item.amountCents, 0)) }))
  const tagTotals = [...new Set(monthTransactions.map((item) => item.tagId).filter(Boolean))]
    .map((tagId) => ({ tagId, totalCents: monthTransactions.filter((item) => item.tagId === tagId).reduce((sum, item) => sum + item.amountCents, 0) }))
    .sort((a, b) => b.totalCents - a.totalCents || String(a.tagId).localeCompare(String(b.tagId)))
    .map(({ tagId, totalCents }) => ({ tagId, total: formatMoneyCents(totalCents) }))
  let budget: ReturnType<typeof resolvedBudget> | null = null
  try { budget = resolvedBudget(input.budgets, input.month) } catch { budget = null }
  const allocations = budget ? resolvedAmounts(budget.settings) : { needs: "0.00", wants: "0.00", savings: "0.00" }
  const recurring = input.occurrences.filter((item) => item.occurrenceMonth === `${input.month}-01` && item.dueDate <= input.currentDate)
  const recurringTotal = monthTransactions.filter((item) => item.source === "recurring").reduce((sum, item) => sum + item.amountCents, 0)
  const recent = [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdSequence - a.createdSequence || a.id.localeCompare(b.id)).slice(0, input.recentLimit ?? 5)
  const totalCents = monthTransactions.reduce((sum, item) => sum + item.amountCents, 0)
  const monthProgress = input.currentDate < range.from ? "upcoming" : input.currentDate > range.to ? "past" : "current"
  return { month: input.month, budget: budget ? { ...budget, allocations } : { hasBudget: false }, summary, categories: categoryTotals, tags: tagTotals, remaining: formatMoneyCents(Math.max(0, (budget?.settings.monthlyIncomeCents ?? 0) - totalCents)), progress: totalCents, monthProgress, statusCards: categoryTotals, recurring: { generatedTotal: formatMoneyCents(recurringTotal), count: recurring.length }, recentTransactions: recent }
}
