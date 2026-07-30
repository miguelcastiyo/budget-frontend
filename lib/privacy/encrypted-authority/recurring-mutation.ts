import { getCurrentMonthKey, getLocalDateKey } from "@/lib/date-filters"
import { generatedTransaction, planMaterialization, recurringRuleFromRaw, type RecurringOccurrence } from "@/lib/domain/financial/recurring"
import type { TransactionRecord } from "@/lib/domain/financial/types"
import type { EncryptedFinancialAuthority } from "./authority"
import { createEncryptedRecordId } from "../encrypted-records/crypto"

export async function materializeEncryptedRecurring(authority: EncryptedFinancialAuthority, month: string) {
  const state = authority.getState()
  const rules = state.recurringRules.map((raw) => recurringRuleFromRaw(raw, month))
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
