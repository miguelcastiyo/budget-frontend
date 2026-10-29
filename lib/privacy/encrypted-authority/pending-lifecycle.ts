import { createTransaction } from "@/lib/domain/financial/transactions"
import { FinancialDomainError } from "@/lib/domain/financial/errors"
import { formatMoneyCents } from "@/lib/domain/financial/money"
import { transactionFundDiff, transactionFundState, type SourceMutationDiff } from "@/lib/domain/financial/transaction-fund-diff"
import type { PendingTransaction } from "@/lib/domain/financial/pending-transactions"
import { createDeterministicEncryptedRecordId, createEncryptedRecordId } from "../encrypted-records/crypto"
import { requireEncryptedAuthority, sameReference, transactionData, uiTransaction, type EncryptedOperationDependencies } from "./authority-adapters"
import { prepareTransactionDeletion } from "./transaction-operations"
import type { PreparedSourceBatch } from "./authority"

export function pendingFinalizedId(pendingId: string): Promise<string> {
  return createDeterministicEncryptedRecordId(`pending-finalization:v1:${pendingId}`)
}

function assertOpenMonth(deps: EncryptedOperationDependencies, date: string) {
  const closeouts = requireEncryptedAuthority(deps).getState().closeouts
  if (closeouts.some((item) => String(item.month ?? "").slice(0, 7) === date.slice(0, 7) && item.is_deleted !== true && item.is_reopened !== true && item.status === "closed")) throw new Error("PENDING_MONTH_CLOSED")
}

function pendingData(p: PendingTransaction): Record<string, unknown> {
  return { id: p.id, captured_at: p.capturedAt, date: p.date, amount_cents: p.amountCents, description: p.description, category: p.category, tag_id: p.tagId, card_id: p.cardId, context_id: p.contextId, is_split: p.isSplit, notes: p.notes }
}

export type PendingReconciliation = "finalized" | "pending" | "ambiguous"
export async function reconcilePendingFinalization(deps: EncryptedOperationDependencies, pendingId: string): Promise<PendingReconciliation> {
  const authority = requireEncryptedAuthority(deps)
  await authority.bootstrap()
  const pending = authority.store.get(pendingId)
  const transaction = authority.store.get(await pendingFinalizedId(pendingId))
  const validPending = pending?.family === "pending_transaction"
  const validTransaction = transaction?.family === "transaction" && transaction.data.pending_transaction_id === pendingId
  if (!pending && validTransaction) return "finalized"
  if (validPending && !transaction) return "pending"
  return "ambiguous"
}

/** Session state is intentionally in memory and lifecycle writes remain guarded by the authority. */
export class PendingReviewSession {
  private readonly finalizations = new WeakSet<object>()
  private readonly undos = new WeakMap<object, string>()
  private last: { pending: PendingTransaction; transactionId: string; revision: number; ledgerRevisions: Map<string, number> } | null = null
  constructor(private readonly deps: EncryptedOperationDependencies) {}

  async prepareFinalization(pendingId: string): Promise<{ batch: PreparedSourceBatch; pending: PendingTransaction; transactionId: string }> {
    const authority = requireEncryptedAuthority(this.deps)
    await authority.bootstrap()
    const record = authority.store.get(pendingId)
    const pending = authority.getState().pendingTransactions.find((item) => item.id === pendingId)
    if (!record || record.family !== "pending_transaction" || !pending) throw new Error("PENDING_TRANSACTION_NOT_FOUND")
    assertOpenMonth(this.deps, pending.date)
    if (!pending.tagId || !authority.getState().tags.some((tag) => !tag.isDeleted && sameReference(tag.id, pending.tagId!))) throw new FinancialDomainError("VALIDATION_FAILED", "Active tag required", [{ field: "tag", message: "an active tag is required" }])
    const transactionId = await pendingFinalizedId(pendingId)
    const transaction = createTransaction({ id: transactionId, userId: "authority-user", date: pending.date, expense: pending.description ?? "", amount: pending.amountCents === null ? "" : formatMoneyCents(pending.amountCents), category: pending.category ?? "", tagId: pending.tagId, cardId: pending.cardId, contextId: pending.contextId, isSplit: pending.isSplit ?? false, notes: pending.notes })
    const data = { ...transactionData(transaction), pending_transaction_id: pendingId }
    const diff = transactionFundDiff(null, transactionFundState({ id: transactionId, family: "transaction", data }))
    diff.tombstones.push({ id: pendingId, family: "pending_transaction", data: record.data })
    const batch = await authority.prepareSourceDiff(diff, undefined, { expectedRevisionOverrides: { [pendingId]: record.envelope.record_revision } })
    const prepared = { batch, pending: Object.freeze({ ...pending }), transactionId }
    Object.freeze(prepared)
    this.finalizations.add(prepared)
    return prepared
  }

