import { getCurrentMonthKey } from "@/lib/date-filters"
import { previousMonth, recurringRuleFromRaw, sameRecurringReference } from "@/lib/domain/financial/recurring"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import type { EncryptedFinancialAuthority } from "./authority"

function recurringRecord(authority: EncryptedFinancialAuthority, id: string) {
  return authority.store.get(id) ?? authority.store.values().find((record) => record.family === "recurring_series" && (record.sourceId === id || String(record.data.id ?? "") === id))
}

function withAmount(data: Record<string, unknown>, input: Record<string, unknown>): Record<string, unknown> {
  return { ...data, ...input, amount_cents: input.amount == null ? data.amount_cents : parseMoneyCents(String(input.amount)) }
}

export async function updateEncryptedRecurringExpense(authority: EncryptedFinancialAuthority, id: string, input: Record<string, unknown>): Promise<void> {
  const current = recurringRecord(authority, id)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")

  const currentRule = recurringRuleFromRaw(current.data, getCurrentMonthKey())
  const currentMonth = getCurrentMonthKey()
  const hasHistoricalOccurrence = authority.getState().recurringOccurrences.some((occurrence) => sameRecurringReference(String(occurrence.recurring_expense_id ?? ""), currentRule.id) && String(occurrence.occurrence_month ?? "").slice(0, 7) < currentMonth)
  const requestedStart = String(input.starts_month ?? currentRule.startsMonth).slice(0, 7)

  if (!hasHistoricalOccurrence || requestedStart > currentMonth) {
    await authority.update(current.envelope.record_id, withAmount(current.data, input))
    return
  }

  const effectiveMonth = currentRule.startsMonth > currentMonth ? currentRule.startsMonth : currentMonth
  const nextId = createEncryptedRecordId()
  const prior = { ...current.data, ends_month: previousMonth(effectiveMonth) }
  const next: Record<string, unknown> = { ...withAmount(current.data, input), id: nextId, series_id: current.data.series_id ?? current.data.id, starts_month: effectiveMonth, ends_month: null }
  await authority.commitSourceDiff({ creates: [{ id: nextId, family: "recurring_series", data: next }], updates: [{ id: current.envelope.record_id, family: current.family, data: prior }], tombstones: [] })
}

export async function scheduleEncryptedRecurringExpenseChange(authority: EncryptedFinancialAuthority, id: string, input: Record<string, unknown>): Promise<void> {
  const current = recurringRecord(authority, id)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  const effectiveMonth = String(input.effective_month).slice(0, 7)
  const nextId = createEncryptedRecordId()
  const prior = { ...current.data, ends_month: previousMonth(effectiveMonth) }
  const next: Record<string, unknown> = { ...withAmount(current.data, input), id: nextId, series_id: current.data.series_id ?? current.data.id, starts_month: effectiveMonth, ends_month: null }
  delete next.effective_month
  await authority.commitSourceDiff({ creates: [{ id: nextId, family: "recurring_series", data: next }], updates: [{ id: current.envelope.record_id, family: current.family, data: prior }], tombstones: [] })
}
