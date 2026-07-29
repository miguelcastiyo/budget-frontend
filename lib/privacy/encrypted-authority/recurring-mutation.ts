import { getCurrentMonthKey, getLocalDateKey } from "@/lib/date-filters"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { generatedTransaction, planMaterialization, type RecurringRule, type RecurringOccurrence } from "@/lib/domain/financial/recurring"
import type { TransactionRecord } from "@/lib/domain/financial/types"
import type { EncryptedFinancialAuthority } from "./authority"
import { createEncryptedRecordId } from "../encrypted-records/crypto"

export async function materializeEncryptedRecurring(authority: EncryptedFinancialAuthority, month: string) {
  const state = authority.getState()
  const rules: RecurringRule[] = state.recurringRules.map((raw) => ({
    id: String(raw.id ?? ""),
    seriesId: String(raw.series_id ?? raw.id ?? ""),
    expense: String(raw.expense ?? ""),
    amountCents: raw.amount_cents == null ? parseMoneyCents(String(raw.amount ?? "0")) : Number(raw.amount_cents),
    category: String(raw.category ?? "needs") as RecurringRule["category"],
    billingType: String(raw.billing_type ?? "day_of_month") as RecurringRule["billingType"],
    billingDay: raw.billing_day == null ? null : Number(raw.billing_day),
    startsMonth: String(raw.starts_month ?? month),
    endsMonth: raw.ends_month == null ? null : String(raw.ends_month),
    isActive: raw.is_active !== false,
    isDeleted: raw.is_deleted === true,
    seedTransactionId: raw.seed_transaction_id == null ? null : String(raw.seed_transaction_id),
  }))
  const existing: RecurringOccurrence[] = state.recurringOccurrences.map((raw) => ({
    id: String(raw.id ?? ""),
    recurringExpenseId: String(raw.recurring_expense_id ?? ""),
    occurrenceMonth: String(raw.occurrence_month ?? "").slice(0, 7) + "-01",
    dueDate: String(raw.due_date ?? ""),
    transactionId: String(raw.transaction_id ?? ""),
  }))
  const transactions: TransactionRecord[] = state.transactions.map((raw) => ({
    id: String(raw.id ?? ""), userId: "authority-user", date: raw.date, expense: raw.expense,
    amountCents: raw.amountCents, category: raw.category, isSplit: raw.isSplit, notes: raw.notes,
    source: raw.source, recurringExpenseId: raw.recurringExpenseId, importFingerprint: raw.importFingerprint,
    tagId: raw.tagId, contextId: raw.contextId, cardId: raw.cardId, isDeleted: raw.isDeleted, createdSequence: 0,
  }))
  const planned = planMaterialization(rules, month, existing, transactions, getCurrentMonthKey(), getLocalDateKey())
  if (planned.length === 0) return
  const creates = planned.flatMap((occurrence) => {
    const rule = rules.find((item) => item.id === occurrence.recurringExpenseId)
    if (!rule) return []
    const transaction = generatedTransaction(rule, occurrence)
    const transactionId = createEncryptedRecordId()
    const occurrenceId = createEncryptedRecordId()
    return [
      { id: transactionId, family: "transaction", data: { id: transactionId, date: transaction.date, expense: transaction.expense, amount_cents: transaction.amountCents, category: transaction.category, is_split: false, notes: null, source: "recurring", recurring_expense_id: rule.id, is_deleted: false } },
      { id: occurrenceId, family: "recurring_occurrence", data: { id: occurrenceId, recurring_expense_id: rule.id, occurrence_month: occurrence.occurrenceMonth, due_date: occurrence.dueDate, transaction_id: transactionId, is_deleted: false } },
    ]
  })
  if (creates.length > 0) await authority.commitSourceDiff({ creates, updates: [], tombstones: [] })
}
