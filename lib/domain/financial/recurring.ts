import { daysInMonth, monthDateRange, monthKey } from "./clock"
import { parseMoneyCents } from "./money"
import type { TransactionRecord } from "./types"

export interface RecurringRule {
  id: string; seriesId: string; expense: string; amountCents: number; category: "needs" | "wants" | "savings"
  billingType: "day_of_month" | "last_day"; billingDay: number | null; startsMonth: string; endsMonth: string | null
  isActive: boolean; isDeleted: boolean; seedTransactionId?: string | null
}

export interface RecurringOccurrence { id: string; recurringExpenseId: string; occurrenceMonth: string; dueDate: string; transactionId: string }

export function sameRecurringReference(left: unknown, right: unknown): boolean {
  if (left == null || right == null) return false
  const first = String(left)
  const second = String(right)
  if (first === second) return true
  return first.split(":").pop() === second.split(":").pop()
}

function rawString(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value)
}

function rawBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null) return defaultValue
  return value === true || value === 1 || value === "1" || value === "true"
}

function rawMonth(value: unknown, fallback: string): string {
  const text = rawString(value, fallback)
  const month = text.match(/^\d{4}-\d{2}/)?.[0] ?? rawString(fallback).match(/^\d{4}-\d{2}/)?.[0]
  return monthKey(month ?? fallback)
}

/** Normalize both legacy snapshot rows and client-created encrypted rows. */
export function recurringRuleFromRaw(raw: Record<string, unknown>, fallbackMonth: string): RecurringRule {
  const starts = raw.starts_month ?? raw.startsMonth
  const ends = raw.ends_month ?? raw.endsMonth
  const amount = raw.amount_cents ?? raw.amountCents
  return {
    id: rawString(raw.id ?? raw.source_id ?? raw.sourceId),
    seriesId: rawString(raw.series_id ?? raw.seriesId ?? raw.id ?? raw.source_id ?? raw.sourceId),
    expense: rawString(raw.expense),
    amountCents: amount === null || amount === undefined ? parseMoneyCents(rawString(raw.amount ?? "0")) : Number(amount),
    category: rawString(raw.category, "needs") as RecurringRule["category"],
    billingType: rawString(raw.billing_type ?? raw.billingType, "day_of_month") as RecurringRule["billingType"],
    billingDay: raw.billing_day == null && raw.billingDay == null ? null : Number(raw.billing_day ?? raw.billingDay),
    startsMonth: rawMonth(starts, fallbackMonth),
    endsMonth: ends == null || ends === "" ? null : rawMonth(ends, fallbackMonth),
    isActive: rawBoolean(raw.is_active ?? raw.isActive, true),
    isDeleted: rawBoolean(raw.is_deleted ?? raw.isDeleted, false),
    seedTransactionId: raw.seed_transaction_id == null && raw.seedTransactionId == null ? null : rawString(raw.seed_transaction_id ?? raw.seedTransactionId),
  }
}

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

export function planMaterialization(rules: RecurringRule[], month: string, existing: RecurringOccurrence[], transactions: TransactionRecord[], currentMonth: string, currentDate?: string): RecurringOccurrence[] {
  const normalized = monthKey(month)
  if (normalized > monthKey(currentMonth)) return []
  const planned: RecurringOccurrence[] = []
  for (const rule of resolveRules(rules, normalized)) {
    const due = dueDate(rule, normalized)
    if (currentDate && normalized === monthKey(currentMonth) && due > currentDate) continue
    if (existing.some((occurrence) => sameRecurringReference(occurrence.recurringExpenseId, rule.id) && monthKey(String(occurrence.occurrenceMonth).slice(0, 7)) === normalized)) continue
    const seed = rule.seedTransactionId ? transactions.find((transaction) => transaction.id === rule.seedTransactionId && transaction.date.slice(0, 7) === normalized) : undefined
    planned.push({ id: `${rule.id}:${normalized}`, recurringExpenseId: rule.id, occurrenceMonth: `${normalized}-01`, dueDate: due, transactionId: seed?.id ?? `${rule.id}:${normalized}:transaction` })
  }
  return planned
}

export function generatedTransaction(rule: RecurringRule, occurrence: RecurringOccurrence): TransactionRecord {
  return { id: occurrence.transactionId, userId: "record_1", date: occurrence.dueDate, expense: rule.expense, amountCents: rule.amountCents, category: rule.category, isSplit: false, notes: null, source: "recurring", recurringExpenseId: rule.id, importFingerprint: null, tagId: null, contextId: null, cardId: null, isDeleted: false, createdSequence: 0 }
}

export function monthWindow(month: string): { from: string; to: string } { return monthDateRange(month) }
