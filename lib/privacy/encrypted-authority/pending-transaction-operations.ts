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
