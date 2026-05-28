"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { InsightsRangeHeader } from "@/components/budget/insights/range-header"
import {
  InsightsDesktopSections,
  InsightsHighlights,
  InsightsMobileSections,
  InsightsPrimaryMetrics,
} from "@/components/budget/insights/sections"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { ApiError, apiClient } from "@/lib/api/client"
import type { InsightsMetricsResponse } from "@/lib/api/types"
import { formatCategory } from "@/lib/formatters"
import { RangePreset, dayLabel, getPresetRange, rangePresets } from "@/lib/insights"

export default function InsightsPage() {
  const [selectedPreset, setSelectedPreset] = useState<RangePreset>("last_1_month")
  const initialRange = useMemo(() => getPresetRange("last_1_month"), [])
  const [customFrom, setCustomFrom] = useState(initialRange.date_from)
  const [customTo, setCustomTo] = useState(initialRange.date_to)
  const [appliedRange, setAppliedRange] = useState(initialRange)

  const [data, setData] = useState<InsightsMetricsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customRangeError, setCustomRangeError] = useState<string | null>(null)

  const loadInsights = useCallback(async (range: { date_from: string; date_to: string }) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await apiClient.getInsightsMetrics(range.date_from, range.date_to)
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
  }, [])

  useEffect(() => {
    void loadInsights(appliedRange)
  }, [appliedRange, loadInsights])

  const applyPreset = (preset: Exclude<RangePreset, "custom">) => {
    const range = getPresetRange(preset)
    setSelectedPreset(preset)
    setCustomFrom(range.date_from)
    setCustomTo(range.date_to)
    setCustomRangeError(null)
    setAppliedRange(range)
  }

  const applyCustomRange = () => {
    const from = customFrom.trim()
    const to = customTo.trim()

    if (!from || !to) {
      setCustomRangeError("Select both start and end dates.")
      return
    }

    if (from > to) {
      setCustomRangeError("Start date must be before or equal to end date.")
      return
    }

    setSelectedPreset("custom")
    setCustomRangeError(null)
    setAppliedRange({ date_from: from, date_to: to })
  }

  const trendData = useMemo(
    () =>
      (data?.monthly_spend_trend ?? []).map((item) => ({
        ...item,
        total: parseFloat(item.total_spend),
        label: item.month,
      })),
    [data?.monthly_spend_trend]
  )

  const categoryDonutData = useMemo(
    () =>
      (data?.category_breakdown ?? []).map((item) => ({
        ...item,
        spendValue: parseFloat(item.spend),
      })),
    [data?.category_breakdown]
  )

  const budgetVsActualData = useMemo(
    () =>
      (data?.category_budget_vs_actual ?? []).map((item) => ({
        category: formatCategory(item.category),
        budget: parseFloat(item.budget_amount),
        actual: parseFloat(item.actual_spend),
      })),
    [data?.category_budget_vs_actual]
  )

  const tagPieData = useMemo(
    () =>
      (data?.tag_breakdown ?? []).map((item) => ({
        ...item,
        spendValue: parseFloat(item.spend),
      })),
    [data?.tag_breakdown]
  )

  const dayOfWeekData = useMemo(
    () =>
      (data?.day_of_week_spend ?? []).map((item) => ({
        ...item,
        dayLabel: dayLabel(item.day),
        avg: parseFloat(item.avg_spend),
      })),
    [data?.day_of_week_spend]
  )

  const recurringSpend = useMemo(() => parseFloat(data?.recurring_vs_variable.recurring ?? "0"), [data])
  const variableSpend = useMemo(() => parseFloat(data?.recurring_vs_variable.variable ?? "0"), [data])

  const recurringVariableData = useMemo(
    () => [{ name: "Spend", recurring: recurringSpend, variable: variableSpend }],
    [recurringSpend, variableSpend]
  )

  const topTag = data?.tag_breakdown[0] ?? null
  const topDay = useMemo(() => {
    if (!data?.day_of_week_spend?.length) {
      return null
    }

    return [...data.day_of_week_spend].sort((a, b) => parseFloat(b.total_spend) - parseFloat(a.total_spend))[0] ?? null
  }, [data?.day_of_week_spend])

  const overBudgetCount = useMemo(
    () =>
      (data?.category_budget_vs_actual ?? []).filter((item) => parseFloat(item.actual_spend) > parseFloat(item.budget_amount)).length,
    [data?.category_budget_vs_actual]
  )

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background pb-mobile-nav">
        <Header />
        <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-6">
          <Card className="p-8 border-0 shadow-sm flex items-center justify-center gap-3">
            <Spinner className="size-5" />
            <span className="text-sm text-muted-foreground">Loading insights...</span>
          </Card>
        </main>
        <BottomNav />
      </div>
    )
  }

  const noData = !data || data.total_transactions === 0

  return (
    <div className="min-h-screen bg-background pb-mobile-nav">
      <Header />

      <main className="max-w-lg lg:max-w-6xl mx-auto px-5 lg:px-8 pt-4 lg:pt-6 space-y-4 lg:space-y-6">
        <InsightsRangeHeader
          rangePresets={rangePresets}
          selectedPreset={selectedPreset}
          onPresetSelect={applyPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
          onApplyCustomRange={applyCustomRange}
          customRangeError={customRangeError}
          error={error}
          monthsInRange={data?.months_in_range ?? null}
          appliedRange={appliedRange}
          isLoading={isLoading}
        />

        {noData ? (
          <Card className="p-8 border-0 shadow-sm text-center">
            <h2 className="text-lg font-semibold">No insights available yet</h2>
            <p className="text-sm text-muted-foreground mt-2">Add transactions to see spending trends and behavior analytics.</p>
          </Card>
        ) : (
          <>
            <InsightsPrimaryMetrics data={data} />
            <InsightsMobileSections
              data={data}
              trendData={trendData}
              categoryDonutData={categoryDonutData}
              budgetVsActualData={budgetVsActualData}
              tagPieData={tagPieData}
              dayOfWeekData={dayOfWeekData}
              recurringVariableData={recurringVariableData}
            />
            <InsightsDesktopSections
              data={data}
              trendData={trendData}
              categoryDonutData={categoryDonutData}
              budgetVsActualData={budgetVsActualData}
              tagPieData={tagPieData}
              dayOfWeekData={dayOfWeekData}
              recurringVariableData={recurringVariableData}
            />
            <InsightsHighlights topTag={topTag} topDay={topDay} overBudgetCount={overBudgetCount} />
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
