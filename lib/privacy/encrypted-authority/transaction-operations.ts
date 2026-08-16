import type { CreateTransactionRequest, Transaction, TransactionSuggestionsResponse, UpdateTransactionRequest } from "@/lib/api/types"
import { createTransaction, updateTransaction } from "@/lib/domain/financial/transactions"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { transactionFundDiff, transactionFundState } from "@/lib/domain/financial/transaction-fund-diff"
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

function nextTransaction(current: Transaction, input: UpdateTransactionRequest, recordSourceId: string) {
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
    importFingerprint: null,
    tagId: current.tag.id || null,
    contextId: current.context?.id ?? null,
    cardId: current.card?.id ?? null,
    isDeleted: false,
    createdSequence: 0,
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
  const next = nextTransaction(current, input, record.sourceId)
  const recordId = record.envelope.record_id
  const nextData = transactionData(next)
  await authority.commitSourceDiff(transactionFundDiff(transactionFundState({ id: recordId, family: "transaction", data: record.data }), transactionFundState({ id: recordId, family: "transaction", data: nextData })))
  const saved = authority.store.get(recordId)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return uiTransaction(authority, saved)
}

export async function updateEncryptedRecurringTransactionScope(deps: EncryptedOperationDependencies, current: Transaction, input: UpdateTransactionRequest): Promise<Transaction> {
  const { authority, record } = currentTransactionRecord(current, deps)
  const next = nextTransaction(current, input, record.sourceId)
  const nextData = transactionData(next)
  await updateEncryptedRecurringTransaction(authority, { id: record.envelope.record_id, family: "transaction", data: record.data }, nextData)
  const saved = authority.store.get(record.envelope.record_id)
  if (!saved) throw new Error("ENCRYPTED_AUTHORITY_STATE_INVALID")
  return uiTransaction(authority, saved)
}

export async function deleteEncryptedTransaction(deps: EncryptedOperationDependencies, current: Transaction): Promise<void> {
  const { authority, record } = currentTransactionRecord(current, deps)
  const recordId = record.envelope.record_id
  const ledger = authority.getState().fundLedgerEntries.find((item) => {
    const source = String(item.source_transaction_id ?? "")
    return source === current.id || source === record.sourceId || (Number.isFinite(Number(source)) && Number.isFinite(Number(current.id)) && Number(source) === Number(current.id)) || (Number.isFinite(Number(source)) && Number.isFinite(Number(record.sourceId)) && Number(source) === Number(record.sourceId))
  })
  const ledgerRecord = ledger ? authority.store.values().find((item) => item.family === "fund_ledger_entry" && (String(item.data.id ?? "") === String(ledger.id) || item.sourceId === String(ledger.id))) : undefined
  const priorEntry = ledgerRecord ? { id: ledgerRecord.envelope.record_id, family: "fund_ledger_entry", data: ledgerRecord.data } : null
  await authority.commitSourceDiff(transactionFundDiff(
    transactionFundState({ id: recordId, family: "transaction", data: record.data }, priorEntry),
    transactionFundState({ id: recordId, family: "transaction", data: { ...record.data, is_deleted: true } }, null),
  ))
}

export function getEncryptedTransactionSuggestions(deps: EncryptedOperationDependencies, query: string, limit = 5): TransactionSuggestionsResponse {
  const authority = requireEncryptedAuthority(deps)
  return transactionSuggestionsFromState(authority.getState(), query, limit)
}
