"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import {
  CalendarIcon,
  ChevronRight,
  Folder,
  LineChart,
  ReceiptText,
  RefreshCw,
  Tag as TagGlyph,
} from "lucide-react"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { TransactionPresenceIndicators } from "@/components/budget/transaction-presence-indicators"
import { Button } from "@/components/ui/button"
import { Calendar as AppCalendar } from "@/components/ui/calendar"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ResponsiveDialog } from "@/components/ui/responsive-dialog"
import { ApiError, apiClient } from "@/lib/api/client"
import type {
  Category,
  InsightsCategoryBreakdownItem,
  InsightsCategoryBudgetVsActualItem,
  InsightsDayOfWeekSpendItem,
  InsightsLargestTransactionItem,
  InsightsMetricsResponse,
  InsightsTagBreakdownItem,
} from "@/lib/api/types"
import { parseIsoDate, toIsoDate } from "@/lib/date-filters"
import { formatCurrency, getCategoryColorClass } from "@/lib/formatters"
import { getTagIcon } from "@/lib/tag-icons"
import { cn } from "@/lib/utils"
import { useFinancialAuthority } from "@/components/privacy/financial-authority-provider"

type InsightPreset = "this_month" | "last_month" | "last_3_months" | "last_6_months" | "year_to_date" | "all_time" | "custom"

interface InsightRange {
  date_from: string
  date_to: string
}

type NotableSpendingItem =
  | {
      type: "single"
      transaction: InsightsLargestTransactionItem
      totalAmount: number
    }
  | {
      type: "group"
      groupKey: string
      expense: string
      amountEach: number
      count: number
      totalAmount: number
      category: Category
      tag: InsightsLargestTransactionItem["tag"]
      cardName: string | null
      isSplit: boolean
      firstDate: string
      lastDate: string
      transactions: InsightsLargestTransactionItem[]
    }

const insightPresets: { value: Exclude<InsightPreset, "custom">; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "3M" },
  { value: "last_6_months", label: "6M" },
  { value: "year_to_date", label: "YTD" },
  { value: "all_time", label: "All Time" },
]

const weekdayOrder: InsightsDayOfWeekSpendItem["day"][] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

const categoryLabels: Record<Category, string> = {
  needs: "Needs",
  wants: "Wants",
  savings: "Savings",
}

const categoryBarColors: Record<Category, string> = {
  needs: "bg-needs",
  wants: "bg-wants",
  savings: "bg-savings",
}

function numberFrom(value: string | number | null | undefined): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "0")
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: string | number | null | undefined): string {
  return formatCurrency(numberFrom(value))
}

function formatPercent(value: string | number | null | undefined): string {
  const numeric = numberFrom(value)
  return `${Math.round(numeric)}%`
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(value, 100))
}

function dateFromIso(value: string): Date {
  return parseIsoDate(value) ?? new Date(`${value}T00:00:00`)
}

function formatRange(range: InsightRange): string {
  const from = dateFromIso(range.date_from)
  const to = dateFromIso(range.date_to)
  const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()

  if (sameMonth && from.getDate() === 1 && to.getDate() >= 28) {
    return format(from, "MMMM yyyy")
  }

  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")}`
  }

  return `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`
}

function getPresetRange(preset: Exclude<InsightPreset, "custom" | "all_time">): InsightRange {
  const today = new Date()
  const dateTo = toIsoDate(today)

  if (preset === "this_month") {
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    return {
      date_from: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      date_to: toIsoDate(monthEnd),
    }
  }

  if (preset === "last_month") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return {
      date_from: toIsoDate(start),
      date_to: toIsoDate(end),
    }
  }

  if (preset === "year_to_date") {
    return {
      date_from: `${today.getFullYear()}-01-01`,
      date_to: dateTo,
    }
  }

  const monthsBack = preset === "last_3_months" ? 2 : 5
  return {
    date_from: toIsoDate(new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)),
    date_to: dateTo,
  }
}

function topCategory(data: InsightsMetricsResponse | null): InsightsCategoryBreakdownItem | null {
  return [...(data?.category_breakdown ?? [])].sort((a, b) => numberFrom(b.spend) - numberFrom(a.spend))[0] ?? null
}