  async finalizePendingTransaction(prepared: { batch: PreparedSourceBatch; pending: PendingTransaction; transactionId: string }): Promise<void> {
    if (!this.finalizations.has(prepared)) throw new Error("PENDING_FINALIZATION_INVALID")
    const authority = requireEncryptedAuthority(this.deps)
    await authority.submitPreparedSourceDiff(prepared.batch)
    const transaction = authority.store.get(prepared.transactionId)
    if (!transaction || transaction.family !== "transaction" || transaction.data.pending_transaction_id !== prepared.pending.id || transaction.envelope.record_revision !== 1) throw new Error("PENDING_FINALIZATION_RECONCILE_REQUIRED")
    const ledgerRevisions = this.ledgerRevisions(prepared.transactionId)
    this.last = { pending: { ...prepared.pending }, transactionId: prepared.transactionId, revision: transaction.envelope.record_revision, ledgerRevisions }
  }

  private ledgerRevisions(transactionId: string): Map<string, number> {
    return new Map(requireEncryptedAuthority(this.deps).store.values().filter((record) => record.family === "fund_ledger_entry" && sameReference(String(record.data.source_transaction_id ?? ""), transactionId)).map((record) => [record.envelope.record_id, record.envelope.record_revision]))
  }

  async prepareUndo(): Promise<PreparedSourceBatch> {
    const last = this.last
    if (!last) throw new Error("PENDING_UNDO_UNAVAILABLE")
    const authority = requireEncryptedAuthority(this.deps)
    await authority.bootstrap()
    const record = authority.store.get(last.transactionId)
    if (!record || record.family !== "transaction" || record.envelope.record_revision !== last.revision) throw new Error("PENDING_UNDO_CONFLICT")
    assertOpenMonth(this.deps, String(record.data.date ?? ""))
    const ledger = this.ledgerRevisions(last.transactionId)
    if (ledger.size !== last.ledgerRevisions.size || [...ledger].some(([id, revision]) => last.ledgerRevisions.get(id) !== revision)) throw new Error("PENDING_UNDO_CONFLICT")
    const diff: SourceMutationDiff = prepareTransactionDeletion(this.deps, uiTransaction(authority, record))
    const restored = { ...last.pending, id: createEncryptedRecordId() }
    diff.creates.push({ id: restored.id, family: "pending_transaction", data: pendingData(restored) })
    const revisions = Object.fromEntries([[record.envelope.record_id, last.revision], ...ledger])
    const batch = await authority.prepareSourceDiff(diff, undefined, { expectedRevisionOverrides: revisions })
    this.undos.set(batch, last.transactionId)
    return batch
  }

  async undo(batch: PreparedSourceBatch): Promise<void> {
    if (!this.last || this.undos.get(batch) !== this.last.transactionId) throw new Error("PENDING_UNDO_UNAVAILABLE")
    await requireEncryptedAuthority(this.deps).submitPreparedSourceDiff(batch)
    this.last = null
  }
}
