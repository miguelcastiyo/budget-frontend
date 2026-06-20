"use client"

import { format } from "date-fns"
import { formatDateValue, formatMonthValue } from "@/lib/date-filters"
import { asNumber, toDecimalString } from "@/lib/income-breakdown"
import type { Category, RecurringBillingType, RecurringExpense } from "@/lib/api/types"

export interface RecurringFormState {
  expense: string
  amount: string
  category: Category
  tag_id: string
  card_id: string
  billing_type: RecurringBillingType
  billing_day: string
  starts_month: string
  ends_month: string
  is_active: boolean
}

export type RecurringSort = "amount_asc" | "amount_desc"

export const categoryConfig = {
  needs: { label: "Needs", selectedClassName: "bg-needs/15" },
  wants: { label: "Wants", selectedClassName: "bg-wants/15" },
  savings: { label: "Savings", selectedClassName: "bg-savings/15" },
} as const

export function formatRecurringAmount(value: string): string {
  if (asNumber(value) <= 0) {
    return "0.00"
  }

  return toDecimalString(value)
}

export function emptyForm(month: string, tagId = ""): RecurringFormState {
  return {
    expense: "",
    amount: "",
    category: "needs",
    tag_id: tagId,
    card_id: "",
    billing_type: "day_of_month",
    billing_day: "1",
    starts_month: month,
    ends_month: "",
    is_active: true,
  }
}

export function formFromItem(item: RecurringExpense): RecurringFormState {
  return {
    expense: item.expense,
    amount: item.amount,
    category: item.category,
    tag_id: item.tag.id,
    card_id: item.card?.id ?? "",
    billing_type: item.billing_type,
    billing_day: item.billing_day === null ? "1" : String(item.billing_day),
    starts_month: item.starts_month,
    ends_month: item.ends_month ?? "",
    is_active: item.is_active,
  }
}

export function normalizeRecurringForm(form: RecurringFormState) {
  return {
    expense: form.expense.trim(),
    amount: formatRecurringAmount(form.amount),
    category: form.category,
    tag_id: form.tag_id,
    card_id: form.card_id || null,
    billing_type: form.billing_type,
    billing_day: form.billing_type === "day_of_month"
      ? Math.min(Math.max(Number.parseInt(form.billing_day || "1", 10) || 1, 1), 31)
      : null,
    starts_month: form.starts_month,
    ends_month: form.ends_month || null,
    is_active: form.is_active,
  }
}

export function isValidRecurringAmount(value: string): boolean {
  return asNumber(value) > 0
}

export function isValidBillingDay(form: RecurringFormState): boolean {
  if (form.billing_type === "last_day") {
    return true
  }

  const day = Number.parseInt(form.billing_day || "", 10)
  return Number.isInteger(day) && day >= 1 && day <= 31
}

export function formatProjectedDate(date: string): string {
  return formatDateValue(date, { month: "short", day: "numeric" })
}

export function formatProjectedDateLong(date: string): string {
  return formatDateValue(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatRecurringGroupDate(date: string): string {
  return formatDateValue(date, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export function formatAddedMonth(month: string): string {
  return formatMonthValue(month, { month: "long", year: "numeric" }) ?? month
}

export function formatBillingSchedule(item: RecurringExpense): string {
  if (item.billing_type === "last_day") {
    return "Last day monthly"
  }

  return `Day ${item.billing_day} monthly`
}

export function groupRecurringByProjectedDate(items: RecurringExpense[]): Map<string, RecurringExpense[]> {
  const groups = new Map<string, RecurringExpense[]>()

  items.forEach((item) => {
    const dateKey = item.projected_date_for_month
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(item)
  })

  return groups
}

export function sortRecurringItems(items: RecurringExpense[], sort: RecurringSort): RecurringExpense[] {
  return [...items].sort((first, second) => {
    const amountCompare = Number(first.amount) - Number(second.amount)
    if (amountCompare !== 0) {
      return sort === "amount_desc" ? -amountCompare : amountCompare
    }

    return first.expense.localeCompare(second.expense)
  })
}

export function monthValueFromParts(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

export const monthPickerMonths = Array.from({ length: 12 }, (_, index) => ({
  index,
  label: format(new Date(2026, index, 1), "MMM"),
}))