function topTag(data: InsightsMetricsResponse | null): InsightsTagBreakdownItem | null {
  return sortTags(data?.tag_breakdown ?? [])[0] ?? null
}

function sortTags(tags: InsightsTagBreakdownItem[]): InsightsTagBreakdownItem[] {
  return [...tags].sort((a, b) => numberFrom(b.spend) - numberFrom(a.spend))
}

function highestAverageWeekday(items: InsightsDayOfWeekSpendItem[]): InsightsDayOfWeekSpendItem | null {
  return [...items].sort((a, b) => numberFrom(b.avg_spend) - numberFrom(a.avg_spend))[0] ?? null
}

function mostFrequentWeekday(items: InsightsDayOfWeekSpendItem[]): InsightsDayOfWeekSpendItem | null {
  return [...items].sort((a, b) => b.transactions_count - a.transactions_count)[0] ?? null
}

function overBudgetBy(item: InsightsCategoryBudgetVsActualItem): number {
  return Math.max(0, numberFrom(item.actual_spend) - numberFrom(item.budget_amount))
}

function weekdayLabel(day: InsightsDayOfWeekSpendItem["day"]): string {
  return day.charAt(0).toUpperCase() + day.slice(1)
}

function weekdayShortLabel(day: InsightsDayOfWeekSpendItem["day"]): string {
  return day.slice(0, 1).toUpperCase()
}

function snapshotSentence(data: InsightsMetricsResponse): string | null {
  const category = topCategory(data)
  const tag = topTag(data)
  if (!category || !tag) {
    return null
  }

  return `Most of your spending went to ${categoryLabels[category.category]}, with ${tag.tag_name} as your top tag.`
}

function normalizeGroupKeyPart(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
}

function notableSpendingGroupKey(item: InsightsLargestTransactionItem): string {
  const tagKey = item.tag.id || item.tag.name

  return [
    normalizeGroupKeyPart(item.expense),
    numberFrom(item.amount).toFixed(2),
    item.category,
    normalizeGroupKeyPart(tagKey),
    normalizeGroupKeyPart(item.card_name),
    item.is_split ? "split" : "single",
  ].join("|")
}

function buildNotableSpendingItems(items: InsightsLargestTransactionItem[]): NotableSpendingItem[] {
  const groups = new Map<string, InsightsLargestTransactionItem[]>()

  items.forEach((item) => {
    const key = notableSpendingGroupKey(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  })

  return Array.from(groups.entries())
    .map(([groupKey, transactions]) => {
      const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
      const first = sortedTransactions[0]
      const amountEach = numberFrom(first.amount)

      if (sortedTransactions.length === 1) {
        return {
          type: "single" as const,
          transaction: first,
          totalAmount: amountEach,
        }
      }

      return {
        type: "group" as const,
        groupKey,
        expense: first.expense,
        amountEach,
        count: sortedTransactions.length,
        totalAmount: sortedTransactions.reduce((total, item) => total + numberFrom(item.amount), 0),
        category: first.category,
        tag: first.tag,
        cardName: first.card_name,
        isSplit: first.is_split,
        firstDate: sortedTransactions[0].date,
        lastDate: sortedTransactions[sortedTransactions.length - 1].date,
        transactions: sortedTransactions,
      }
    })
    .sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount))
}

function formatCompactDateRange(firstDate: string, lastDate: string): string {
  const first = dateFromIso(firstDate)
  const last = dateFromIso(lastDate)

  if (firstDate === lastDate) {
    return format(first, "MMM d, yyyy")
  }

  if (first.getFullYear() === last.getFullYear()) {
    return `${format(first, "MMM d")} - ${format(last, "MMM d, yyyy")}`
  }

  return `${format(first, "MMM d, yyyy")} - ${format(last, "MMM d, yyyy")}`
}

