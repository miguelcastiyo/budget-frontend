import type { EncryptedFinancialAuthority, PreparedSourceBatch } from "@/lib/privacy/encrypted-authority/authority"

export type DataRecoveryMarker = { kind: "import" | "rollback"; runId: string }
type PreparedOperation = { authority: WeakRef<EncryptedFinancialAuthority>; batch: PreparedSourceBatch; uncertain: boolean; inFlight: boolean }
const preparedOperations = new Map<string, PreparedOperation>()
const key = (account: string) => `budget.data-operation-recovery.${encodeURIComponent(account)}`

// Only opaque run IDs are stored. A missing or inaccessible storage area cannot
// safely be treated as proof that no earlier write is outstanding.
export function readDataRecovery(account: string): DataRecoveryMarker | null {
  const raw = localStorage.getItem(key(account))
  if (!raw) return null
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object") throw new Error("DATA_RECOVERY_INVALID")
  const marker = parsed as DataRecoveryMarker
  if ((marker.kind !== "import" && marker.kind !== "rollback") || typeof marker.runId !== "string" || !marker.runId) throw new Error("DATA_RECOVERY_INVALID")
  return marker
}
export function rememberDataOperation(account: string, marker: DataRecoveryMarker, operation: PreparedOperation) {
  if (!account || readDataRecovery(account)) throw new Error("DATA_RECOVERY_PENDING")
  localStorage.setItem(key(account), JSON.stringify(marker))
  preparedOperations.set(account, operation)
}
export function preparedDataOperation(account: string) { return preparedOperations.get(account) }
export function forgetPreparedDataOperation(account: string) { preparedOperations.delete(account) }
export function clearDataOperation(account: string, marker: DataRecoveryMarker) {
  const current = readDataRecovery(account)
  if (!current || current.kind !== marker.kind || current.runId !== marker.runId) throw new Error("DATA_RECOVERY_CHANGED")
  localStorage.removeItem(key(account))
  preparedOperations.delete(account)
}
