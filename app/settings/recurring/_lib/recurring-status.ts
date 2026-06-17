"use client"

import { getCurrentMonthKey } from "@/lib/date-filters"
import type { RecurringExpense } from "@/lib/api/types"

export type RecurringDisplayStatus =
  | "generated"
  | "upcoming"
  | "due_today"
  | "overdue"
  | "paused"
  | "ended"
  | "starts_later"

export function getRecurringDisplayStatus(
  item: RecurringExpense,
  selectedMonth: string,
  today = new Date()
): RecurringDisplayStatus {
  if (item.ends_month && selectedMonth > item.ends_month) {
    return "ended"
  }

  if (selectedMonth < item.starts_month) {
    return "starts_later"
  }

  if (!item.is_active) {
    return "paused"
  }

  if (item.generated_for_month) {
    return "generated"
  }

  const currentMonth = getCurrentMonthKey(today)
  const todayIso = currentMonth === selectedMonth
    ? `${selectedMonth}-${String(today.getDate()).padStart(2, "0")}`
    : null

  if (todayIso && item.projected_date_for_month === todayIso) {
    return "due_today"
  }

  if ((todayIso && item.projected_date_for_month < todayIso) || selectedMonth < currentMonth) {
    return "overdue"
  }

  return "upcoming"
}

export function getRecurringDisplayStatusLabel(status: RecurringDisplayStatus): string {
  switch (status) {
    case "generated":
      return "Logged"
    case "upcoming":
      return "Upcoming"
    case "due_today":
      return "Due today"
    case "overdue":
      return "Overdue"
    case "paused":
      return "Paused"
    case "ended":
      return "Ended"
    case "starts_later":
      return "Starts later"
  }
}