export default function InsightsPage() {
  const authority = useFinancialAuthority()
  const initialRange = useMemo(() => getPresetRange("this_month"), [])
  const [selectedPreset, setSelectedPreset] = useState<InsightPreset>("this_month")
  const [customFrom, setCustomFrom] = useState(initialRange.date_from)
  const [customTo, setCustomTo] = useState(initialRange.date_to)
  const [appliedRange, setAppliedRange] = useState<InsightRange>(initialRange)
  const [customRangeError, setCustomRangeError] = useState<string | null>(null)
  const [showAllTags, setShowAllTags] = useState(false)
  const [selectedNotableGroup, setSelectedNotableGroup] = useState<Extract<NotableSpendingItem, { type: "group" }> | null>(null)

  const [data, setData] = useState<InsightsMetricsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadInsights = useCallback(async (range: InsightRange) => {
    if (authority.isLoading) {
      return
    }
    setIsLoading(true)
    setError(null)

    try {
      const response = await authority.getInsightsMetrics(range.date_from, range.date_to)
      setData(response)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load insights")
      }
    } finally {
      setIsLoading(false)
    }
  }, [authority])

  useEffect(() => {
    void loadInsights(appliedRange)
  }, [appliedRange, loadInsights])

  const resolveAllTimeRange = useCallback(async (): Promise<InsightRange> => {
    const today = toIsoDate(new Date())

    if (authority.mode !== "encrypted" || !authority.authority) {
      throw new Error("ENCRYPTED_AUTHORITY_REQUIRED")
    }
    const oldestTransactionPage = { items: authority.authority.getState().transactions.slice().sort((a, b) => a.date.localeCompare(b.date)).slice(0, 1).map((item) => ({ date: item.date })) }

    return {
      date_from: oldestTransactionPage.items[0]?.date ?? today,
      date_to: today,
    }
  }, [authority])

  const applyPreset = async (preset: Exclude<InsightPreset, "custom">) => {
    try {
      const range = preset === "all_time"
        ? await resolveAllTimeRange()
        : getPresetRange(preset)

      setSelectedPreset(preset)
      setCustomFrom(range.date_from)
      setCustomTo(range.date_to)
      setCustomRangeError(null)
      setShowAllTags(false)
      setAppliedRange(range)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.error.message)
      } else {
        setError("Unable to load insights")
      }
    }
  }

  const applyCustomRange = () => {
    const from = customFrom.trim()
    const to = customTo.trim()

    if (!from || !to) {
      setCustomRangeError("Choose a start and end date.")
      return
    }

    if (from > to) {
      setCustomRangeError("Start date must be before or equal to end date.")
      return
    }

    setSelectedPreset("custom")
    setCustomRangeError(null)
    setShowAllTags(false)
    setAppliedRange({ date_from: from, date_to: to })
  }

  const noData = !data || data.total_transactions === 0
  const rangeLabel = formatRange(appliedRange)
  const selectedTopTag = topTag(data)
  const selectedTopCategory = topCategory(data)
  const largestTransaction = data?.largest_transactions[0] ?? null
  const notableSpendingItems = useMemo(
    () => buildNotableSpendingItems(data?.largest_transactions ?? []),
    [data?.largest_transactions]
  )

  return (
    <div className="min-h-[100svh] w-full max-w-[100svw] overflow-x-hidden bg-background pb-mobile-nav">
      <Header />

      <main className="mx-auto box-border w-full max-w-[100svw] space-y-3 overflow-x-hidden px-4 pt-standalone-safe-top sm:px-5 lg:max-w-6xl lg:space-y-4 lg:px-8 lg:pb-8">
        <section className="space-y-3 lg:space-y-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
            <p className="mt-1 text-sm text-muted-foreground">Review your spending.</p>
          </div>

          <InsightsRangeSelector
            selectedPreset={selectedPreset}
            customFrom={customFrom}
            customTo={customTo}
            appliedRange={appliedRange}
            rangeLabel={rangeLabel}
            isLoading={isLoading}
            customRangeError={customRangeError}
            onPresetSelect={applyPreset}
            onCustomSelect={() => setSelectedPreset("custom")}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            onApplyCustomRange={applyCustomRange}
          />

          <Card className="border-0 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Folder className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Funds</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  View savings goals.
                </p>
              </div>
              <Button size="sm" variant="outline" className="rounded-full" asChild>
                <Link href="/insights/funds">Open</Link>
              </Button>
            </div>
          </Card>
        </section>

        {isLoading && !data ? (
          <InsightSkeleton />
        ) : error && !data ? (
          <InsightErrorState message={error} onRetry={() => void loadInsights(appliedRange)} />
        ) : noData || !data ? (
          <InsightEmptyState />
        ) : (
          <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-6">
            <div className="min-w-0 space-y-3 lg:space-y-4">
              {error && (
                <Card className="border-destructive/20 bg-destructive/5 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-destructive">{error}</p>
                    <Button size="sm" variant="outline" className="h-9 rounded-full" onClick={() => void loadInsights(appliedRange)}>
                      Retry
                    </Button>
                  </div>
                </Card>
              )}

              <SnapshotCard data={data} rangeLabel={rangeLabel} />
              <BudgetCheckInSection items={data.category_budget_vs_actual} />
              <TagSpendSection
                tags={data.tag_breakdown}
                totalSpend={numberFrom(data.total_spend)}
                showAll={showAllTags}
                onToggleShowAll={() => setShowAllTags((current) => !current)}
              />
              <div className="lg:hidden">
                <FixedVsFlexibleCard data={data} />
              </div>
              <SpendingRhythmSection data={data} />
              <div className="lg:hidden">
                <SpendingHabitsCard items={data.day_of_week_spend} />
              </div>
              <NotableSpendingSection
                items={notableSpendingItems}
                onGroupOpen={setSelectedNotableGroup}
              />
            </div>

            <aside className="hidden min-w-0 space-y-4 lg:block">
              <RangeSummaryCard
                rangeLabel={rangeLabel}
                range={appliedRange}
                monthsInRange={data.months_in_range}
                topCategory={selectedTopCategory}
                topTag={selectedTopTag}
                largestTransaction={largestTransaction}
              />
              <FixedVsFlexibleCard data={data} />
              <SpendingHabitsCard items={data.day_of_week_spend} />
            </aside>
          </div>
        )}
      </main>

      <NotableSpendingGroupSheet
        group={selectedNotableGroup}
        open={selectedNotableGroup !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedNotableGroup(null)
          }
        }}
      />

      <BottomNav />
    </div>
  )
}

