import type { MonthCloseoutResponse } from "@/lib/api/types"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { encryptedCloseout } from "./derived"
import { commitEncryptedCloseout, reopenEncryptedCloseout } from "./closeout-mutation"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"

export type CloseoutPayload = {
  notes?: string | null
  allocations?: Array<{ allocation_type: string; fund_id?: string | null; amount: string; label?: string | null; target_month?: string | null; notes?: string | null }>
}

export function getEncryptedMonthCloseout(deps: EncryptedOperationDependencies, month: string): MonthCloseoutResponse {
  return encryptedCloseout(requireEncryptedAuthority(deps).getState(), month)
}

export async function closeEncryptedMonth(deps: EncryptedOperationDependencies, month: string, payload: CloseoutPayload): Promise<MonthCloseoutResponse> {
  return commitEncryptedCloseout(requireEncryptedAuthority(deps), month, payload)
}

export async function updateEncryptedMonthCloseout(deps: EncryptedOperationDependencies, month: string, payload: Record<string, unknown>): Promise<MonthCloseoutResponse> {
  const authority = requireEncryptedAuthority(deps)
  const closeout = authority.getState().closeouts.find((item) => String(item.month ?? "") === month)
  if (!closeout) return encryptedCloseout(authority.getState(), month)
  const record = authority.store.values().find((item) => item.family === "month_closeout" && String(item.data.month ?? "") === month)
  if (record) await authority.update(record.envelope.record_id, { ...record.data, ...payload })
  return encryptedCloseout(authority.getState(), month)
}

export async function reopenEncryptedMonth(deps: EncryptedOperationDependencies, month: string): Promise<MonthCloseoutResponse> {
  return reopenEncryptedCloseout(requireEncryptedAuthority(deps), month)
}

export async function createEncryptedMonthCloseout(deps: EncryptedOperationDependencies, month: string, payload: Record<string, unknown>): Promise<MonthCloseoutResponse> {
  const authority = requireEncryptedAuthority(deps)
  const id = createEncryptedRecordId()
  await authority.createSource("month_closeout", "month_closeout_v1", id, { id, month, status: "closed", ...payload })
  return encryptedCloseout(authority.getState(), month)
}
