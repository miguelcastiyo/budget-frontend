import type {
  Category,
  InsightsDayOfWeekSpendItem,
} from "@/lib/api/types"
import { formatCurrency } from "@/lib/formatters"
import { toIsoDate } from "@/lib/date-filters"

export type RangePreset =
  | "year_to_date"
  | "last_1_month"
  | "last_3_months"
  | "last_6_months"
  | "last_12_months"
  | "custom"

export const rangePresets: { value: Exclude<RangePreset, "custom">; label: string }[] = [
  { value: "year_to_date", label: "YTD" },
  { value: "last_1_month", label: "1M" },
  { value: "last_3_months", label: "3M" },
  { value: "last_6_months", label: "6M" },
  { value: "last_12_months", label: "12M" },
]

export const categoryColors: Record<Category, string> = {
  needs: "var(--color-needs)",
  wants: "var(--color-wants)",
  savings_debts: "var(--color-savings)",
}

const tagPalette = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "color-mix(in srgb, var(--color-chart-1) 72%, var(--color-foreground))",
  "color-mix(in srgb, var(--color-chart-2) 72%, var(--color-foreground))",
  "color-mix(in srgb, var(--color-chart-3) 72%, var(--color-foreground))",
  "color-mix(in srgb, var(--color-chart-4) 72%, var(--color-foreground))",
  "color-mix(in srgb, var(--color-chart-5) 72%, var(--color-foreground))",
]

export const tooltipContentStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-background)",
  boxShadow: "0 8px 20px color-mix(in srgb, var(--color-foreground) 10%, transparent)",
  padding: "8px 10px",
}

export const tooltipLabelStyle = {
  color: "var(--color-foreground)",
  fontWeight: 600,
  fontSize: 12,
}

export const tooltipItemStyle = {
  color: "var(--color-foreground)",
  fontSize: 12,
}

export const chartAnimation = {
  isAnimationActive: true,
  animationDuration: 650,
  animationEasing: "ease-out" as const,
}

export function getPresetRange(preset: Exclude<RangePreset, "custom">): { date_from: string; date_to: string } {
  const today = new Date()
  const dateTo = toIsoDate(today)

  if (preset === "year_to_date") {
    return {
      date_from: `${today.getFullYear()}-01-01`,
      date_to: dateTo,
    }
  }

  const monthsBack =
    preset === "last_1_month"
      ? 0
      : preset === "last_3_months"
        ? 2
        : preset === "last_6_months"
          ? 5
          : 11
  const dateFrom = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)

  return {
    date_from: toIsoDate(dateFrom),
    date_to: dateTo,
  }
}

export function formatShortCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0"
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`
  }

  return formatCurrency(value)
}

export function formatTooltipCurrency(value: unknown): string {
  const normalized = Array.isArray(value) ? value[0] : value
  const numeric = typeof normalized === "number" ? normalized : parseFloat(String(normalized ?? 0))
  return formatCurrency(Number.isFinite(numeric) ? numeric : 0)
}

export function formatMonthAxisLabel(value: string, includeYear: boolean): string {
  const [yearRaw, monthRaw] = String(value).split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return String(value)
  }

  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", includeYear ? { month: "short", year: "2-digit" } : { month: "short" })
}

export function formatMonthTooltipLabel(value: string): string {
  const [yearRaw, monthRaw] = String(value).split("-")
  const year = Number(yearRaw)
  const monthIndex = Number(monthRaw) - 1
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return String(value)
  }

  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function tagColor(index: number): string {
  if (index < tagPalette.length) {
    return tagPalette[index]
  }

  const chartIndex = (index % 5) + 1
  const mix = 58 + (index % 4) * 8
  return `color-mix(in srgb, var(--color-chart-${chartIndex}) ${mix}%, var(--color-foreground))`
}

export function dayLabel(day: InsightsDayOfWeekSpendItem["day"]): string {
  return day.slice(0, 3).toUpperCase()
}