function InsightsRangeSelector({
  selectedPreset,
  customFrom,
  customTo,
  appliedRange,
  rangeLabel,
  isLoading,
  customRangeError,
  onPresetSelect,
  onCustomSelect,
  onCustomFromChange,
  onCustomToChange,
  onApplyCustomRange,
}: {
  selectedPreset: InsightPreset
  customFrom: string
  customTo: string
  appliedRange: InsightRange
  rangeLabel: string
  isLoading: boolean
  customRangeError: string | null
  onPresetSelect: (preset: Exclude<InsightPreset, "custom">) => Promise<void>
  onCustomSelect: () => void
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onApplyCustomRange: () => void
}) {
  return (
    <Card className="min-w-0 max-w-full gap-2 overflow-hidden border-0 p-2.5 shadow-sm lg:p-3">
      <div className="relative min-w-0 overflow-hidden">
        <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto scroll-smooth pb-0.5 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {insightPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => void onPresetSelect(preset.value)}
              aria-pressed={selectedPreset === preset.value}
              className={cn(
                "h-9 shrink-0 cursor-pointer rounded-full border px-3 text-sm font-medium transition-colors lg:h-10",
                selectedPreset === preset.value
                  ? "border-secondary bg-secondary text-foreground"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onCustomSelect}
            aria-pressed={selectedPreset === "custom"}
            className={cn(
              "h-9 shrink-0 cursor-pointer rounded-full border px-3 text-sm font-medium transition-colors lg:h-10",
              selectedPreset === "custom"
                ? "border-secondary bg-secondary text-foreground"
                : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Custom
          </button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card via-card/80 to-transparent" aria-hidden="true" />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium">{rangeLabel}</p>
          <p className="sr-only">Selected range: {formatRange(appliedRange)}</p>
        </div>
        {isLoading && (
          <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-label="Loading insights" />
        )}
      </div>

      {selectedPreset === "custom" && (
        <div className="mt-2 min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-muted/20 p-3">
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="insights-custom-from" className="text-xs text-muted-foreground">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="insights-custom-from"
                    type="button"
                    variant="outline"
                    className="h-10 w-full min-w-0 justify-start rounded-xl bg-background text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{customFrom ? format(dateFromIso(customFrom), "MMM d, yyyy") : "From"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(calc(100svw-2rem),22rem)] overflow-hidden rounded-2xl p-0 sm:w-auto" align="start" avoidCollisions>
                  <AppCalendar
                    mode="single"
                    selected={parseIsoDate(customFrom) ?? undefined}
                    onSelect={(date) => {
                      if (!date) {
                        return
                      }
                      onCustomFromChange(toIsoDate(date))
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor="insights-custom-to" className="text-xs text-muted-foreground">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="insights-custom-to"
                    type="button"
                    variant="outline"
                    className="h-10 w-full min-w-0 justify-start rounded-xl bg-background text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{customTo ? format(dateFromIso(customTo), "MMM d, yyyy") : "To"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(calc(100svw-2rem),22rem)] overflow-hidden rounded-2xl p-0 sm:w-auto" align="start" avoidCollisions>
                  <AppCalendar
                    mode="single"
                    selected={parseIsoDate(customTo) ?? undefined}
                    onSelect={(date) => {
                      if (!date) {
                        return
                      }
                      onCustomToChange(toIsoDate(date))
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button type="button" className="h-10 rounded-xl" onClick={onApplyCustomRange}>
              Apply
            </Button>
          </div>
          {customRangeError && <p className="mt-2 text-xs text-destructive">{customRangeError}</p>}
        </div>
      )}
    </Card>
  )
}

function SnapshotCard({ data, rangeLabel }: { data: InsightsMetricsResponse; rangeLabel: string }) {
  const sentence = snapshotSentence(data)

  return (
    <Card className="min-w-0 max-w-full gap-0 overflow-hidden border-0 p-4 shadow-sm sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{rangeLabel} Snapshot</p>
      <div className="mt-3 sm:mt-4">
        <p className="text-sm text-muted-foreground">You spent</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatMoney(data.total_spend)}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Across {data.total_transactions} transaction{data.total_transactions === 1 ? "" : "s"}.
        </p>
      </div>
      {sentence && <p className="mt-3 border-l-2 border-border/80 pl-3 text-sm leading-relaxed text-muted-foreground sm:mt-4">{sentence}</p>}
    </Card>
  )
}

function BudgetCheckInSection({ items }: { items: InsightsCategoryBudgetVsActualItem[] }) {
  if (items.length === 0) {
    return (
      <ReviewSection title="Budget check-in" description="How spending compared with your plan.">
        <p className="text-sm text-muted-foreground">Set a budget to compare spending against your plan.</p>
      </ReviewSection>
    )
  }

  return (
    <ReviewSection title="Budget check-in" description="How spending compared with your plan.">
      <div className="space-y-4">
        {items.map((item) => (
          <BudgetCheckInRow key={item.category} item={item} />
        ))}
      </div>
    </ReviewSection>
  )
}

function BudgetCheckInRow({ item }: { item: InsightsCategoryBudgetVsActualItem }) {
  const percent = numberFrom(item.percent_used)
  const overBy = overBudgetBy(item)
  const isOver = overBy > 0

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{categoryLabels[item.category]}</p>
          <p className="text-xs text-muted-foreground">
            {formatMoney(item.actual_spend)} of {formatMoney(item.budget_amount)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold">{formatPercent(item.percent_used)}</p>
          {isOver && <p className="text-xs text-destructive">Over by {formatMoney(overBy)}</p>}
        </div>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={`${categoryLabels[item.category]} used ${formatPercent(item.percent_used)} of budget`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampPercent(percent))}
      >
        <div
          className={cn("h-full rounded-full", categoryBarColors[item.category], isOver && "bg-destructive/70")}
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </div>
    </div>
  )
}

function TagSpendSection({
  tags,
  totalSpend,
  showAll,
  onToggleShowAll,
}: {
  tags: InsightsTagBreakdownItem[]
  totalSpend: number
  showAll: boolean
  onToggleShowAll: () => void
}) {
  const sorted = sortTags(tags)
  const visible = showAll ? sorted : sorted.slice(0, 5)

  return (
    <ReviewSection title="Where the money went" description="Top spending tags in this range.">
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tag spending found for this range.</p>
      ) : (
        <div className="space-y-1">
          {visible.map((tag) => (
            <TagSpendRow key={tag.tag_id} tag={tag} totalSpend={totalSpend} />
          ))}
          {sorted.length > 5 && (
            <button
              type="button"
              onClick={onToggleShowAll}
              className="mt-2 h-10 cursor-pointer rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
            >
              {showAll ? "Show less" : `Show all ${sorted.length}`}
            </button>
          )}
        </div>
      )}
    </ReviewSection>
  )
}

function TagSpendRow({ tag, totalSpend }: { tag: InsightsTagBreakdownItem; totalSpend: number }) {
  const TagIcon = getTagIcon(tag.tag_name, tag.icon_key)
  const percent = totalSpend > 0 ? numberFrom(tag.percent_of_total_spend) : 0

  return (
    <div className="min-w-0 rounded-xl px-1 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
          <TagIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold">{tag.tag_name}</p>
            <p className="shrink-0 text-sm font-semibold">{formatMoney(tag.spend)}</p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${clampPercent(percent)}%` }} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">{formatPercent(percent)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SpendingRhythmSection({ data }: { data: InsightsMetricsResponse }) {
  const points = data.monthly_spend_trend ?? []
  const maxSpend = Math.max(...points.map((point) => numberFrom(point.total_spend)), 0)

  if (data.months_in_range <= 1 || points.length <= 1) {
    return (
      <ReviewSection title="Spending rhythm" description="Monthly spend across selected range.">
        <p className="text-sm text-muted-foreground">Spending rhythm appears when reviewing multiple months.</p>
      </ReviewSection>
    )
  }

  return (
    <ReviewSection title="Spending rhythm" description="Monthly spend across selected range.">
      <div className="space-y-3">
        {points.map((point) => {
          const spend = numberFrom(point.total_spend)
          const width = maxSpend > 0 ? (spend / maxSpend) * 100 : 0

          return (
            <div key={point.month} className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3">
              <p className="text-xs font-medium text-muted-foreground">{formatMonthLabel(point.month)}</p>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${clampPercent(width)}%` }} />
              </div>
              <p className="shrink-0 text-sm font-medium">{formatMoney(spend)}</p>
            </div>
          )
        })}
      </div>
    </ReviewSection>
  )
}

