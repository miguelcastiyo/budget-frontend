import type { Card, Context, FundEntry, FundListItem, Transaction } from "@/lib/api/types"
import { formatMoneyCents, parseMoneyCents } from "@/lib/domain/financial/money"
import type { SourceRecord } from "@/lib/domain/financial/transaction-fund-diff"
import { EncryptedFinancialAuthority } from "./authority"
import type { DecryptedFinancialRecord } from "./record-store"

export type EncryptedOperationDependencies = {
  authority: EncryptedFinancialAuthority
  isAuthenticated: boolean
}

export function requireEncryptedAuthority(deps: EncryptedOperationDependencies): EncryptedFinancialAuthority {
  if (!deps.isAuthenticated) throw new Error("ENCRYPTED_AUTHORITY_LOCKED")
  return deps.authority
}

export function sameReference(left: string, right: string): boolean {
  return left.trim() === right.trim() || (Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right))
}

export function resolveRecord(authority: EncryptedFinancialAuthority, family: string, id: string): DecryptedFinancialRecord | undefined {
  return authority.store.get(id) ?? authority.store.values().find((record) => record.family === family && (
    record.sourceId === id ||
    String(record.data.id ?? "") === id ||
    (Number.isFinite(Number(record.sourceId)) && Number.isFinite(Number(id)) && Number(record.sourceId) === Number(id)) ||
    (Number.isFinite(Number(record.data.id)) && Number.isFinite(Number(id)) && Number(record.data.id) === Number(id))
  ))
}

export function resolveTransactionRecord(authority: EncryptedFinancialAuthority, transaction: Transaction): DecryptedFinancialRecord | undefined {
  return resolveRecord(authority, "transaction", transaction.id)
}

export function resolveFundEntryRecord(authority: EncryptedFinancialAuthority, entry: FundEntry): DecryptedFinancialRecord | undefined {
  return resolveRecord(authority, "fund_ledger_entry", entry.id)
}

export function resolveRecurringRecord(authority: EncryptedFinancialAuthority, id: string): DecryptedFinancialRecord | undefined {
  return resolveRecord(authority, "recurring_series", id)
}

export function transactionData(record: { amountCents: number; isSplit: boolean; tagId: string | null; contextId: string | null; cardId: string | null; recurringExpenseId: string | null; importFingerprint: string | null; isDeleted: boolean }): Record<string, unknown> {
  return {
    ...record,
    amount_cents: record.amountCents,
    is_split: record.isSplit,
    tag_id: record.tagId,
    context_id: record.contextId,
    card_id: record.cardId,
    recurring_expense_id: record.recurringExpenseId,
    import_fingerprint: record.importFingerprint,
    is_deleted: record.isDeleted,
  }
}

export function transactionSource(record: DecryptedFinancialRecord): SourceRecord {
  return { id: record.envelope.record_id, family: record.family, data: record.data }
}

export function uiTransaction(authority: EncryptedFinancialAuthority, record: { sourceId: string; data: Record<string, unknown> }): Transaction {
  const state = authority.getState()
  const tagId = record.data.tag_id == null ? "" : String(record.data.tag_id)
  const contextId = record.data.context_id == null ? null : String(record.data.context_id)
  const cardId = record.data.card_id == null ? null : String(record.data.card_id)
  const tag = state.tags.find((item) => sameReference(item.id, tagId) || item.name.trim().toLocaleLowerCase() === tagId.trim().toLocaleLowerCase())
  const context = contextId == null ? null : state.contexts.find((item) => sameReference(item.id, contextId) || item.name.trim().toLocaleLowerCase() === contextId.trim().toLocaleLowerCase())
  const card = cardId == null ? null : state.cards.find((item) => sameReference(item.id, cardId) || item.name.trim().toLocaleLowerCase() === cardId.trim().toLocaleLowerCase())
  const source = String(record.data.source ?? "manual")
  return {
    id: record.sourceId,
    date: String(record.data.date ?? record.data.transaction_date ?? ""),
    expense: String(record.data.expense ?? ""),
    amount: formatMoneyCents(Number(record.data.amount_cents ?? 0)),
    category: String(record.data.category ?? "needs") as Transaction["category"],
    is_split: record.data.is_split === true,
    notes: record.data.notes == null ? null : String(record.data.notes),
    source: source === "recurring" ? "recurring" : source === "import" ? "import" : "manual",
    recurring_expense_id: record.data.recurring_expense_id == null ? null : String(record.data.recurring_expense_id),
    tag: { id: tagId, name: tag?.name ?? "", icon_key: tag?.iconKey ?? null },
    context: contextId == null ? null : { id: contextId, name: context?.name ?? "", icon_key: context?.iconKey ?? null },
    card: cardId == null ? null : { id: cardId, name: card?.name ?? "", is_favorite: card?.isFavorite ?? false },
    created_at: "",
    updated_at: "",
  }
}

export function fundEntrySourceId(authority: EncryptedFinancialAuthority, data: Record<string, unknown>): string {
  const rawId = String(data.id ?? "")
  return authority.store.values().find((record) => record.family === "fund_ledger_entry" && String(record.data.id ?? "") === rawId)?.envelope.record_id ?? rawId
}

export function fundEntryFromData(data: Record<string, unknown>, id: string, fundId: string): FundEntry {
  return {
    id,
    fund_id: fundId,
    entry_date: String(data.entry_date ?? ""),
    entry_type: String(data.entry_type ?? "contribution") as FundEntry["entry_type"],
    direction: String(data.direction ?? "in") as FundEntry["direction"],
    amount: formatMoneyCents(data.amount_cents == null ? parseMoneyCents(String(data.amount ?? "0")) : Number(data.amount_cents)),
    source_type: String(data.source_type ?? "manual") as FundEntry["source_type"],
    source_month: null,
    source_transaction_id: data.source_transaction_id == null ? null : String(data.source_transaction_id),
    source_closeout_id: data.source_closeout_id == null ? null : String(data.source_closeout_id),
    note: data.note == null ? null : String(data.note),
    created_at: "",
    updated_at: "",
  }
}
