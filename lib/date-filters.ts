import type { Preset } from "@/lib/api/types"

export interface DateRangeFilter {
  date_from: string
  date_to: string
}

const DEFAULT_LOCALE = "en-US"
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime())
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getLocalDateKey(date = new Date()): string {
  return toIsoDate(date)
}

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getPreviousMonthKey(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(year, monthNumber - 2)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function getNextMonthKey(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(year, monthNumber)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function compareMonthKeys(left: string, right: string): number {
  const leftDate = parseMonthKey(left)
  const rightDate = parseMonthKey(right)

  if (!leftDate || !rightDate) {
    return left.localeCompare(right)
  }

  return leftDate.getTime() - rightDate.getTime()
}

export function isFutureMonth(month: string, now = new Date()): boolean {
  return compareMonthKeys(month, getCurrentMonthKey(now)) > 0
}

export const transactionFilterPresets: { value: Preset | "all"; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "month_to_date", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "quarter_to_date", label: "This Quarter" },
]

export const transactionExportPresets: { value: Preset; label: string }[] = transactionFilterPresets.filter(
  (preset): preset is { value: Preset; label: string } => preset.value !== "all"
)

export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const day = Number(dayRaw)
  const parsed = new Date(year, monthIndex, day)

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

export function parseDateValue(value: string): Date | null {
  const localDate = parseIsoDate(value)
  if (localDate) {
    return localDate
  }

  const parsed = new Date(value)
  return isValidDate(parsed) ? parsed : null
}

export function parseMonthKey(value: string): Date | null {
  if (!MONTH_KEY_PATTERN.test(value)) {
    return null
  }

  const [yearRaw, monthRaw] = value.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  const parsed = new Date(year, monthIndex, 1)

  if (
    !isValidDate(parsed) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex
  ) {
    return null
  }

  return parsed
}

export function getMonthDateRange(month: string): DateRangeFilter | null {
  if (!MONTH_KEY_PATTERN.test(month)) {
    return null
  }

  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const normalizedMonth = String(monthIndex + 1).padStart(2, "0")

  return {
    date_from: `${year}-${normalizedMonth}-01`,
    date_to: `${year}-${normalizedMonth}-${String(daysInMonth).padStart(2, "0")}`,
  }
}

export function formatMonthLabel(month: string): string | null {
  const parsed = parseMonthKey(month)
  if (!parsed) {
    return null
  }

  return parsed.toLocaleDateString(DEFAULT_LOCALE, {
    month: "long",
    year: "numeric",
  })
}

export function formatMonthValue(month: string, options: Intl.DateTimeFormatOptions): string | null {
  const parsed = parseMonthKey(month)
  return parsed ? parsed.toLocaleDateString(DEFAULT_LOCALE, options) : null
}

export function formatDateValue(
  value: string,
  options: Intl.DateTimeFormatOptions,
  fallback = value
): string {
  const parsed = parseDateValue(value)
  return parsed ? parsed.toLocaleDateString(DEFAULT_LOCALE, options) : fallback
}

export function formatDateTimeValue(
  value: string,
  options: Intl.DateTimeFormatOptions,
  fallback = value
): string {
  const parsed = parseDateValue(value)
  return parsed ? parsed.toLocaleString(DEFAULT_LOCALE, options) : fallback
}

export function getPresetDateRange(preset: Preset | "all"): Partial<DateRangeFilter> {
  if (preset === "all") {
    return {}
  }

  const now = new Date()
  let dateFrom: Date | null = null
  let dateTo: Date | null = null

  switch (preset) {
    case "last_7_days":
      dateFrom = new Date(now)
      dateFrom.setDate(now.getDate() - 7)
      break
    case "last_30_days":
      dateFrom = new Date(now)
      dateFrom.setDate(now.getDate() - 30)
      break
    case "month_to_date":
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case "last_month":
      dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      dateTo = new Date(now.getFullYear(), now.getMonth(), 0)
      break
    case "quarter_to_date": {
      const quarter = Math.floor(now.getMonth() / 3)
      dateFrom = new Date(now.getFullYear(), quarter * 3, 1)
      break
    }
  }

  return {
    date_from: dateFrom ? toIsoDate(dateFrom) : undefined,
    date_to: dateTo ? toIsoDate(dateTo) : undefined,
  }
}
