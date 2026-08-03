import { getCurrentMonthKey } from "@/lib/date-filters"
import { previousMonth, recurringRuleFromRaw, sameRecurringReference } from "@/lib/domain/financial/recurring"
import { parseMoneyCents } from "@/lib/domain/financial/money"
import { createEncryptedRecordId } from "../encrypted-records/crypto"
import type { EncryptedFinancialAuthority } from "./authority"
import { validateRecurringRule } from "@/lib/domain/financial/recurring-validation"
import { FinancialDomainError } from "@/lib/domain/financial/errors"

function recurringRecord(authority: EncryptedFinancialAuthority, id: string) {
  return authority.store.get(id) ?? authority.store.values().find((record) => record.family === "recurring_series" && (record.sourceId === id || String(record.data.id ?? "") === id))
}

function withAmount(data: Record<string, unknown>, input: Record<string, unknown>): Record<string, unknown> {
  return { ...data, ...input, amount_cents: input.amount == null ? data.amount_cents : parseMoneyCents(String(input.amount)) }
}

function validate(authority: EncryptedFinancialAuthority, data: Record<string, unknown>): void {
  validateRecurringRule(recurringRuleFromRaw(data, getCurrentMonthKey()), authority.getState())
}

function validateScheduledVersion(
  authority: EncryptedFinancialAuthority,
  current: { sourceId: string; data: Record<string, unknown> },
  prior: Record<string, unknown>,
  next: Record<string, unknown>
): void {
  const state = authority.getState()
  const currentId = current.sourceId
  const rules = state.recurringRules.map((raw) => {
    const rawId = String(raw.id ?? raw.source_id ?? raw.sourceId ?? "")
    return rawId === currentId || sameRecurringReference(rawId, currentId) ? prior : raw
  })
  validateRecurringRule(recurringRuleFromRaw(next, getCurrentMonthKey()), { ...state, recurringRules: rules })
}

function assertEffectiveMonthAvailable(authority: EncryptedFinancialAuthority, rule: ReturnType<typeof recurringRuleFromRaw>, month: string): void {
  const conflict = authority.getState().recurringOccurrences.some((occurrence) => {
    if (String(occurrence.occurrence_month ?? "").slice(0, 7) !== month || !occurrence.transaction_id) return false
    const source = authority.getState().recurringRules.find((raw) => sameRecurringReference(String(raw.id ?? raw.source_id ?? ""), String(occurrence.recurring_expense_id ?? "")))
    return source != null && String(source.series_id ?? source.seriesId ?? source.id ?? source.source_id) === rule.seriesId
  })
  if (conflict) throw new FinancialDomainError("RECURRING_EFFECTIVE_MONTH_ALREADY_MATERIALIZED")
}

export async function updateEncryptedRecurringExpense(authority: EncryptedFinancialAuthority, id: string, input: Record<string, unknown>): Promise<void> {
  const current = recurringRecord(authority, id)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")

  const currentRule = recurringRuleFromRaw(current.data, getCurrentMonthKey())
  const currentMonth = getCurrentMonthKey()
  const hasHistoricalOccurrence = authority.getState().recurringOccurrences.some((occurrence) => sameRecurringReference(String(occurrence.recurring_expense_id ?? ""), currentRule.id) && String(occurrence.occurrence_month ?? "").slice(0, 7) < currentMonth)
  const requestedStart = String(input.starts_month ?? currentRule.startsMonth).slice(0, 7)

  if (!hasHistoricalOccurrence || requestedStart > currentMonth) {
    const next = withAmount(current.data, input)
    validate(authority, next)
    await authority.update(current.envelope.record_id, next)
    return
  }

  const effectiveMonth = currentRule.startsMonth > currentMonth ? currentRule.startsMonth : currentMonth
  const nextId = createEncryptedRecordId()
  const prior = { ...current.data, ends_month: previousMonth(effectiveMonth) }
  const next: Record<string, unknown> = { ...withAmount(current.data, input), id: nextId, series_id: current.data.series_id ?? current.data.id, starts_month: effectiveMonth, ends_month: null }
  validateScheduledVersion(authority, current, prior, next)
  await authority.commitSourceDiff({ creates: [{ id: nextId, family: "recurring_series", data: next }], updates: [{ id: current.envelope.record_id, family: current.family, data: prior }], tombstones: [] })
}

