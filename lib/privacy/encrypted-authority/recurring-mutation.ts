import { getCurrentMonthKey, getLocalDateKey } from "@/lib/date-filters"
import { existingTransactionForOccurrence, generatedTransaction, planMaterialization, recurringRuleFromRaw, sameRecurringReference, type RecurringOccurrence } from "@/lib/domain/financial/recurring"
import type { TransactionRecord } from "@/lib/domain/financial/types"
import type { EncryptedFinancialAuthority } from "./authority"
import { createDeterministicEncryptedRecordId, createDeterministicEncryptedRecordMutationId } from "../encrypted-records/crypto"

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
  const creates = (await Promise.all(planned.map(async (occurrence) => {
    const rule = rules.find((item) => sameRecurringReference(item.id, occurrence.recurringExpenseId))
    if (!rule) return []
    const transaction = generatedTransaction(rule, occurrence)
    // A rule created from an existing transaction links its first occurrence
    // directly to that seed transaction. The seed remains a manual row until
    // rehydration sees the occurrence link, so matching only source="recurring"
    // would create a duplicate for the first month.
    const existingTransaction = existingTransactionForOccurrence(transactions, occurrence, rule)
    const transactionId = existingTransaction?.id ?? await createDeterministicEncryptedRecordId(`recurring-transaction:${rule.id}:${occurrence.occurrenceMonth.slice(0, 7)}`)
    const occurrenceId = await createDeterministicEncryptedRecordId(`recurring-occurrence:${rule.id}:${occurrence.occurrenceMonth.slice(0, 7)}`)
    return [
      ...(existingTransaction ? [] : [{ id: transactionId, family: "transaction", data: { id: transactionId, date: transaction.date, expense: transaction.expense, amount_cents: transaction.amountCents, category: transaction.category, is_split: false, notes: null, source: "recurring", recurring_expense_id: rule.id, tag_id: rule.tagId ?? null, context_id: rule.contextId ?? null, card_id: rule.cardId ?? null, is_deleted: false } }]),
      { id: occurrenceId, family: "recurring_occurrence", data: { id: occurrenceId, recurring_expense_id: rule.id, occurrence_month: occurrence.occurrenceMonth, due_date: occurrence.dueDate, transaction_id: transactionId, is_deleted: false } },
    ]
  }))).flat()
  if (creates.length > 0) {
    const plannedKey = planned.map((occurrence) => `${occurrence.recurringExpenseId}:${occurrence.occurrenceMonth.slice(0, 7)}`).sort().join("|")
    const batchKey = await createDeterministicEncryptedRecordMutationId(`recurring-materialize:${month}:${plannedKey}`)
    await authority.commitSourceDiff({ creates, updates: [], tombstones: [] }, batchKey)
  }
}
