"use client"

import type { RecurringExpense, RecurringBillingType } from "@/lib/api/types"
import { formatDateValue, getCurrentMonthKey, getLocalDateKey } from "@/lib/date-filters"
import { getCommitmentDisplayStatus, type CommitmentDisplayStatus } from "./recurring-status"

export type CommitmentOccurrenceStatus = CommitmentDisplayStatus
export type CommitmentLifecycleStatus = "active" | "paused" | "ended" | "starts_later"
export type CommitmentSeriesState = "current" | "has_scheduled_change" | "changed_this_month"

export interface RecurringSeriesEntry {
  seriesId: string
  currentItem: RecurringExpense
  seriesItems: RecurringExpense[]
  nextScheduledItem: RecurringExpense | null
  occurrenceStatus: CommitmentOccurrenceStatus
  seriesState: CommitmentSeriesState
}

export function isMonthWithinRecurringWindow(rule: RecurringExpense, selectedMonth: string): boolean {
  if (rule.starts_month > selectedMonth) {
    return false
  }

  return rule.ends_month === null || rule.ends_month >= selectedMonth
}

export function getRecurringLifecycleStatus(
  rule: RecurringExpense,
  selectedMonth: string
): CommitmentLifecycleStatus {
  if (selectedMonth < rule.starts_month) {
    return "starts_later"
  }

  if (rule.ends_month && selectedMonth > rule.ends_month) {
    return "ended"
  }

  if (!rule.is_active) {
    return "paused"
  }

  return "active"
}

export function getRecurringOccurrenceStatus(
  rule: RecurringExpense,
  selectedMonth: string,
  today = new Date()
): CommitmentOccurrenceStatus {
  if (rule.generated_for_month) {
    return "logged"
  }

  const normalizedMonth = selectedMonth.slice(0, 7)
  const currentMonth = getCurrentMonthKey(today)
  if (normalizedMonth < currentMonth) {
    return "due"
  }
  if (normalizedMonth > currentMonth) {
    return "upcoming"
  }

  return getCommitmentDisplayStatus(rule, getLocalDateKey(today))
}

export function groupRecurringRulesBySeries(items: RecurringExpense[]): Map<string, RecurringExpense[]> {
  const grouped = new Map<string, RecurringExpense[]>()

  items.forEach((item) => {
    const existing = grouped.get(item.series_id) ?? []
    existing.push(item)
    grouped.set(item.series_id, existing)
  })

  grouped.forEach((seriesItems, key) => {
    grouped.set(
      key,
      [...seriesItems].sort((first, second) => {
        const monthCompare = first.starts_month.localeCompare(second.starts_month)
        if (monthCompare !== 0) {
          return monthCompare
        }

        return first.id.localeCompare(second.id)
      })
    )
  })

  return grouped
}

export function getVersionForMonth(
  seriesItems: RecurringExpense[],
  selectedMonth: string
): RecurringExpense | null {
  const ordered = [...seriesItems].sort((first, second) => first.starts_month.localeCompare(second.starts_month) || first.id.localeCompare(second.id))
  const started = ordered.filter((item) => item.starts_month <= selectedMonth)
  const current = started[started.length - 1] ?? null
  if (!current || !isMonthWithinRecurringWindow(current, selectedMonth)) {
    return null
  }

  return current
}

export const getActiveVersionForMonth = getVersionForMonth

export function getNextScheduledVersion(
  seriesItems: RecurringExpense[],
  selectedMonth: string
): RecurringExpense | null {
  return seriesItems.find((item) => item.is_active && item.starts_month > selectedMonth) ?? null
}

export function hasFutureScheduledChange(
  seriesItems: RecurringExpense[],
  selectedMonth: string
): boolean {
  return getNextScheduledVersion(seriesItems, selectedMonth) !== null
}

export function getSeriesState(
  currentItem: RecurringExpense,
  seriesItems: RecurringExpense[],
  selectedMonth: string
): CommitmentSeriesState {
  if (hasFutureScheduledChange(seriesItems, selectedMonth)) {
    return "has_scheduled_change"
  }

  if (currentItem.starts_month === selectedMonth && seriesItems.some((item) => item.id !== currentItem.id && item.starts_month < selectedMonth)) {
    return "changed_this_month"
  }

  return "current"
}

export function buildRecurringSeriesEntries(
  items: RecurringExpense[],
  selectedMonth: string,
  today = new Date()
): RecurringSeriesEntry[] {
  const grouped = groupRecurringRulesBySeries(items)
  const entries: RecurringSeriesEntry[] = []

  grouped.forEach((seriesItems, seriesId) => {
    const currentItem = getVersionForMonth(seriesItems, selectedMonth)
    if (!currentItem) {
      return
    }

    entries.push({
      seriesId,
      currentItem,
      seriesItems,
      nextScheduledItem: getNextScheduledVersion(seriesItems, selectedMonth),
      occurrenceStatus: getRecurringOccurrenceStatus(currentItem, selectedMonth, today),
      seriesState: getSeriesState(currentItem, seriesItems, selectedMonth),
    })
  })

  return entries
}

export function getOccurrenceStatusLabel(status: CommitmentOccurrenceStatus): string {
  switch (status) {
    case "logged":
      return "Logged"
    case "upcoming":
      return "Upcoming"
    case "due":
      return "Due"
  }
}

export function getSeriesStateLabel(state: CommitmentSeriesState): string {
  switch (state) {
    case "current":
      return "Current"
    case "has_scheduled_change":
      return "Scheduled change"
    case "changed_this_month":
      return "Changed this month"
  }
}

export function formatCommitmentRowSubtitle(rule: RecurringExpense, status: CommitmentOccurrenceStatus): string {
  if (!rule.is_active) {
    return `Paused · ${rule.tag.name}`
  }

  return `Due ${formatDateValue(rule.projected_date_for_month, { month: "short", day: "numeric" })} · ${rule.tag.name} · ${getOccurrenceStatusLabel(status)}`
}

export function formatBillingSchedulePreview(
  billingType: RecurringBillingType,
  billingDay: number | null
): string {
  if (billingType === "last_day") {
    return "charge on the last day of each month"
  }

  return `charge on day ${billingDay ?? 1}`
}

export function formatScheduledChangePreview(
  currentRule: RecurringExpense,
  values: {
    amount: string
    effectiveMonth: string
    billingType: RecurringBillingType
    billingDay: number | null
  }
): string {
  const amountChanged = values.amount !== currentRule.amount
  const billingChanged = values.billingType !== currentRule.billing_type || values.billingDay !== currentRule.billing_day

  const firstSentence = `${currentRule.expense} will stay ${currentRule.amount === values.amount ? "the same amount" : `${currentRule.amount}`} through ${currentRule.ends_month ? formatDateValue(currentRule.ends_month + "-01", { month: "long", year: "numeric" }) : "the month before the change"}.`

  if (!amountChanged && billingChanged) {
    return `${firstSentence} Starting ${formatDateValue(values.effectiveMonth + "-01", { month: "long", year: "numeric" })}, it will ${formatBillingSchedulePreview(values.billingType, values.billingDay)}.`
  }

  if (amountChanged && !billingChanged) {
    return `${firstSentence} Starting ${formatDateValue(values.effectiveMonth + "-01", { month: "long", year: "numeric" })}, it will be ${values.amount} and keep the same schedule.`
  }

  return `${firstSentence} Starting ${formatDateValue(values.effectiveMonth + "-01", { month: "long", year: "numeric" })}, it will be ${values.amount} and ${formatBillingSchedulePreview(values.billingType, values.billingDay)}.`
}
