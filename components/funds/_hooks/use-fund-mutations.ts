"use client"

import { useCallback } from "react"
import { ApiError } from "@/lib/api/client"
import type { FundDetail, FundEntry, FundListItem } from "@/lib/api/types"
import { createEncryptedRecordId } from "@/lib/privacy/encrypted-records/crypto"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { getCurrentMonthKey } from "@/lib/date-filters"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"
import { deleteEncryptedFundEntry } from "@/lib/privacy/encrypted-authority/fund-operations"

export function useFundMutations() {
  const financialAuthority = useFinancialAuthority()
  const archiveRestore = useCallback(async (fund: FundListItem | FundDetail, action: "archive" | "restore") => {
    try {
      if (financialAuthority.mode !== "encrypted" || !financialAuthority.authority) throw new Error(financialAuthority.mode === "encrypted" ? "ENCRYPTED_AUTHORITY_LOCKED" : "ENCRYPTED_AUTHORITY_REQUIRED")
      const current = financialAuthority.authority.store.values().find((record) => record.family === "fund" && String(record.data.id ?? record.sourceId) === fund.id)
      if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
      await financialAuthority.authority.commitSourceDiff({ creates: [], updates: [{ id: current.envelope.record_id, family: "fund", data: { ...current.data, status: action === "archive" ? "archived" : "active" } }], tombstones: [] })
    } catch (err) { throw err instanceof ApiError ? new Error(err.error.message) : err }
  }, [financialAuthority])

  const saveFund = useCallback(async (mode: "create" | "edit", fund: FundListItem | FundDetail | null, values: { name: string; goal_amount: string; target_month: string; notes: string; starting_balance: string }) => {
    if (financialAuthority.mode !== "encrypted" || !financialAuthority.authority) throw new Error(financialAuthority.mode === "encrypted" ? "ENCRYPTED_AUTHORITY_LOCKED" : "ENCRYPTED_AUTHORITY_REQUIRED")
    const authority = financialAuthority.authority
    const goalAmount = parseMoneyCents(values.goal_amount || "0") > 0 ? values.goal_amount : null
    const targetMonth = goalAmount ? values.target_month || null : null
    if (mode === "create") {
      const id = createEncryptedRecordId()
      const creates = [{ id, family: "fund", data: { id, name: values.name.trim(), fund_type: "goal", goal_amount_cents: goalAmount ? parseMoneyCents(goalAmount) : null, status: "active", sort_order: 0, notes: values.notes.trim() || null } }]
      const startingBalance = values.starting_balance ? parseMoneyCents(values.starting_balance) : 0
      if (startingBalance > 0) { const entryId = createEncryptedRecordId(); creates.push({ id: entryId, family: "fund_ledger_entry", data: { id: entryId, fund_id: id, entry_date: getCurrentMonthKey() + "-01", entry_type: "contribution", direction: "in", amount_cents: startingBalance, source_type: "starting_balance", is_voided: false, is_deleted: false } } as never) }
      await authority.commitSourceDiff({ creates, updates: [], tombstones: [] })
      return
    }
    if (!fund) return
    const current = authority.store.values().find((record) => record.family === "fund" && String(record.data.id ?? record.sourceId) === fund.id)
    if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
    await authority.commitSourceDiff({ creates: [], updates: [{ id: current.envelope.record_id, family: "fund", data: { ...current.data, name: values.name.trim(), goal_amount_cents: goalAmount ? parseMoneyCents(goalAmount) : null, target_month: targetMonth, notes: values.notes.trim() || null } }], tombstones: [] })
  }, [financialAuthority])

  const deleteEntry = useCallback(async (fundId: string, entry: FundEntry) => deleteEncryptedFundEntry({ authority: financialAuthority.authority!, isAuthenticated: true }, fundId, entry), [financialAuthority])
  return { archiveRestore, saveFund, deleteEntry }
}
