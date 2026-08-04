import type { ReplaceSavingsPlanRequest } from "@/lib/api/types"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { resolvedAmounts, resolvedBudget } from "@/lib/domain/financial/budgets"
import { encryptedSavingsPlan } from "./derived"
import { requireEncryptedAuthority, type EncryptedOperationDependencies } from "./authority-adapters"

export function getEncryptedSavingsPlan(deps: EncryptedOperationDependencies, month: string) {
  const authority = requireEncryptedAuthority(deps)
  return encryptedSavingsPlan(authority.getState(), month)
}

export async function replaceEncryptedSavingsPlan(deps: EncryptedOperationDependencies, month: string, request: ReplaceSavingsPlanRequest) {
  const authority = requireEncryptedAuthority(deps)
  const savingsBudgetCents = parseMoneyCents(String(resolvedAmounts(resolvedBudget(authority.getState().budgets, month).settings).savings))
  const prior = authority.store.values().filter((record) => (record.family === "savings_plan" || record.family === "savings_plan_allocation") && String(record.data.month ?? "").slice(0, 7) === month)
  const planId = createEncryptedRecordId()
  const creates = [
    { id: planId, family: "savings_plan", data: { id: planId, month, status: "active", savings_budget_cents: savingsBudgetCents } },
    ...request.allocations.map((allocation) => {
      const id = createEncryptedRecordId()
      return { id, family: "savings_plan_allocation", data: { id, plan_id: planId, month, fund_id: allocation.fund_id, planned_amount_cents: parseMoneyCents(allocation.amount) } }
    }),
  ]
  await authority.commitSourceDiff({ creates, updates: [], tombstones: prior.map((record) => ({ id: record.envelope.record_id, family: record.family, data: record.data })) })
  return encryptedSavingsPlan(authority.getState(), month)
}
