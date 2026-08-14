import { createEncryptedRecordId } from "../encrypted-records/crypto"
import type { EncryptedFinancialAuthority } from "./authority"

export async function saveEncryptedBudget(authority: EncryptedFinancialAuthority, month: string, payload: Record<string, unknown>): Promise<void> {
  const existing = authority.store.values().find((record) => record.family === "budget_version" && String(record.data.effective_month ?? "").startsWith(month))
  if (existing) await authority.update(existing.envelope.record_id, { ...existing.data, ...payload })
  else await authority.createSource("budget_version", "budget_version_v1", createEncryptedRecordId(), payload)
}
