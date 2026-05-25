import type { Preset } from "@/lib/api/types"

export interface DateRangeFilter {
  date_from: string
  date_to: string
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
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

export function getMonthDateRange(month: string): DateRangeFilter | null {
  if (!/^\d{4}-\d{2}$/.test(month)) {
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
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null
  }

  const [yearRaw, monthRaw] = month.split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1

  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null
  }

  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
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