function FixedVsFlexibleCard({ data }: { data: InsightsMetricsResponse }) {
  const recurring = numberFrom(data.recurring_vs_variable?.recurring)
  const variable = numberFrom(data.recurring_vs_variable?.variable)
  const total = recurring + variable
  const recurringPercent = total > 0 ? numberFrom(data.recurring_vs_variable?.recurring_percent) : 0
  const variablePercent = total > 0 ? numberFrom(data.recurring_vs_variable?.variable_percent) : 0

  return (
    <ReviewSection title="Fixed vs flexible" description="Committed bills compared with variable spending.">
      {total <= 0 ? (
        <p className="text-sm text-muted-foreground">No fixed or variable spending found for this range.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="bg-primary/70" style={{ width: `${clampPercent(recurringPercent)}%` }} />
            <div className="bg-muted-foreground/35" style={{ width: `${clampPercent(variablePercent)}%` }} />
          </div>
          <div className="grid gap-3">
            <FixedFlexibleRow label="Recurring bills" amount={recurring} percent={recurringPercent} markerClassName="bg-primary/70" />
            <FixedFlexibleRow label="Variable spending" amount={variable} percent={variablePercent} markerClassName="bg-muted-foreground/35" />
          </div>
        </div>
      )}
    </ReviewSection>
  )
}

