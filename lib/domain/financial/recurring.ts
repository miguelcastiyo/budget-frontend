import { daysInMonth, monthDateRange, monthKey } from "./clock"
import type { TransactionRecord } from "./types"

export interface RecurringRule {
  id: string; seriesId: string; expense: string; amountCents: number; category: "needs" | "wants" | "savings"
  billingType: "day_of_month" | "last_day"; billingDay: number | null; startsMonth: string; endsMonth: string | null
  isActive: boolean; isDeleted: boolean; seedTransactionId?: string | null
}

export interface RecurringOccurrence { id: string; recurringExpenseId: string; occurrenceMonth: string; dueDate: string; transactionId: string }

export function dueDate(rule: RecurringRule, month: string): string {
  const normalized = monthKey(month)
  const day = rule.billingType === "last_day" ? daysInMonth(normalized) : Math.min(rule.billingDay ?? 1, daysInMonth(normalized))
  return `${normalized}-${String(day).padStart(2, "0")}`
}

export function ruleApplies(rule: RecurringRule, month: string): boolean {
  const normalized = monthKey(month)
  return rule.isActive && !rule.isDeleted && rule.startsMonth <= normalized && (rule.endsMonth === null || normalized <= rule.endsMonth)
}

export function resolveRules(rules: RecurringRule[], month: string): RecurringRule[] {
  const normalized = monthKey(month)
  return rules.filter((rule) => ruleApplies(rule, normalized)).sort((a, b) => a.id.localeCompare(b.id))
}

export function scheduleChange(rules: RecurringRule[], ruleId: string, effectiveMonth: string, changes: Partial<Pick<RecurringRule, "expense" | "amountCents" | "category" | "billingType" | "billingDay">>): RecurringRule[] {
  const month = monthKey(effectiveMonth)
  const current = rules.find((rule) => rule.id === ruleId)
  if (!current) throw new Error("REFERENCE_NOT_FOUND")
  if (current.endsMonth !== null && current.endsMonth >= month) throw new Error("BUDGET_VERSION_CONFLICT")
  if (current.startsMonth >= month) throw new Error("BUDGET_VERSION_CONFLICT")
  const prior = { ...current, endsMonth: previousMonth(month) }
  const next = { ...current, ...changes, id: `${current.id}:v${month}`, startsMonth: month, endsMonth: null }
  return rules.map((rule) => rule.id === ruleId ? prior : rule).concat(next)
}

function previousMonth(month: string): string {
  const [year, number] = monthKey(month).split("-").map(Number)
  const date = new Date(Date.UTC(year, number - 2, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

export function planMaterialization(rules: RecurringRule[], month: string, existing: RecurringOccurrence[], transactions: TransactionRecord[], currentMonth: string): RecurringOccurrence[] {
  const normalized = monthKey(month)
  if (normalized > monthKey(currentMonth)) return []
  const planned: RecurringOccurrence[] = []
  for (const rule of resolveRules(rules, normalized)) {
    if (existing.some((occurrence) => occurrence.recurringExpenseId === rule.id && occurrence.occurrenceMonth === `${normalized}-01`)) continue
    const seed = rule.seedTransactionId ? transactions.find((transaction) => transaction.id === rule.seedTransactionId && transaction.date.slice(0, 7) === normalized) : undefined
    planned.push({ id: `${rule.id}:${normalized}`, recurringExpenseId: rule.id, occurrenceMonth: `${normalized}-01`, dueDate: dueDate(rule, normalized), transactionId: seed?.id ?? `${rule.id}:${normalized}:transaction` })
  }
  return planned
}

export function generatedTransaction(rule: RecurringRule, occurrence: RecurringOccurrence): TransactionRecord {
  return { id: occurrence.transactionId, userId: "record_1", date: occurrence.dueDate, expense: rule.expense, amountCents: rule.amountCents, category: rule.category, isSplit: false, notes: null, source: "recurring", recurringExpenseId: rule.id, importFingerprint: null, tagId: null, contextId: null, cardId: null, isDeleted: false, createdSequence: 0 }
}

export function monthWindow(month: string): { from: string; to: string } { return monthDateRange(month) }
