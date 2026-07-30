import type { RecurringBillingType } from "@/lib/api/types"

export interface RecurringScheduleState {
  billingType: RecurringBillingType
  billingDay: string
}

export function shouldInitializeRecurringOnEnable(checked: boolean, currentlyEnabled: boolean, manuallyTouched: boolean): boolean {
  return checked && !currentlyEnabled && !manuallyTouched
}

export function initialRecurringSchedule(date: Date): RecurringScheduleState {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return date.getDate() === lastDay
    ? { billingType: "last_day", billingDay: String(date.getDate()) }
    : { billingType: "day_of_month", billingDay: String(date.getDate()) }
}

export function recurringSchedulePayload(type: RecurringBillingType, day: string): {
  billing_type: RecurringBillingType
  billing_day: number | null
} {
  if (type === "last_day") {
    return { billing_type: "last_day", billing_day: null }
  }

  const parsed = Number.parseInt(day || "1", 10)
  return {
    billing_type: "day_of_month",
    billing_day: Math.min(Math.max(Number.isInteger(parsed) ? parsed : 1, 1), 31),
  }
}
