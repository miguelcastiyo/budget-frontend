import type { CreateTransactionRequest, Transaction, TransactionSuggestionsResponse, UpdateTransactionRequest } from "@/lib/api/types"
import { createTransaction, updateTransaction } from "@/lib/domain/financial/transactions"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { transactionFundDiff, transactionFundState, type SourceMutationDiff } from "@/lib/domain/financial/transaction-fund-diff"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { transactionData, resolveTransactionRecord, requireEncryptedAuthority, uiTransaction, type EncryptedOperationDependencies } from "./authority-adapters"
import { updateEncryptedRecurringTransaction } from "./recurring-commands"
import { transactionSuggestionsFromState } from "@/lib/domain/financial/view-models"

function currentTransactionRecord(current: Transaction, deps: EncryptedOperationDependencies) {
  const authority = requireEncryptedAuthority(deps)
  const record = resolveTransactionRecord(authority, current)
  if (!record) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  return { authority, record }
}

function linkedFundEntry(authority: ReturnType<typeof requireEncryptedAuthority>, record: ReturnType<typeof currentTransactionRecord>["record"]) {
  const ids = [record.envelope.record_id, record.sourceId, String(record.data.id ?? "")].filter(Boolean)
  const linked = authority.store.values().filter((item) => item.family === "fund_ledger_entry" && (item.data.source_type === "transaction" || item.data.source_type == null) && item.data.is_voided !== true && item.data.is_deleted !== true && ids.includes(String(item.data.source_transaction_id ?? "")))
  if (linked.length > 1) throw new Error("This transaction has conflicting fund links. Synchronize and resolve the conflict before editing.")
  return linked[0]
}

function linkedEntryChange(authority: ReturnType<typeof requireEncryptedAuthority>, record: ReturnType<typeof currentTransactionRecord>["record"], nextData: Record<string, unknown>) {
  const entry = linkedFundEntry(authority, record)
  if (!entry) return null
  if (nextData.category !== "savings") throw new Error("A transaction linked to a fund must remain in Savings.")
  const data = { ...entry.data, entry_date: nextData.date, amount_cents: nextData.amount_cents, note: (entry.data.note ?? null) === (record.data.notes ?? null) ? nextData.notes ?? null : entry.data.note }
  return { previous: { id: entry.envelope.record_id, family: entry.family, data: entry.data }, next: { id: entry.envelope.record_id, family: entry.family, data } }
}

function nextTransaction(current: Transaction, input: UpdateTransactionRequest, recordSourceId: string, data: Record<string, unknown>) {
  return updateTransaction({
    id: recordSourceId,
    userId: "authority-user",
    date: current.date,
    expense: current.expense,
    amountCents: parseMoneyCents(current.amount),
    category: current.category,
    isSplit: current.is_split,
    notes: current.notes,
    source: current.source,
    recurringExpenseId: current.recurring_expense_id,
    importFingerprint: data.import_fingerprint == null ? null : String(data.import_fingerprint),
    tagId: current.tag.id || null,
    contextId: current.context?.id ?? null,
    cardId: current.card?.id ?? null,
    isDeleted: false,
    createdSequence: Number(data.createdSequence ?? data.created_sequence ?? 0),
  }, {
    date: input.date,
    expense: input.expense,
    amount: input.amount,
    category: input.category,
    isSplit: input.is_split,
    notes: input.notes,
    tagId: input.tag_id,
    contextId: input.context_id,
    cardId: input.card_id,
  })
}

export async function createEncryptedTransaction(deps: EncryptedOperationDependencies, input: CreateTransactionRequest): Promise<Transaction> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  const record = createTransaction({
    id,
    userId: "authority-user",
    date: input.date,
    expense: input.expense,
    amount: input.amount,
    category: input.category,
    isSplit: input.is_split,
    notes: input.notes,
    tagId: input.tag_id ?? null,
    contextId: input.context_id ?? null,
    cardId: input.card_id ?? null,
  })
  const data = transactionData(record)
  await authority.commitSourceDiff(transactionFundDiff(null, transactionFundState({ id, family: "transaction", data })))
  const saved = authority.store.get(id)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return uiTransaction(authority, saved)
}

export async function updateEncryptedTransaction(deps: EncryptedOperationDependencies, current: Transaction, input: UpdateTransactionRequest): Promise<Transaction> {
  const { authority, record } = currentTransactionRecord(current, deps)
  const next = nextTransaction(current, input, record.sourceId, record.data)
  const recordId = record.envelope.record_id
  const nextData = { ...record.data, ...transactionData(next) }
  const linked = linkedEntryChange(authority, record, nextData)
  await authority.commitSourceDiff(transactionFundDiff(transactionFundState({ id: recordId, family: "transaction", data: record.data }, linked?.previous), transactionFundState({ id: recordId, family: "transaction", data: nextData }, linked?.next)))
  const saved = authority.store.get(recordId)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return uiTransaction(authority, saved)
}

export async function updateEncryptedRecurringTransactionScope(deps: EncryptedOperationDependencies, current: Transaction, input: UpdateTransactionRequest): Promise<Transaction> {
  const { authority, record } = currentTransactionRecord(current, deps)
  const next = nextTransaction(current, input, record.sourceId, record.data)
  const nextData = { ...record.data, ...transactionData(next) }
  const linked = linkedEntryChange(authority, record, nextData)
  await updateEncryptedRecurringTransaction(authority, { id: record.envelope.record_id, family: "transaction", data: record.data }, nextData, linked)
  const saved = authority.store.get(record.envelope.record_id)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return uiTransaction(authority, saved)
}

export function prepareTransactionDeletion(deps: EncryptedOperationDependencies, current: Transaction): SourceMutationDiff {
  const { authority, record } = currentTransactionRecord(current, deps)
  const recordId = record.envelope.record_id
  const ledgerRecord = linkedFundEntry(authority, record)
  const priorEntry = ledgerRecord ? { id: ledgerRecord.envelope.record_id, family: "fund_ledger_entry", data: ledgerRecord.data } : null
  return transactionFundDiff(
    transactionFundState({ id: recordId, family: "transaction", data: record.data }, priorEntry),
    transactionFundState({ id: recordId, family: "transaction", data: { ...record.data, is_deleted: true } }, null),
  )
}

export async function deleteEncryptedTransaction(deps: EncryptedOperationDependencies, current: Transaction): Promise<void> {
  const authority = requireEncryptedAuthority(deps)
  const { record } = currentTransactionRecord(current, deps)
  const linked = linkedFundEntry(authority, record)
  const diff = prepareTransactionDeletion(deps, current)
  if (linked) {
    diff.tombstones = diff.tombstones.filter((item) => item.id !== linked.envelope.record_id)
    diff.updates.push({ id: linked.envelope.record_id, family: linked.family, data: { ...linked.data, is_voided: true, void_reason: "transaction_deleted" } })
  }
  await authority.commitSourceDiff(diff)
}

export function getEncryptedTransactionSuggestions(deps: EncryptedOperationDependencies, query: string, limit = 5): TransactionSuggestionsResponse {
  const authority = requireEncryptedAuthority(deps)
  return transactionSuggestionsFromState(authority.getState(), query, limit)
}