export async function scheduleEncryptedRecurringExpenseChange(authority: EncryptedFinancialAuthority, id: string, input: Record<string, unknown>): Promise<void> {
  const current = recurringRecord(authority, id)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  const effectiveMonth = String(input.effective_month).slice(0, 7)
  if (effectiveMonth <= getCurrentMonthKey()) throw new FinancialDomainError("RECURRING_EFFECTIVE_MONTH_IN_PAST")
  const sourceRule = recurringRuleFromRaw(current.data, getCurrentMonthKey())
  const hasScheduledChange = authority.getState().recurringRules.some((raw) => {
    const rule = recurringRuleFromRaw(raw, getCurrentMonthKey())
    return rule.seriesId === sourceRule.seriesId && rule.id !== sourceRule.id && rule.startsMonth > sourceRule.startsMonth && rule.isActive && !rule.isDeleted
  })
  if (hasScheduledChange) throw new FinancialDomainError("RECURRING_CHANGE_ALREADY_SCHEDULED")
  if (effectiveMonth <= sourceRule.startsMonth || (sourceRule.endsMonth !== null && effectiveMonth > sourceRule.endsMonth)) throw new FinancialDomainError("RECURRING_VERSION_CONFLICT")
  const requestedAmountCents = input.amount == null ? sourceRule.amountCents : parseMoneyCents(String(input.amount))
  const requestedBillingType = String(input.billing_type ?? sourceRule.billingType) as typeof sourceRule.billingType
  const requestedBillingDay = requestedBillingType === "last_day" ? null : input.billing_day == null ? sourceRule.billingDay : Number(input.billing_day)
  if (requestedAmountCents === sourceRule.amountCents && requestedBillingType === sourceRule.billingType && requestedBillingDay === sourceRule.billingDay) {
    throw new FinancialDomainError("RECURRING_NO_OP_CHANGE")
  }
  assertEffectiveMonthAvailable(authority, sourceRule, effectiveMonth)
  const nextId = createEncryptedRecordId()
  const prior = { ...current.data, ends_month: previousMonth(effectiveMonth) }
  const next: Record<string, unknown> = { ...withAmount(current.data, input), id: nextId, series_id: current.data.series_id ?? current.data.id, starts_month: effectiveMonth, ends_month: null }
  delete next.effective_month
  validateScheduledVersion(authority, current, prior, next)
  await authority.commitSourceDiff({ creates: [{ id: nextId, family: "recurring_series", data: next }], updates: [{ id: current.envelope.record_id, family: current.family, data: prior }], tombstones: [] })
}

export async function cancelEncryptedRecurringExpenseChange(authority: EncryptedFinancialAuthority, currentId: string, scheduledId: string): Promise<void> {
  const current = recurringRecord(authority, currentId)
  const scheduled = recurringRecord(authority, scheduledId)
  if (!current || !scheduled) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")

  const currentRule = recurringRuleFromRaw(current.data, getCurrentMonthKey())
  const scheduledRule = recurringRuleFromRaw(scheduled.data, getCurrentMonthKey())
  if (currentRule.seriesId !== scheduledRule.seriesId || scheduledRule.startsMonth <= currentRule.startsMonth) {
    throw new FinancialDomainError("RECURRING_VERSION_CONFLICT")
  }

  const hasMaterializedOccurrence = authority.getState().recurringOccurrences.some((occurrence) =>
    sameRecurringReference(String(occurrence.recurring_expense_id ?? ""), scheduledRule.id)
    && Boolean(occurrence.transaction_id)
  )
  if (hasMaterializedOccurrence) throw new FinancialDomainError("RECURRING_SCHEDULE_ALREADY_MATERIALIZED")

  const expectedEnd = previousMonth(scheduledRule.startsMonth)
  if (String(current.data.ends_month ?? "") !== expectedEnd) {
    throw new FinancialDomainError("RECURRING_VERSION_CONFLICT")
  }

  await authority.commitSourceDiff({
    creates: [],
    updates: [{ id: current.envelope.record_id, family: current.family, data: { ...current.data, ends_month: null } }],
    tombstones: [{ id: scheduled.envelope.record_id, family: scheduled.family, data: scheduled.data }],
  })
}

export async function createEncryptedRecurringExpense(authority: EncryptedFinancialAuthority, input: Record<string, unknown>): Promise<void> {
  const id = createEncryptedRecordId()
  const data = { id, series_id: id, ...input, amount_cents: parseMoneyCents(String(input.amount ?? "0")), starts_month: input.starts_month ?? getCurrentMonthKey(), ends_month: input.ends_month ?? null, is_active: input.is_active ?? true, is_deleted: false }
  validate(authority, data)
  await authority.createSource("recurring_series", "recurring_series_v1", id, data)
}

export async function deleteEncryptedRecurringExpense(authority: EncryptedFinancialAuthority, id: string): Promise<void> {
  const current = recurringRecord(authority, id)
  if (!current) throw new Error("ENCRYPTED_RECORD_NOT_FOUND")
  const currentRule = recurringRuleFromRaw(current.data, getCurrentMonthKey())
  const hasFutureVersion = authority.getState().recurringRules.some((raw) => {
    const rule = recurringRuleFromRaw(raw, getCurrentMonthKey())
    return rule.seriesId === currentRule.seriesId
      && rule.id !== currentRule.id
      && rule.startsMonth > currentRule.startsMonth
      && rule.isActive
      && !rule.isDeleted
  })
  if (hasFutureVersion) throw new FinancialDomainError("RECURRING_SCHEDULE_MUST_BE_CANCELED")
  await authority.commitSourceDiff({ creates: [], updates: [], tombstones: [{ id: current.envelope.record_id, family: current.family, data: current.data }] })
}
