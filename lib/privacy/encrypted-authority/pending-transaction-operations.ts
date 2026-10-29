import { createPendingTransaction, updatePendingTransaction, type PendingTransaction, type PendingTransactionInput } from "@/lib/domain/financial/pending-transactions"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"

/** These operations prepare values in memory. Pending record writes remain disabled. */
export function preparePendingTransaction(deps: EncryptedOperationDependencies, input: PendingTransactionInput): PendingTransaction {
  requireEncryptedAuthority(deps)
  return createPendingTransaction(createEncryptedRecordId(), input)
}

export function preparePendingTransactionUpdate(deps: EncryptedOperationDependencies, current: PendingTransaction, input: PendingTransactionInput): PendingTransaction {
  requireEncryptedAuthority(deps)
  return updatePendingTransaction(current, input)
}

export function getPendingTransactions(deps: EncryptedOperationDependencies): PendingTransaction[] {
  return requireEncryptedAuthority(deps).getState().pendingTransactions.map((item) => ({ ...item }))
}

export async function savePendingTransaction(deps: EncryptedOperationDependencies, pending: PendingTransaction, expectedRevision?: number) {
  const authority = requireEncryptedAuthority(deps)
  const { pendingData } = await import("./pending-lifecycle")
  const existing = authority.store.get(pending.id)
  if (existing && existing.family !== "pending_transaction") throw new Error("PENDING_TRANSACTION_CONFLICT")
  const source = { id: pending.id, family: "pending_transaction", data: pendingData(pending) }
  if (existing && expectedRevision === undefined) throw new Error("PENDING_TRANSACTION_CONFLICT")
  if (!existing && expectedRevision !== undefined) throw new Error("PENDING_TRANSACTION_CONFLICT")
  const diff = existing ? { creates: [], updates: [source], tombstones: [] } : { creates: [source], updates: [], tombstones: [] }
  if (existing) return authority.prepareSourceDiff(diff, undefined, { expectedRevisionOverrides: { [pending.id]: expectedRevision! } })
  return authority.preparePendingCapture(diff)
}