function FixedFlexibleRow({
  label,
  amount,
  percent,
  markerClassName,
}: {
  label: string
  amount: number
  percent: number
  markerClassName: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", markerClassName)} />
        <p className="truncate text-sm font-medium">{label}</p>
      </div>
      <p className="shrink-0 text-sm text-muted-foreground">
        {formatMoney(amount)} · {formatPercent(percent)}
      </p>
    </div>
  )
}

function SpendingHabitsCard({ items }: { items: InsightsDayOfWeekSpendItem[] }) {
  const highestAverage = highestAverageWeekday(items)
  const mostFrequent = mostFrequentWeekday(items)
  const maxTotal = Math.max(...items.map((item) => numberFrom(item.total_spend)), 0)

  return (
    <ReviewSection title="Spending habits" description="Lightweight weekly patterns.">
      {!highestAverage || !mostFrequent ? (
        <p className="text-sm text-muted-foreground">More spending history will reveal weekly patterns.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            <HabitObservation label="Highest average day" value={`${weekdayLabel(highestAverage.day)} · ${formatMoney(highestAverage.avg_spend)} avg`} />
            <HabitObservation
              label="Most frequent day"
              value={`${weekdayLabel(mostFrequent.day)} · ${mostFrequent.transactions_count} transaction${mostFrequent.transactions_count === 1 ? "" : "s"}`}
            />
          </div>
          <div className="grid grid-cols-7 items-end gap-1.5" aria-label="Weekly spending distribution">
            {weekdayOrder.map((day) => {
              const item = items.find((entry) => entry.day === day)
              const total = numberFrom(item?.total_spend)
              const height = maxTotal > 0 ? Math.max(12, (total / maxTotal) * 52) : 12

              return (
                <div key={day} className="flex flex-col items-center gap-1">
                  <div className="flex h-14 items-end">
                    <div className="w-5 rounded-full bg-primary/45 dark:bg-primary/55" style={{ height }} />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground">{weekdayShortLabel(day)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </ReviewSection>
  )
}

function HabitObservation({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function NotableSpendingSection({
  items,
  onGroupOpen,
}: {
  items: NotableSpendingItem[]
  onGroupOpen: (group: Extract<NotableSpendingItem, { type: "group" }>) => void
}) {
  return (
    <Card className="min-w-0 max-w-full gap-0 overflow-hidden border-0 p-0 shadow-sm">
      <div className="flex min-w-0 items-center justify-between border-b border-border/50 px-5 py-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Notable spending</h2>
          <p className="mt-1 text-sm text-muted-foreground">Largest individual and repeated expenses in this range.</p>
        </div>
        <Link href="/transactions" className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          See All
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No notable spending found for this range.</p>
      ) : (
        <div className="divide-y divide-border/50">
          {items.slice(0, 5).map((item) => (
            item.type === "group" ? (
              <GroupedNotableSpendingRow key={item.groupKey} item={item} onOpen={() => onGroupOpen(item)} />
            ) : (
              <SingleNotableSpendingRow key={item.transaction.transaction_id} item={item.transaction} />
            )
          ))}
        </div>
      )}
    </Card>
  )
}

function SingleNotableSpendingRow({ item }: { item: InsightsLargestTransactionItem }) {
  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

  return (
    <div className="flex min-w-0 items-center gap-3 p-3">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", getCategoryColorClass(item.category))}>
        <TagIcon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.expense}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{item.tag.name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{format(dateFromIso(item.date), "MMM d, yyyy")}</span>
          <TransactionPresenceIndicators hasNotes={Boolean(item.notes)} />
        </div>
      </div>
      <p className="shrink-0 text-right text-sm font-semibold">-{formatMoney(item.amount)}</p>
    </div>
  )
}

function GroupedNotableSpendingRow({
  item,
  onOpen,
}: {
  item: Extract<NotableSpendingItem, { type: "group" }>
  onOpen: () => void
}) {
  const TagIcon = getTagIcon(item.tag.name, item.tag.icon_key)

  return (
    <button
      type="button"
      onClick={onOpen}
    className="flex w-full min-w-0 cursor-pointer items-center gap-3 p-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`Open details for ${item.expense}, ${item.count} payments totaling ${formatMoney(item.totalAmount)}`}
    >
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", getCategoryColorClass(item.category))}>
        <TagIcon className="h-4 w-4 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.expense}</p>
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{item.tag.name}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{item.count} payments</span>
          <TransactionPresenceIndicators hasNotes={item.transactions.some((transaction) => Boolean(transaction.notes))} />
        </div>
      </div>
      <p className="shrink-0 text-right text-sm font-semibold">
        -{formatMoney(item.totalAmount)}
        <span className="block text-[10px] font-medium text-muted-foreground">total</span>
      </p>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
    </button>
  )
}

function NotableSpendingGroupSheet({
  group,
  open,
  onOpenChange,
}: {
  group: Extract<NotableSpendingItem, { type: "group" }> | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!group) {
    return null
  }

  const transactionsDescending = [...group.transactions].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={group.expense}
      description={`-${formatMoney(group.totalAmount)} total`}
      mobileSize="compact"
      desktopClassName="sm:w-[min(calc(100dvw-2rem),42rem)] sm:max-w-[42rem]"
      bodyClassName="pb-6"
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-secondary/50 p-4">
          <p className="text-sm font-medium">
            {group.count} payments · {formatMoney(group.amountEach)} each
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCompactDateRange(group.firstDate, group.lastDate)}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-0.5 text-[10px] font-medium">
              <TagGlyph className="h-3 w-3 text-muted-foreground" />
              <span className="truncate">{group.tag.name}</span>
            </span>
            <TransactionPresenceIndicators
              hasCard={Boolean(group.cardName)}
              hasNotes={group.transactions.some((transaction) => Boolean(transaction.notes))}
              className="rounded-full border border-border/70 bg-background px-2 py-1"
              iconClassName="h-3 w-3"
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Transactions</h3>
          <div className="mt-2 overflow-hidden rounded-2xl border border-border/60 bg-card divide-y divide-border/50">
            {transactionsDescending.map((transaction) => {
              const TransactionTagIcon = getTagIcon(group.tag.name, group.tag.icon_key)
              return (
                <div key={transaction.transaction_id}>
                  <div className="bg-secondary/40 px-3 py-2">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {format(dateFromIso(transaction.date), "MMM d, yyyy")}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-3 p-3">
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", getCategoryColorClass(transaction.category))}>
                      <TransactionTagIcon className="h-4 w-4 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{transaction.expense}</p>
                      <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <span className="min-w-0 truncate">{group.tag.name}</span>
                        <TransactionPresenceIndicators
                          hasCard={Boolean(transaction.card_name)}
                          hasNotes={Boolean(transaction.notes)}
                        />
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-sm font-semibold">-{formatMoney(transaction.amount)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Button asChild className="h-11 w-full rounded-xl">
          <Link href="/transactions">View transactions</Link>
        </Button>
      </div>
    </ResponsiveDialog>
  )
}

function RangeSummaryCard({
  rangeLabel,
  range,
  monthsInRange,
  topCategory,
  topTag,
  largestTransaction,
}: {
  rangeLabel: string
  range: InsightRange
  monthsInRange: number
  topCategory: InsightsCategoryBreakdownItem | null
  topTag: InsightsTagBreakdownItem | null
  largestTransaction: InsightsLargestTransactionItem | null
}) {
  return (
    <ReviewSection title="Review range" description={rangeLabel}>
      <div className="space-y-4">
        <SummaryLine icon={<CalendarIcon className="h-4 w-4" />} label="Dates" value={formatRange(range)} />
        <SummaryLine icon={<LineChart className="h-4 w-4" />} label="Months" value={`${monthsInRange}`} />
        {topCategory && <SummaryLine icon={<Folder className="h-4 w-4" />} label="Top category" value={categoryLabels[topCategory.category]} />}
        {topTag && <SummaryLine icon={<TagGlyph className="h-4 w-4" />} label="Top tag" value={topTag.tag_name} />}
        {largestTransaction && <SummaryLine icon={<ReceiptText className="h-4 w-4" />} label="Largest transaction" value={largestTransaction.expense} />}
      </div>
    </ReviewSection>
  )
}

function SummaryLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function ReviewSection({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="min-w-0 max-w-full gap-0 overflow-hidden border-0 p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  )
}

function InsightSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
      <div className="space-y-4">
        <SkeletonCard tall />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="hidden space-y-4 lg:block">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <Card className="gap-0 border-0 p-5 shadow-sm">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-32 rounded-full bg-muted" />
        <div className={cn("rounded-2xl bg-muted", tall ? "h-24" : "h-16")} />
        <div className="h-3 w-2/3 rounded-full bg-muted" />
      </div>
    </Card>
  )
}

function InsightEmptyState() {
  return (
    <Card className="gap-0 border-0 p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold">No spending found for this range.</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Try a different date range or add a transaction.</p>
      <Button asChild className="mt-5 rounded-full">
        <Link href="/transactions?add=1">Add transaction</Link>
      </Button>
    </Card>
  )
}

function InsightErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="gap-0 border-destructive/20 bg-destructive/5 p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Insights could not load.</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </Card>
  )
}

function formatMonthLabel(value: string): string {
  const [yearRaw, monthRaw] = value.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw) - 1
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return value
  }

  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "short" })
}
