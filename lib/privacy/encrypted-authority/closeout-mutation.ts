import type { EncryptedFinancialAuthority } from "./authority"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { encryptedCloseout } from "./derived"

type CloseoutPayload = {
  notes?: string | null
  allocations?: Array<{
    allocation_type: string
    fund_id?: string | null
    amount: string
    label?: string | null
    target_month?: string | null
    notes?: string | null
  }>
}

export async function commitEncryptedCloseout(
  authority: EncryptedFinancialAuthority,
  month: string,
  payload: CloseoutPayload,
) {
  const state = authority.getState()
  const priorCloseouts = authority.store.values().filter((record) =>
    record.family === "month_closeout" && String(record.data.month ?? "") === month,
  )
  const priorCloseoutIds = new Set(priorCloseouts.map((record) => String(record.data.id ?? record.sourceId)))
  const priorAllocations = authority.store.values().filter((record) =>
    record.family === "closeout_allocation" &&
    (String(record.data.month ?? record.data.closeout_month ?? "") === month || priorCloseoutIds.has(String(record.data.closeout_id ?? ""))),
  )
  const priorAllocationIds = new Set(priorAllocations.map((record) => String(record.data.id ?? record.sourceId)))
  const priorLedgerEntries = authority.store.values().filter((record) =>
    record.family === "fund_ledger_entry" &&
    (priorCloseoutIds.has(String(record.data.source_closeout_id ?? "")) || priorAllocationIds.has(String(record.data.source_closeout_allocation_id ?? ""))),
  )

  const computed = encryptedCloseout(state, month).computed
  if (!computed) throw new Error("MONTH_CLOSEOUT_NOT_CLOSEABLE")
  const closeoutId = createEncryptedRecordId()
  const closeoutData = {
    id: closeoutId,
    month,
    status: "closed",
    result_type: computed.result_type,
    surplus_amount_cents: parseMoneyCents(computed.surplus_amount),
    deficit_amount_cents: parseMoneyCents(computed.deficit_amount),
    notes: payload.notes ?? null,
    is_reopened: false,
    is_deleted: false,
  }
  const creates: Array<{ id: string; family: string; data: Record<string, unknown> }> = [
    { id: closeoutId, family: "month_closeout", data: closeoutData },
  ]
  for (const allocation of payload.allocations ?? []) {
    const allocationId = createEncryptedRecordId()
    const amountCents = parseMoneyCents(allocation.amount)
    creates.push({
      id: allocationId,
      family: "closeout_allocation",
      data: {
        id: allocationId,
        closeout_id: closeoutId,
        month,
        allocation_type: allocation.allocation_type,
        fund_id: allocation.fund_id ?? null,
        amount_cents: amountCents,
        label: allocation.label ?? null,
        target_month: allocation.target_month ?? null,
        notes: allocation.notes ?? null,
        is_deleted: false,
      },
    })
    if (allocation.allocation_type === "fund" && allocation.fund_id) {
      const entryId = createEncryptedRecordId()
      creates.push({
        id: entryId,
        family: "fund_ledger_entry",
        data: {
          id: entryId,
          fund_id: allocation.fund_id,
          entry_date: `${month}-28`,
          entry_type: "contribution",
          direction: "in",
          amount_cents: amountCents,
          source_type: "month_closeout",
          source_closeout_id: closeoutId,
          source_closeout_allocation_id: allocationId,
          is_voided: false,
          is_deleted: false,
        },
      })
    }
  }

  await authority.commitSourceDiff({
    creates,
    updates: [],
    tombstones: [...priorCloseouts, ...priorAllocations, ...priorLedgerEntries].map((record) => ({
      id: record.envelope.record_id,
      family: record.family,
      data: record.data,
    })),
  })
  return encryptedCloseout(authority.getState(), month)
}

export async function reopenEncryptedCloseout(authority: EncryptedFinancialAuthority, month: string) {
  const closeout = authority.store.values().find((record) =>
    record.family === "month_closeout" && String(record.data.month ?? "") === month && record.data.is_deleted !== true,
  )
  if (!closeout) return encryptedCloseout(authority.getState(), month)
  const closeoutId = String(closeout.data.id ?? closeout.sourceId)
  const ledgerEntries = authority.store.values().filter((record) =>
    record.family === "fund_ledger_entry" && String(record.data.source_closeout_id ?? "") === closeoutId && record.data.is_deleted !== true,
  )
  await authority.commitSourceDiff({
    creates: [],
    updates: [
      { id: closeout.envelope.record_id, family: "month_closeout", data: { ...closeout.data, status: "reopened", is_reopened: true } },
      ...ledgerEntries.map((record) => ({ id: record.envelope.record_id, family: "fund_ledger_entry", data: { ...record.data, is_voided: true } })),
    ],
    tombstones: [],
  })
  return encryptedCloseout(authority.getState(), month)
}
